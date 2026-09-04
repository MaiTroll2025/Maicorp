import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Container, H1, H3, Card, Eyebrow, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useCart, managementMonthlyCents, type InfrastructureResponsibility, type ManagementPlan } from '@/lib/cart'
import { PLAN_DETAILS } from '@/lib/planDetails'
import { fmtPrice } from './StoreIndexPage'
import { ShieldCheck, ShoppingCart, ArrowRight, Server, CreditCard, Info, Check, X } from 'lucide-react'
import { Seo } from '@/components/Seo'
import { SITE_URL } from '@/config/seo'

interface Product { id: string; slug: string; name: string; category: string; description: string | null; price_cents: number; currency: string; features: string[]; estimated_delivery: string | null; management_available: boolean; revision_rounds: number }

const SUPABASE_PRO_MONTHLY_CENTS = 2500

export function ProductDetailPage() {
  const { slug } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [disclaimer, setDisclaimer] = useState<string>('MAI Corp management fees cover the management and maintenance services provided by MAI Corp. Customers are responsible for third-party infrastructure and service costs required to operate their website or application, including hosting, domains, databases, email services, storage, payment processing, APIs, and other applicable services.')
  const [ack, setAck] = useState(false)
  const [management, setManagement] = useState<ManagementPlan>('NONE')
  const [infraResp, setInfraResp] = useState<InfrastructureResponsibility>('CUSTOMER_DIRECT')
const { user } = useAuth()
  const cart = useCart()
  const nav = useNavigate()

  useEffect(() => {
    if (!slug) return
    supabase.from('products').select('*').eq('slug', slug).maybeSingle()
      .then(({ data }) => setProduct(data))
    supabase.from('page_content').select('value').eq('key','infrastructure.disclaimer').maybeSingle()
      .then(({ data }) => { if (data?.value?.text) setDisclaimer(data.value.text) })
  }, [slug])

  if (!product) return <Container className="py-20 text-muted">Loading…</Container>

  const monthly = managementMonthlyCents(management)
  const total = product.price_cents + monthly
  const requiresAcknowledgement = management !== 'NONE' || infraResp === 'MAI_CORP_COVERED'
  const canContinue = !requiresAcknowledgement || ack

  const buyNow = async () => {
    if (!user) { nav(`/login?next=/store/product/${slug}`); return }
    if (requiresAcknowledgement && !ack) return
    const { data, error } = await supabase.from('orders').insert({
      customer_id: user.id,
      product_id: product.id,
      amount_cents: total,
      currency: product.currency,
      status: 'PENDING_PAYMENT',
      management_plan: management,
      infrastructure_payment_responsibility: infraResp,
      infrastructure_initial_cost_cents: SUPABASE_PRO_MONTHLY_CENTS,
      infrastructure_acknowledged_at: requiresAcknowledgement ? new Date().toISOString() : null,
    }).select('id').single()
    if (error || !data) { alert(error?.message ?? 'Could not create order'); return }
    nav(`/checkout/${data.id}`)
  }

  const addToCart = () => {
    if (requiresAcknowledgement && !ack) { alert('Please acknowledge the infrastructure terms before continuing.'); return }
    cart.add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      priceCents: product.price_cents,
      currency: product.currency,
      category: product.category,
      managementPlan: management,
      infrastructureResponsibility: infraResp,
      infrastructureMonthlyCostCents: SUPABASE_PRO_MONTHLY_CENTS,
    })
  }

  return (
    <>
      <Seo
        title={`${product.name} | MAI Corp Store`}
        description={product.description ?? `${product.name} from the MAI Corp Technology Studio.`}
        path={`/store/product/${product.slug}`}
        jsonLd={[
          {
            '@type': 'Product',
            name: product.name,
            description: product.description ?? `${product.name} from the MAI Corp Technology Studio.`,
            brand: { '@type': 'Organization', name: 'MAI Corp' },
            offers: { '@type': 'Offer', priceCurrency: product.currency, price: (product.price_cents / 100).toFixed(2), availability: 'https://schema.org/InStock' },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
              { '@type': 'ListItem', position: 2, name: 'Store', item: `${SITE_URL}/store` },
              { '@type': 'ListItem', position: 3, name: product.name, item: `${SITE_URL}/store/product/${product.slug}` },
            ],
          },
        ]}
      />
      <section><Container className="pt-16 pb-10">
        <Eyebrow>Store · {product.category.replace('_',' ')}</Eyebrow>
        <H1 className="mt-3 chrome-text">{product.name}</H1>
        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <div className="text-3xl font-semibold chrome-text">{fmtPrice(total, product.currency)}</div>
          {monthly > 0 && <Chip tone="purp">+${monthly/100}/mo management</Chip>}
          <Chip>{product.estimated_delivery ?? 'Quoted'}</Chip>
          {product.revision_rounds > 0 && <Chip tone="info">{product.revision_rounds} revision rounds</Chip>}
        </div>
      </Container></section>

      <section className="border-t border-line/30">
        <Container className="py-12 grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-5">
            <p className="text-lg text-hi/85 leading-relaxed">{product.description}</p>

            {product.management_available && (
              <Card>
                <H3>Compare management plans</H3>
                <p className="text-xs text-muted mt-1">All plans include Supabase Pro as the managed infrastructure platform. The difference is how long MAI Corp manages it for you and what is included.</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left">
                        <th className="py-2 pr-4 text-xs uppercase tracking-widest text-muted font-medium">Feature</th>
                        <th className="py-2 px-2 text-center">
                          <div className="text-xs uppercase tracking-widest text-muted">Free</div>
                          <div className="font-semibold">{fmtPrice(0, product.currency)}</div>
                        </th>
                        <th className="py-2 px-2 text-center">
                          <div className="text-xs uppercase tracking-widest text-muted">Essential</div>
                          <div className="font-semibold">{fmtPrice(10000, product.currency)}</div>
                        </th>
                        <th className="py-2 px-2 text-center bg-white/5 rounded-t">
                          <div className="text-xs uppercase tracking-widest text-muted">Business</div>
                          <div className="font-semibold">{fmtPrice(20000, product.currency)}</div>
                        </th>
                        <th className="py-2 px-2 text-center">
                          <div className="text-xs uppercase tracking-widest text-muted">Premium</div>
                          <div className="font-semibold">{fmtPrice(30000, product.currency)}</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      <tr className="border-t border-line/30">
                        <td className="py-2 pr-4 text-muted">Supabase Pro infrastructure</td>
                        <td className="py-2 px-2 text-center">Included</td>
                        <td className="py-2 px-2 text-center">Included</td>
                        <td className="py-2 px-2 text-center bg-white/5">Included</td>
                        <td className="py-2 px-2 text-center">Included</td>
                      </tr>
                      <tr className="border-t border-line/30">
                        <td className="py-2 pr-4 text-muted">MAI Corp management window</td>
                        <td className="py-2 px-2 text-center">None</td>
                        <td className="py-2 px-2 text-center">30 days</td>
                        <td className="py-2 px-2 text-center bg-white/5">3 months</td>
                        <td className="py-2 px-2 text-center">6 months</td>
                      </tr>
                      <tr className="border-t border-line/30">
                        <td className="py-2 pr-4 text-muted">Uptime, backup &amp; patch monitoring</td>
                        <td className="py-2 px-2 text-center"><X size={12} className="text-muted inline" /></td>
                        <td className="py-2 px-2 text-center">30 days</td>
                        <td className="py-2 px-2 text-center bg-white/5">3 months</td>
                        <td className="py-2 px-2 text-center">6 months</td>
                      </tr>
                      <tr className="border-t border-line/30">
                        <td className="py-2 pr-4 text-muted">Bug-fix coverage</td>
                        <td className="py-2 px-2 text-center"><X size={12} className="text-muted inline" /></td>
                        <td className="py-2 px-2 text-center">During window</td>
                        <td className="py-2 px-2 text-center bg-white/5">During window</td>
                        <td className="py-2 px-2 text-center">During window</td>
                      </tr>
                      <tr className="border-t border-line/30">
                        <td className="py-2 pr-4 text-muted">MAI Corp infrastructure coverage ($50/mo)</td>
                        <td className="py-2 px-2 text-center">Optional add-on</td>
                        <td className="py-2 px-2 text-center">Optional add-on</td>
                        <td className="py-2 px-2 text-center bg-white/5"><Check size={12} className="text-ok inline" /> Available</td>
                        <td className="py-2 px-2 text-center"><Check size={12} className="text-ok inline" /> Available</td>
                      </tr>
                      <tr className="border-t border-line/30">
                        <td className="py-2 pr-4 text-muted">Monthly infrastructure health report</td>
                        <td className="py-2 px-2 text-center"><X size={12} className="text-muted inline" /></td>
                        <td className="py-2 px-2 text-center"><X size={12} className="text-muted inline" /></td>
                        <td className="py-2 px-2 text-center bg-white/5"><Check size={12} className="text-ok inline" /></td>
                        <td className="py-2 px-2 text-center"><Check size={12} className="text-ok inline" /></td>
                      </tr>
                      <tr className="border-t border-line/30">
                        <td className="py-2 pr-4 text-muted">Priority response SLA</td>
                        <td className="py-2 px-2 text-center"><X size={12} className="text-muted inline" /></td>
                        <td className="py-2 px-2 text-center"><X size={12} className="text-muted inline" /></td>
                        <td className="py-2 px-2 text-center bg-white/5">Next business day</td>
                        <td className="py-2 px-2 text-center">Same business day</td>
                      </tr>
                      <tr className="border-t border-line/30">
                        <td className="py-2 pr-4 text-muted">Dedicated account manager</td>
                        <td className="py-2 px-2 text-center"><X size={12} className="text-muted inline" /></td>
                        <td className="py-2 px-2 text-center"><X size={12} className="text-muted inline" /></td>
                        <td className="py-2 px-2 text-center bg-white/5"><X size={12} className="text-muted inline" /></td>
                        <td className="py-2 px-2 text-center"><Check size={12} className="text-ok inline" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted mt-3">
                  Underlying Supabase Pro, domain, email, and third-party service costs are billed separately and are the customer's responsibility unless MAI Corp infrastructure coverage is selected.
                </p>
              </Card>
            )}

            {(product.features ?? []).length > 0 && (
              <Card>
                <H3>What's included</H3>
                <ul className="mt-4 space-y-2 text-sm text-hi/90">
                  {product.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <ShieldCheck className="text-primary mt-0.5 shrink-0" size={16} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          <div className="lg:col-span-4 space-y-4">
            <Card>
              <H3>Continue</H3>
              <div className="mt-4 space-y-3">
                {product.management_available && (
                  <div>
                    <label className="label">Management subscription</label>
                    <select className="input" value={management} onChange={(e) => setManagement(e.target.value as any)}>
                      <option value="NONE">No management — $0/mo</option>
                      <option value="ESSENTIAL">Essential — $100/mo (30-day management)</option>
                      <option value="BUSINESS">Business — $200/mo (3-month management)</option>
                      <option value="PREMIUM">Premium — $300/mo (6-month management)</option>
                    </select>
                  </div>
                )}

                {product.management_available && (
                  <div className="rounded-lg border border-line/60 p-4 bg-bg/40">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-sm font-semibold">{PLAN_DETAILS[management].name}</div>
                      <div className="text-xs text-muted">{fmtPrice(PLAN_DETAILS[management].monthlyCents, product.currency)}/mo</div>
                    </div>
                    <p className="text-xs text-muted mt-1 leading-relaxed">{PLAN_DETAILS[management].tagline}</p>
                    <div className="mt-3 text-[11px] uppercase tracking-widest text-primary">What you get</div>
                    <ul className="mt-2 space-y-1.5 text-xs">
                      {PLAN_DETAILS[management].benefits.map((b) => (
                        <li key={b.label} className="flex items-start gap-2">
                          {b.included ? <Check size={12} className="text-ok mt-0.5 shrink-0" /> : <X size={12} className="text-muted mt-0.5 shrink-0" />}
                          <span className={b.included ? 'text-hi/90' : 'text-muted line-through'}>{b.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-lg border border-line/60 p-4 bg-bg/40">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Server size={14} className="text-primary" /> Infrastructure payment
                  </div>
                  <div className="mt-3 space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer rounded-md p-2 hover:bg-white/5">
                      <input type="radio" name="infra" className="mt-1 accent-primary" checked={infraResp === 'CUSTOMER_DIRECT'} onChange={() => setInfraResp('CUSTOMER_DIRECT')} />
                      <span className="text-sm">
                        <div className="font-medium">Customer pays infrastructure directly</div>
                        <div className="text-xs text-muted">You pay the infrastructure provider directly.</div>
                        <div className="text-xs text-muted mt-1">No MAI Corp infrastructure coverage fee.</div>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer rounded-md p-2 hover:bg-white/5">
                      <input type="radio" name="infra" className="mt-1 accent-primary" checked={infraResp === 'MAI_CORP_COVERED'} onChange={() => setInfraResp('MAI_CORP_COVERED')} />
                      <span className="text-sm">
                        <div className="font-medium">MAI Corp covers infrastructure</div>
                        <div className="text-xs text-muted">MAI Corp pays the infrastructure provider for you and manages the infrastructure billing.</div>
                        <div className="text-xs text-muted mt-1">$50/month infrastructure coverage fee.</div>
                        <div className="text-xs text-muted">Actual infrastructure costs are billed separately.</div>
                      </span>
                    </label>
                  </div>
                  <div className="mt-3 text-[11px] text-muted flex items-start gap-2">
                    <Info size={12} className="mt-0.5 text-primary" />
                    Estimated initial infrastructure cost: {fmtPrice(SUPABASE_PRO_MONTHLY_CENTS, product.currency)}/mo
                  </div>
                </div>

                {requiresAcknowledgement && (
                  <div className="rounded-lg border border-line/60 p-4 bg-bg/40 text-sm text-hi/85 leading-relaxed">
                    <div className="font-semibold mb-1">Infrastructure terms</div>
                    {disclaimer}
                    <div className="mt-2 text-xs text-muted flex items-start gap-2">
                      <CreditCard size={12} className="mt-0.5 text-warn" />
                      Infrastructure payments are required by the invoice due date. If payment is not received by the due date, MAI Corp may immediately suspend infrastructure services. No grace period is provided.
                    </div>
                    <label className="mt-3 flex items-start gap-2 text-xs text-muted cursor-pointer">
                      <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1 accent-primary" />
                      I understand the infrastructure payment terms and the no-grace-period policy.
                    </label>
                  </div>
                )}

                <div className="mt-5 space-y-2">
              <button className="btn-primary w-full justify-center" disabled={!canContinue} onClick={buyNow}>
                {user ? 'Buy now' : 'Sign in to buy'} <ArrowRight size={16} />
              </button>
              <button className="btn-ghost w-full justify-center" disabled={!canContinue} onClick={addToCart}>
                <ShoppingCart size={16} /> Add to cart
              </button>
              <Link to="/cart" className="text-xs text-muted hover:text-hi block text-center">View cart ({cart.count()})</Link>
            </div>
              </div>
            </Card>
          </div>
        </Container>
      </section>
    </>
  )
}