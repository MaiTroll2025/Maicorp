// Supabase Edge Function: infra-invoice-paypal-create
// Creates a PayPal order for an infrastructure_invoices row. The
// amount, currency, and reference are server-authoritative.
//
// Required secrets:
//   PAYPAL_CLIENT_ID
//   PAYPAL_CLIENT_SECRET
//
// deploy:
//   supabase functions deploy infra-invoice-paypal-create --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReqBody { invoice_id: string }

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
    if (!userId) return json({ error: 'unauthenticated' }, 401)

    const { invoice_id } = (await req.json()) as ReqBody
    if (!invoice_id) return json({ error: 'missing invoice_id' }, 400)

    const { data: inv, error: invErr } = await supabase
      .from('infrastructure_invoices')
      .select('id,order_id,customer_id,total_cents,currency,status,paypal_order_id,paypal_approval_url,invoice_number')
      .eq('id', invoice_id)
      .maybeSingle()
    if (invErr || !inv) return json({ error: 'invoice not found' }, 404)
    if (inv.customer_id !== userId) return json({ error: 'forbidden' }, 403)
    if (inv.status === 'PAID') return json({ error: 'invoice already paid' }, 409)

    const { data: order } = await supabase.from('orders').select('management_plan,products(name)').eq('id', inv.order_id).maybeSingle()
    const accessToken = await getAccessToken()

    const body: any = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: inv.invoice_number,
        custom_id: inv.id,
        amount: {
          currency_code: inv.currency || 'USD',
          value: (inv.total_cents / 100).toFixed(2),
        },
        description: `MAI Corp Infrastructure Invoice ${inv.invoice_number}` + (order?.products?.name ? ` · ${order.products.name}` : ''),
      }],
      application_context: {
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: `${req.headers.get('origin')}/account/infrastructure?paid=${inv.id}`,
        cancel_url: `${req.headers.get('origin')}/account/infrastructure?cancelled=${inv.id}`,
      },
    }

    const create = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!create.ok) {
      const txt = await create.text()
      await supabase.from('infrastructure_invoices').update({ paypal_error: txt }).eq('id', inv.id)
      return json({ error: 'paypal create failed', detail: txt }, 502)
    }
    const ppOrder = await create.json()
    const approvalUrl: string | undefined = ppOrder.links?.find((l: any) => l.rel === 'approve')?.href
    await supabase.from('infrastructure_invoices').update({
      paypal_order_id: ppOrder.id,
      paypal_approval_url: approvalUrl,
      status: 'SENT',
      paypal_error: null,
    }).eq('id', inv.id)

    return json({
      ok: true,
      paypal_order_id: ppOrder.id,
      paypal_approval_url: approvalUrl,
    }, 200)
  } catch (e: any) {
    return json({ error: 'unexpected', detail: String(e?.message ?? e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
