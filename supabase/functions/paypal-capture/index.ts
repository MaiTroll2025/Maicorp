// Supabase Edge Function: paypal-capture
// Captures a previously-created PayPal order and updates the matching row.
// Idempotent: re-capturing the same order does not duplicate charges.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReqBody { order_id: string; paypal_order_id: string }

const PAYPAL_API_BASE = 'https://api-m.paypal.com'

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
  if (!res.ok) throw new Error('paypal oauth failed: ' + res.status)
  const json = await res.json()
  return json.access_token as string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) return json({ ok: false, error: 'unauthenticated' }, 401)

    const { order_id, paypal_order_id } = (await req.json()) as ReqBody
    if (!order_id || !paypal_order_id) return json({ ok: false, error: 'missing params' }, 400)

    const { data: row } = await supabase.from('orders').select('id,customer_id,status,amount_cents,currency,paypal_capture_id').eq('id', order_id).maybeSingle()
    if (!row) return json({ ok: false, error: 'order not found' }, 404)
    if (row.customer_id !== userId) return json({ ok: false, error: 'forbidden' }, 403)

    // Idempotency: already captured
    if (row.paypal_capture_id) {
      return json({ ok: true, already: true, status: row.status }, 200)
    }

    const accessToken = await getAccessToken()
    const cap = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${paypal_order_id}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    const capJson = await cap.json()
    if (!cap.ok || capJson.status !== 'COMPLETED') {
      return json({ ok: false, error: 'capture failed', detail: capJson }, 502)
    }

    const captureId = capJson.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null
    await supabase.from('orders').update({
      paypal_capture_id: captureId,
      status: 'PAID',
      updated_at: new Date().toISOString(),
    }).eq('id', order_id)
    await supabase.from('order_timeline').insert({ order_id, status: 'PAID', note: `PayPal capture ${captureId}` })

    return json({ ok: true, capture_id: captureId }, 200)
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