import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Container, H1, Card, Eyebrow, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { fmtPrice } from './StoreIndexPage'
import { useCart } from '@/lib/cart'
import { ShieldCheck } from 'lucide-react'

const PAYPAL_CLIENT_ID = (import.meta.env.VITE_PAYPAL_CLIENT_ID as string) || ''
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

async function getFunctionHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': SUPABASE_ANON,
  }
}

declare global {
  interface Window {
    paypal?: any
  }
}

export function CheckoutPage() {
  const { orderId } = useParams()
  const nav = useNavigate()
  const cart = useCart()
  const paypalRef = useRef<HTMLDivElement>(null)
  const [order, setOrder] = useState<any | null>(null)
  const [status, setStatus] = useState<string>('loading')
  const [error, setError] = useState<string | null>(null)

  const loadOrder = async () => {
    if (!orderId) return
    const { data } = await supabase.from('orders').select('*,products(name,description)').eq('id', orderId).maybeSingle()
    setOrder(data)
    if (data?.status === 'PAID' || data?.status === 'COMPLETED') setStatus('paid')
  }
  useEffect(() => { loadOrder() }, [orderId])

  useEffect(() => {
    if (!orderId) return
    const t = setInterval(loadOrder, 3000)
    return () => clearInterval(t)
  }, [orderId, status])

  // Once the order is PAID, run initialize_infrastructure_coverage. This
  // creates the infrastructure_accounts row + (when MAI_CORP_COVERED) the
  // initial infrastructure_invoice row + coverage.
  useEffect(() => {
    if (status !== 'paid' || !order || order.infrastructure_initialized) return
    const init = async () => {
      try {
        await supabase.rpc('initialize_infrastructure_coverage', {
          p_order_id: order.id,
          p_infrastructure_cost_cents: order.infrastructure_initial_cost_cents ?? 2500,
        })
      } catch (e) {
        console.warn('initialize_infrastructure_coverage failed', e)
      }
    }
    init()
  }, [status, order])

  useEffect(() => {
    if (!order || !paypalRef.current) return
    if (!PAYPAL_CLIENT_ID) { setError('PayPal client ID not configured.'); return }

    const sdkUrl = 'https://www.paypal.com/sdk/js?client-id=' + PAYPAL_CLIENT_ID + '&currency=USD&intent=capture'

    const existing = document.querySelector('script[data-paypal-sdk]') as HTMLScriptElement | null
    if (existing) existing.remove()

    const script = document.createElement('script')
    script.src = sdkUrl
    script.setAttribute('data-paypal-sdk', 'true')
    script.async = true
    script.onload = () => renderButtons()
    script.onerror = () => setError('Failed to load PayPal SDK.')
    document.head.appendChild(script)

    return () => { /* keep SDK for subsequent renders */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id])

  const renderButtons = () => {
    if (!window.paypal || !paypalRef.current || !order) return
    paypalRef.current.innerHTML = ''
    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'paypal' },
      createOrder: async () => {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/paypal-create`, {
          method: 'POST',
          headers: await getFunctionHeaders(),
          body: JSON.stringify({ order_id: order.id }),
        })
        if (!res.ok) {
          const txt = await res.text()
          setError('PayPal create failed: ' + txt)
          throw new Error('create_order failed')
        }
        const data = await res.json()
        return data.paypal_order_id
      },
      onApprove: async (data: any) => {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/paypal-capture`, {
          method: 'POST',
          headers: await getFunctionHeaders(),
          body: JSON.stringify({ order_id: order.id, paypal_order_id: data.orderID }),
        })
        const json = await res.json()
        if (!res.ok || !json.ok) {
          setError('Capture failed: ' + (json.error ?? res.statusText))
          return
        }
        setStatus('paid')
        cart.remove(order.product_id)
        setTimeout(() => nav('/account/orders/' + order.id), 1200)
      },
      onError: (err: any) => setError('PayPal error: ' + (err?.message ?? 'unknown')),
      onCancel: () => setStatus('cancelled'),
    }).render(paypalRef.current)
  }

  if (!order) return <Container className="py-20 text-muted">Loading order…</Container>

  return (
    <Container className="py-12 max-w-3xl">
      <Eyebrow>Checkout</Eyebrow>
      <H1 className="mt-2 chrome-text">Pay for {order.products?.name}</H1>

      <div className="mt-8 grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted">Order</div>
                <div className="font-mono text-xs">#{order.id.slice(0, 8)}</div>
              </div>
              <Chip tone={order.status === 'PAID' || order.status === 'COMPLETED' ? 'ok' : 'info'}>{order.status.replace('_',' ')}</Chip>
            </div>
            <div className="divider my-4" />
            <div className="flex items-center justify-between text-lg">
              <span>Total</span>
              <span className="chrome-text font-semibold">{fmtPrice(order.amount_cents, order.currency)}</span>
            </div>
            {order.management_plan && order.management_plan !== 'NONE' && (
              <div className="mt-2 text-xs text-muted">Includes {order.management_plan} management</div>
            )}
            {order.infrastructure_payment_responsibility === 'MAI_CORP_COVERED' && (
              <div className="mt-1 text-xs text-muted">
                Infrastructure: <span className="text-hi">MAI Corp covered</span> — first monthly invoice will be generated after payment.
              </div>
            )}
            {order.infrastructure_payment_responsibility === 'CUSTOMER_DIRECT' && (
              <div className="mt-1 text-xs text-muted">Infrastructure: customer pays provider directly</div>
            )}
          </Card>

          {order.status === 'PAID' || order.status === 'COMPLETED' ? (
            <Card>
              <div className="text-ok text-lg font-semibold">Payment captured.</div>
              <p className="text-muted text-sm mt-1">Redirecting to your order…</p>
              <Link to={`/account/orders/${order.id}`} className="btn-primary mt-4 inline-flex">View order</Link>
            </Card>
          ) : (
            <Card>
              <div className="text-sm font-semibold mb-2">Pay with PayPal</div>
              {error && <Chip tone="err" className="mb-3">{error}</Chip>}
              <div ref={paypalRef} />
              {!PAYPAL_CLIENT_ID && (
                <p className="text-xs text-muted mt-3">PayPal client ID is not configured. Set VITE_PAYPAL_CLIENT_ID in your environment.</p>
              )}
              <p className="text-[11px] text-muted mt-3 leading-relaxed flex items-start gap-2">
                <ShieldCheck size={12} className="mt-0.5 text-primary" />
                PayPal processes payment on PayPal servers. MAI Corp never sees your card details.
                Server-side capture is idempotent.
              </p>
            </Card>
          )}
        </div>

        <div className="lg:col-span-5">
          <Card>
            <div className="text-sm font-semibold">What happens next</div>
            <ol className="mt-3 text-sm text-muted space-y-2 list-decimal list-inside">
              <li>PayPal captures your payment.</li>
              <li>MAI Corp server records the transaction.</li>
              <li>You receive a confirmation and an intake form.</li>
              <li>The CEO reviews and starts your project.</li>
            </ol>
            <Link to="/cart" className="text-xs text-muted hover:text-hi mt-4 inline-block">← Back to cart</Link>
          </Card>
        </div>
      </div>
    </Container>
  )
}