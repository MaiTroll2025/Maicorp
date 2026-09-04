import { Link, useNavigate } from 'react-router-dom'
import { Container, H1, Card, Eyebrow, Chip } from '@/components/ui'
import { useCart, managementMonthlyCents, COVERAGE_MONTHLY_FEE_CENTS, type CartItem, type InfrastructureResponsibility, type ManagementPlan } from '@/lib/cart'
import { PLAN_DETAILS } from '@/lib/planDetails'
import { fmtPrice } from '../public/StoreIndexPage'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Trash2, ArrowRight, ShieldCheck, Server, Info, Check, X } from 'lucide-react'

const SUPABASE_PRO_MONTHLY_CENTS = 2500

export function CartPage() {
  const { items, remove, setPlan, setInfrastructureResponsibility, clear, subtotalCents } = useCart()
  const { user } = useAuth()
  const nav = useNavigate()

  const subtotal = subtotalCents()
  const tax = Math.round(subtotal * 0.0) // tax configurable later
  const total = subtotal + tax

  const checkout = async () => {
    if (!user) { nav('/login?next=/cart'); return }
    if (items.length === 0) return
    const requiresAck = items.some((i) => i.managementPlan !== 'NONE' || i.infrastructureResponsibility === 'MAI_CORP_COVERED')
    if (requiresAck && !confirm('Management and MAI Corp infrastructure coverage require acknowledging the no-grace-period billing terms. Continue to checkout?')) return

    // Create one order per cart item; PayPal flow opens after the order
    // record exists. Each order is server-authoritative.
    for (const i of items) {
      const ack = i.managementPlan !== 'NONE' || i.infrastructureResponsibility === 'MAI_CORP_COVERED'
      const { data: order, error } = await supabase.from('orders').insert({
        customer_id: user.id,
        product_id: i.productId,
        amount_cents: i.priceCents + managementMonthlyCents(i.managementPlan),
        currency: i.currency,
        status: 'PENDING_PAYMENT',
        management_plan: i.managementPlan,
        infrastructure_payment_responsibility: i.infrastructureResponsibility,
        infrastructure_initial_cost_cents: i.infrastructureMonthlyCostCents || SUPABASE_PRO_MONTHLY_CENTS,
        infrastructure_acknowledged_at: ack ? new Date().toISOString() : null,
      }).select('id').single()
      if (error || !order) { alert(error?.message ?? 'Order failed'); return }
      nav(`/checkout/${order.id}`)
      return
    }
  }

  return (
    <Container className="py-12">
      <Eyebrow>Cart</Eyebrow>
      <H1 className="mt-2 chrome-text">Your cart</H1>

      {items.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="text-muted">Your cart is empty.</p>
          <Link to="/store" className="btn-primary mt-5 inline-flex">Browse the store <ArrowRight size={16} /></Link>
        </Card>
      ) : (
        <div className="mt-8 grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-3">
            {items.map((i) => (
              <CartRow
                key={i.productId}
                item={i}
                onRemove={() => remove(i.productId)}
                onPlan={(p) => setPlan(i.productId, p)}
                onInfraResp={(r) => setInfrastructureResponsibility(i.productId, r)}
              />
            ))}
            <button className="text-xs text-muted hover:text-hi" onClick={clear}>Clear cart</button>
          </div>

          <div className="lg:col-span-4 space-y-3">
            <Card>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span>{fmtPrice(subtotal, 'USD')}</span>
              </div>
              {tax > 0 && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted">Tax</span>
                  <span>{fmtPrice(tax, 'USD')}</span>
                </div>
              )}
              <div className="divider my-4" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-xl font-semibold chrome-text">{fmtPrice(total, 'USD')}</span>
              </div>
              <button className="btn-primary w-full justify-center mt-5" onClick={checkout}>
                Checkout <ArrowRight size={16} />
              </button>
              <p className="text-[11px] text-muted mt-3 leading-relaxed flex items-start gap-2">
                <ShieldCheck size={12} className="mt-0.5 text-primary" />
                Prices are server-authoritative. PayPal Checkout opens in the next step.
              </p>
            </Card>
          </div>
        </div>
      )}
    </Container>
  )
}

function CartRow({ item, onRemove, onPlan, onInfraResp }: { item: CartItem; onRemove: () => void; onPlan: (p: ManagementPlan) => void; onInfraResp: (r: InfrastructureResponsibility) => void }) {
  const monthly = managementMonthlyCents(item.managementPlan)
  const line = (item.priceCents + monthly) * item.qty
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Chip>{item.category.replace('_', ' ')}</Chip>
          <Link to={`/store/product/${item.slug}`} className="block mt-2 text-lg font-semibold hover:text-primary">{item.name}</Link>
          <div className="text-xs text-muted">Qty {item.qty}</div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-muted">Plan:</span>
            <select className="input max-w-[220px] py-1 text-xs" value={item.managementPlan} onChange={(e) => onPlan(e.target.value as any)}>
              <option value="NONE">Free — $0</option>
              <option value="ESSENTIAL">Essential — $100/mo (30 days)</option>
              <option value="BUSINESS">Business — $200/mo (3 months)</option>
              <option value="PREMIUM">Premium — $300/mo (6 months)</option>
            </select>
          </div>
          <div className="mt-2 rounded-md border border-line/40 bg-bg/40 p-3 text-[11px]">
            <div className="flex items-baseline justify-between">
              <div className="font-semibold text-hi/90">{PLAN_DETAILS[item.managementPlan].name}</div>
              <div className="text-muted">{fmtPrice(PLAN_DETAILS[item.managementPlan].monthlyCents, item.currency)}/mo</div>
            </div>
            <div className="text-muted mt-0.5 leading-snug">{PLAN_DETAILS[item.managementPlan].tagline}</div>
            <ul className="mt-1.5 space-y-0.5">
              {PLAN_DETAILS[item.managementPlan].benefits.map((b) => (
                <li key={b.label} className="flex items-start gap-1.5">
                  {b.included ? <Check size={9} className="text-ok mt-0.5 shrink-0" /> : <X size={9} className="text-muted mt-0.5 shrink-0" />}
                  <span className={b.included ? 'text-hi/85' : 'text-muted line-through'}>{b.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-2 text-xs text-muted flex items-center gap-2">
            <Server size={12} />
            <select
              className="input max-w-[260px] py-1 text-xs"
              value={item.infrastructureResponsibility}
              onChange={(e) => onInfraResp(e.target.value as any)}
            >
              <option value="CUSTOMER_DIRECT">Customer pays infrastructure directly</option>
              <option value="MAI_CORP_COVERED">MAI Corp covers ($50/mo fee)</option>
            </select>
          </div>
          {item.infrastructureResponsibility === 'MAI_CORP_COVERED' && (
            <div className="mt-1 text-[11px] text-warn flex items-start gap-1">
              <Info size={10} className="mt-0.5" />
              Actual infrastructure costs billed separately. No grace period.
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold chrome-text">{fmtPrice(line, item.currency)}</div>
          <div className="text-xs text-muted">{fmtPrice(item.priceCents, item.currency)} base{monthly ? ` + $${monthly/100}/mo` : ''}</div>
          {item.infrastructureResponsibility === 'MAI_CORP_COVERED' && (
            <div className="text-xs text-muted mt-1">+ ${COVERAGE_MONTHLY_FEE_CENTS/100}/mo coverage fee</div>
          )}
          <button className="text-xs text-err mt-2 inline-flex items-center gap-1" onClick={onRemove}>
            <Trash2 size={12} /> Remove
          </button>
        </div>
      </div>
    </Card>
  )
}