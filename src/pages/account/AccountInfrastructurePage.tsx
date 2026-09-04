import { useEffect, useState, type ReactElement } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Container, H1, H3, Card, Eyebrow, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { ShieldCheck, AlertTriangle, Server, CreditCard, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

function fmtUSD(cents: number) {
  return '$' + (cents / 100).toFixed(2)
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function pickCurrentInvoice(invoices: any[]) {
  if (!invoices || invoices.length === 0) return null
  return [...invoices].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
}

const INFRA_STATUS_TONE: Record<string, 'ok' | 'warn' | 'err' | 'crit' | 'default' | 'info'> = {
  ACTIVE: 'ok',
  PENDING_PAYMENT: 'warn',
  PAYMENT_OVERDUE: 'err',
  SUSPENSION_REQUIRED: 'crit',
  SUSPENDED: 'err',
  RESTORATION_REQUIRED: 'warn',
  CANCELLED: 'default',
}
const INFRA_STATUS_ICON: Record<string, ReactElement> = {
  ACTIVE: <CheckCircle2 size={14} className="text-ok" />,
  PENDING_PAYMENT: <CreditCard size={14} className="text-warn" />,
  PAYMENT_OVERDUE: <AlertTriangle size={14} className="text-err" />,
  SUSPENSION_REQUIRED: <AlertTriangle size={14} className="text-crit" />,
  SUSPENDED: <XCircle size={14} className="text-err" />,
  RESTORATION_REQUIRED: <Server size={14} className="text-warn" />,
  CANCELLED: <XCircle size={14} className="text-muted" />,
}

export function AccountInfrastructurePage() {
  const { user } = useAuth()
  const [search] = useSearchParams()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    if (!user) return
    setLoading(true)
    const { data: orders } = await supabase
      .from('orders')
      .select('id,status,currency,management_plan,infrastructure_payment_responsibility,infrastructure_initial_cost_cents,products(name)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
    const ids = (orders ?? []).map((o) => o.id)
    const [{ data: accounts }, { data: coverages }, { data: invoices }] = await Promise.all([
      ids.length ? supabase.from('infrastructure_accounts').select('*').in('order_id', ids) : Promise.resolve({ data: [] as any[] }),
      ids.length ? supabase.from('infrastructure_coverage').select('*').in('order_id', ids) : Promise.resolve({ data: [] as any[] }),
      ids.length ? supabase.from('infrastructure_invoices').select('*').in('order_id', ids).order('created_at', { ascending: false }) : Promise.resolve({ data: [] as any[] }),
    ])
    const merged = (orders ?? []).map((o) => ({
      ...o,
      account: (accounts ?? []).find((a) => a.order_id === o.id) ?? null,
      coverage: (coverages ?? []).find((c) => c.order_id === o.id) ?? null,
      invoices: (invoices ?? []).filter((i) => i.order_id === o.id),
    }))
    setItems(merged)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function payInvoice(invoiceId: string) {
    setBusy(invoiceId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in required')
      const res = await fetch(`${SUPABASE_URL}/functions/v1/infra-invoice-paypal-create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoice_id: invoiceId }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'PayPal create failed')
      if (json.paypal_approval_url) {
        window.location.href = json.paypal_approval_url
        return
      }
      alert('Invoice is already paid or has no PayPal order.')
    } catch (e: any) {
      alert(e.message ?? 'Failed to start payment')
    } finally {
      setBusy(null)
    }
  }

  async function cancelCoverage(coverageId: string) {
    if (!confirm('Cancel MAI Corp infrastructure coverage? You will become responsible for infrastructure costs directly. Existing unpaid invoices remain due.')) return
    setBusy(coverageId)
    try {
      const { error } = await supabase.rpc('cancel_coverage', {
        p_coverage_id: coverageId,
        p_reason: 'Customer cancellation',
      })
      if (error) throw error
      await load()
    } catch (e: any) {
      alert(e.message ?? 'Cancel failed')
    } finally {
      setBusy(null)
    }
  }

  if (!user) return <Container className="py-12 text-muted">Sign in to view your infrastructure.</Container>
  const justPaid = search.get('paid')

  return (
    <Container className="py-12">
      <Eyebrow>Account</Eyebrow>
      <H1 className="mt-2 chrome-text">Infrastructure Billing</H1>

      {justPaid && (
        <div className="mt-6 rounded-lg border border-ok/40 bg-ok/10 text-ok px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 size={14} /> Payment confirmation received — invoice <span className="font-mono">{justPaid.slice(0, 8)}</span> is being processed.
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <Card className="mt-8"><p className="text-muted">No infrastructure assigned yet. Buy a <Link to="/store" className="text-primary">product</Link> to get started.</p></Card>
      ) : (
        <div className="mt-8 space-y-6">
          {items.map((o) => {
            const account = o.account
            const coverage = o.coverage
            const currentInvoice = pickCurrentInvoice(o.invoices)
            const _invoices = o.invoices ?? []

            return (
              <Card key={o.id} className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <H3>{o.products?.name ?? 'Project'}</H3>
                    <div className="mt-1 text-xs text-muted font-mono">#{o.id.slice(0, 8)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Chip tone={o.management_plan && o.management_plan !== 'NONE' ? 'purp' : 'default'}>Plan: {o.management_plan ?? 'NONE'}</Chip>
                    <Chip tone={o.infrastructure_payment_responsibility === 'MAI_CORP_COVERED' ? 'info' : 'default'}>
                      {o.infrastructure_payment_responsibility === 'MAI_CORP_COVERED' ? 'MAI Corp covered' : 'Customer direct'}
                    </Chip>
                    {account && (
                      <Chip tone={INFRA_STATUS_TONE[account.status] ?? 'default'}>
                        {INFRA_STATUS_ICON[account.status]} {account.status.replace('_', ' ')}
                      </Chip>
                    )}
                  </div>
                </div>

                {/* Management vs infrastructure coverage explanation */}
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg border border-line/40 p-3">
                    <div className="text-xs text-muted uppercase tracking-widest">Your Plan</div>
                    <div className="mt-1 font-semibold">{o.management_plan ?? 'NONE'}</div>
                    <div className="text-xs text-muted mt-1">
                      {o.management_plan === 'ESSENTIAL' && '30 days of MAI Corp infrastructure management.'}
                      {o.management_plan === 'BUSINESS' && '3 months of MAI Corp infrastructure management.'}
                      {o.management_plan === 'PREMIUM' && '6 months of MAI Corp infrastructure management.'}
                      {(!o.management_plan || o.management_plan === 'NONE') && 'No management plan.'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-line/40 p-3">
                    <div className="text-xs text-muted uppercase tracking-widest">Infrastructure Billing</div>
                    <div className="mt-1 font-semibold">
                      {o.infrastructure_payment_responsibility === 'MAI_CORP_COVERED'
                        ? 'MAI Corp covered'
                        : 'Customer direct'}
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {o.infrastructure_payment_responsibility === 'MAI_CORP_COVERED'
                        ? 'MAI Corp pays infrastructure costs on your behalf.'
                        : 'You pay the infrastructure provider directly.'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-line/40 p-3">
                    <div className="text-xs text-muted uppercase tracking-widest">Coverage</div>
                    <div className="mt-1 font-semibold">
                      {coverage ? `$${(coverage.monthly_fee_cents / 100).toFixed(0)}/month` : '—'}
                    </div>
                    <div className="text-xs text-muted mt-1">
                      Infrastructure: {account ? fmtUSD(account.monthly_cost_cents) : '—'}/month
                    </div>
                  </div>
                </div>

                {/* Current invoice */}
                {o.infrastructure_payment_responsibility === 'MAI_CORP_COVERED' && currentInvoice && (
                  <div className="rounded-lg border border-line/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-muted uppercase tracking-widest">Current Invoice</div>
                        <div className="font-mono mt-1">{currentInvoice.invoice_number}</div>
                        <div className="text-xs text-muted mt-1">
                          Period: {fmtDate(currentInvoice.billing_period_start)} – {fmtDate(currentInvoice.billing_period_end)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted">Amount Due</div>
                        <div className="text-xl font-semibold chrome-text">{fmtUSD(currentInvoice.total_cents)}</div>
                        <div className="text-xs text-muted mt-1">Due {fmtDate(currentInvoice.due_date)}</div>
                      </div>
                    </div>

                    <div className="divider my-3" />
                    <table className="w-full text-sm">
                      <tbody>
                        <tr>
                          <td className="text-muted py-1">Infrastructure ({account?.provider ?? 'Supabase Pro'})</td>
                          <td className="text-right py-1">{fmtUSD(currentInvoice.infrastructure_cost_cents)}</td>
                        </tr>
                        <tr>
                          <td className="text-muted py-1">MAI Corp Infrastructure Coverage Renewal</td>
                          <td className="text-right py-1">{fmtUSD(currentInvoice.coverage_fee_cents)}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pt-2 border-t border-line/40">TOTAL</td>
                          <td className="text-right font-semibold pt-2 border-t border-line/40">{fmtUSD(currentInvoice.total_cents)}</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <Chip tone={
                        currentInvoice.status === 'PAID' ? 'ok' :
                        currentInvoice.status === 'OVERDUE' || currentInvoice.status === 'SUSPENDED' ? 'err' :
                        currentInvoice.status === 'PENDING' || currentInvoice.status === 'SENT' ? 'warn' : 'default'
                      }>
                        {currentInvoice.status}
                      </Chip>
                      {currentInvoice.status !== 'PAID' && currentInvoice.status !== 'CANCELLED' && currentInvoice.status !== 'REFUNDED' && (
                        <button
                          className="btn-primary"
                          disabled={busy === currentInvoice.id}
                          onClick={() => payInvoice(currentInvoice.id)}
                        >
                          <CreditCard size={14} /> Pay with PayPal
                        </button>
                      )}
                      {currentInvoice.paypal_approval_url && currentInvoice.status === 'SENT' && (
                        <a className="text-xs text-primary inline-flex items-center gap-1" href={currentInvoice.paypal_approval_url} target="_blank" rel="noreferrer">
                          Resume approval <ExternalLink size={10} />
                        </a>
                      )}
                    </div>

                    {currentInvoice.status === 'OVERDUE' && (
                      <div className="mt-3 rounded-md border border-err/40 bg-err/10 text-err px-3 py-2 text-xs">
                        🔴 PAYMENT REQUIRED — Infrastructure service will be suspended if payment is not received by the invoice due date. No grace period applies.
                      </div>
                    )}
                    {currentInvoice.status === 'SUSPENDED' && (
                      <div className="mt-3 rounded-md border border-err/40 bg-err/10 text-err px-3 py-2 text-xs">
                        🔴 Infrastructure suspended. Pay the outstanding invoice to restore service.
                      </div>
                    )}
                    <div className="mt-3 text-[11px] text-muted flex items-start gap-2">
                      <ShieldCheck size={10} className="mt-0.5 text-primary" />
                      MAI Corp is charging a {fmtUSD(currentInvoice.coverage_fee_cents)} infrastructure coverage/renewal fee. The remaining charges represent underlying infrastructure costs.
                    </div>
                  </div>
                )}

                {/* Coverage controls */}
                {coverage && coverage.cancelled_at === null && (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span>Auto-renew: <strong className={coverage.auto_renew ? 'text-ok' : 'text-warn'}>{coverage.auto_renew ? 'ON' : 'OFF'}</strong></span>
                    <span>Next invoice: <strong className="text-hi">{coverage.next_invoice_date ? fmtDate(coverage.next_invoice_date) : '—'}</strong></span>
                    <button
                      className="btn-ghost text-err ml-auto"
                      disabled={busy === coverage.id}
                      onClick={() => cancelCoverage(coverage.id)}
                    >
                      Cancel coverage
                    </button>
                  </div>
                )}

                {/* Invoice history */}
                {_invoices.length > 0 && (
                  <details className="rounded-lg border border-line/40 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">Invoice history ({_invoices.length})</summary>
                    <div className="mt-3 space-y-2">
                      {_invoices.map((inv: any) => (
                        <div key={inv.id} className="flex items-center justify-between text-xs rounded-md border border-line/30 px-3 py-2">
                          <div>
                            <span className="font-mono">{inv.invoice_number}</span>
                            <span className="text-muted ml-2">{fmtDate(inv.billing_period_start)} – {fmtDate(inv.billing_period_end)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Chip tone={
                              inv.status === 'PAID' ? 'ok' :
                              inv.status === 'OVERDUE' || inv.status === 'SUSPENDED' ? 'err' :
                              'warn'
                            }>{inv.status}</Chip>
                            <span className="font-semibold">{fmtUSD(inv.total_cents)}</span>
                            {inv.paypal_approval_url && (inv.status === 'PENDING' || inv.status === 'SENT') && (
                              <button className="text-primary" disabled={busy === inv.id} onClick={() => payInvoice(inv.id)}>Pay</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </Container>
  )
}
