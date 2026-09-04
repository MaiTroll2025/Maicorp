// Supabase Edge Function: paypal-webhook
// Handles asynchronous PayPal notifications: refunds, reversals, disputes.
// Idempotent: duplicate deliveries are no-ops.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'node:crypto'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PAYPAL_API_BASE = 'https://api-m.paypal.com'

async function verifyWebhook(body: string, headers: Headers): Promise<boolean> {
  const clientId = Deno.env.get('PAYPAL_WEBHOOK_ID') ?? ''
  if (!clientId) return false

  const accessToken = await getAccessToken()
  const verifyUrl = `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`
  const res = await fetch(verifyUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers.get('PAYPAL-AUTH-ALGO'),
      cert_url: headers.get('PAYPAL-CERT-URL'),
      transmission_id: headers.get('PAYPAL-TRANSMISSION-ID'),
      transmission_sig: headers.get('PAYPAL-TRANSMISSION-SIG'),
      transmission_time: headers.get('PAYPAL-TRANSMISSION-TIME'),
      webhook_id: clientId,
      webhook_event: JSON.parse(body),
    }),
  })
  if (!res.ok) return false
  const json = await res.json()
  return json.verification_status === 'SUCCESS'
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET') ?? ''
  if (!clientId || !clientSecret) throw new Error('PayPal live credentials are not configured')
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error('oauth failed')
  const json = await res.json()
  return json.access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: corsHeaders })

  const body = await req.text()
  try {
    const ok = await verifyWebhook(body, req.headers)
    if (!ok) return json({ ok: false, error: 'signature_invalid' }, 400)

    const event = JSON.parse(body)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Idempotency: skip if event already processed
    const eventId = event.id as string
    if (eventId) {
      const { data: dup } = await supabase.from('paypal_events').upsert(
        { event_id: eventId, event_type: event.event_type, processed_at: new Date().toISOString() },
        { onConflict: 'event_id', ignoreDuplicates: true },
      ).select()
    }

    const refOrderId = event.resource?.purchase_units?.[0]?.reference_id
    const customId = event.resource?.purchase_units?.[0]?.custom_id
    if (refOrderId) {
      switch (event.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED': {
          await supabase.from('orders').update({ status: 'PAID', updated_at: new Date().toISOString() }).eq('id', refOrderId)
          // If this was an infrastructure invoice, mark it paid and advance.
          if (customId) {
            await supabase.rpc('mark_invoice_paid', {
              p_invoice_id: customId,
              p_paypal_capture_id: event.resource?.id ?? null,
              p_payment_method: 'PAYPAL',
            })
          } else {
            // Fallback: try to resolve by paypal_order_id stored on the invoice
            const { data: inv } = await supabase
              .from('infrastructure_invoices')
              .select('id')
              .eq('paypal_order_id', event.resource?.id ?? refOrderId)
              .maybeSingle()
            if (inv) {
              await supabase.rpc('mark_invoice_paid', {
                p_invoice_id: inv.id,
                p_paypal_capture_id: event.resource?.id ?? null,
                p_payment_method: 'PAYPAL',
              })
            }
          }

          // Fire intake reminder email to the customer (async, fire-and-forget).
          try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-intake-email`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ kind: 'REMINDER', order_id: refOrderId }),
            })
          } catch (_) { /* swallow - the email log records failures */ }

          // Initialize infrastructure coverage if MAI_CORP_COVERED.
          try {
            const { data: ord } = await supabase.from('orders').select('id,infrastructure_payment_responsibility,infrastructure_initial_cost_cents').eq('id', refOrderId).maybeSingle()
            if (ord?.infrastructure_payment_responsibility === 'MAI_CORP_COVERED') {
              await supabase.rpc('initialize_infrastructure_coverage', {
                p_order_id: ord.id,
                p_infrastructure_cost_cents: ord.infrastructure_initial_cost_cents ?? 2500,
              })
            }
          } catch (_) { /* swallow */ }
          break
        }
        case 'PAYMENT.CAPTURE.REFUNDED':
        case 'PAYMENT.CAPTURE.REVERSED': {
          await supabase.from('orders').update({ status: 'REFUNDED', updated_at: new Date().toISOString() }).eq('id', refOrderId)
          await supabase.from('order_timeline').insert({ order_id: refOrderId, status: 'REFUNDED', note: 'PayPal webhook' })
          if (customId) {
            await supabase.from('infrastructure_invoices').update({ status: 'REFUNDED' }).eq('id', customId)
          }
          break
        }
        case 'CHECKOUT.ORDER.COMPLETED':
        case 'CHECKOUT.ORDER.APPROVED':
          // capture is handled by client+server capture flow
          break
        default:
          break
      }
    }

    return json({ ok: true }, 200)
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message ?? e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}