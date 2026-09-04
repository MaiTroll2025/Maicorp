// Supabase Edge Function: paypal-create
// Creates a PayPal order using the server-side amount stored in public.orders.
// The function NEVER trusts the client-supplied amount.
//
// Required live secrets (set with `supabase secrets set`):
//   PAYPAL_CLIENT_ID
//   PAYPAL_CLIENT_SECRET
//
// deploy:
//   supabase functions deploy paypal-create --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReqBody { order_id: string }

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

    const { order_id } = (await req.json()) as ReqBody
    if (!order_id) return json({ error: 'missing order_id' }, 400)

    // Server-authoritative amount
    const { data: row, error: rowErr } = await supabase.from('orders').select('id,amount_cents,currency,status,customer_id,products(name)').eq('id', order_id).maybeSingle()
    if (rowErr || !row) return json({ error: 'order not found' }, 404)
    if (row.customer_id !== userId) return json({ error: 'forbidden' }, 403)
    if (row.status !== 'PENDING_PAYMENT') return json({ error: `order is ${row.status}` }, 409)

    const accessToken = await getAccessToken()
    const create = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: order_id,
          amount: {
            currency_code: row.currency || 'USD',
            value: (row.amount_cents / 100).toFixed(2),
          },
          description: row.products?.name ?? 'MAI Corp order',
        }],
        application_context: {
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: `${req.headers.get('origin')}/checkout/${order_id}?status=success`,
          cancel_url: `${req.headers.get('origin')}/checkout/${order_id}?status=cancel`,
        },
      }),
    })

    if (!create.ok) {
      const txt = await create.text()
      return json({ error: 'paypal create failed', detail: txt }, 502)
    }
    const ppOrder = await create.json()
    await supabase.from('orders').update({ paypal_order_id: ppOrder.id }).eq('id', order_id)

    return json({ paypal_order_id: ppOrder.id }, 200)
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