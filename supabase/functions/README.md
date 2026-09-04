# PayPal Edge Functions

Three Deno functions live under `supabase/functions/`:

- `paypal-create` — server-authoritative PayPal order creation (uses the amount stored in `public.orders`)
- `paypal-capture` — captures an approved order, marks `orders.status='PAID'`
- `paypal-webhook` — async webhook receiver for refunds / reversals / disputes; idempotent

## Deploy

```bash
supabase functions deploy paypal-create --no-verify-jwt
supabase functions deploy paypal-capture --no-verify-jwt
supabase functions deploy paypal-webhook --no-verify-jwt
```

## Required secrets (set with `supabase secrets set`)

```
PAYPAL_CLIENT_ID=your-live-paypal-client-id
PAYPAL_CLIENT_SECRET=your-live-paypal-client-secret
PAYPAL_WEBHOOK_ID=   # required; obtain from the PayPal live dashboard after registering the webhook URL
```

## Configure the webhook URL in PayPal

Webhook URL:

```
https://jkavykrzaygeiwjjmlma.supabase.co/functions/v1/paypal-webhook
```

Events to subscribe to:

- `CHECKOUT.ORDER.APPROVED`
- `CHECKOUT.ORDER.COMPLETED`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`
- `PAYMENT.CAPTURE.DENIED`

## Frontend env (already set in `.env` / `.env.local`)

```
VITE_PAYPAL_CLIENT_ID=your-live-paypal-client-id
```

The browser only sees the client_id. The secret never leaves the edge function.