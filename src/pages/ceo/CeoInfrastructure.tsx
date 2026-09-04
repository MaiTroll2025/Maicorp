import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

function fmtUSD(cents: number) {
  return '$' + (cents / 100).toFixed(2)
}
function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'PENDING', label: 'Pending payment' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'SUSPENSION_REQUIRED', label: 'Suspension required' },
  { key: 'SUSPENDED', label: 'Suspended' },
  { key: 'RESTORATION_REQUIRED', label: 'Restoration required' },
  { key: 'CANCELLED', label: 'Cancelled' },
] as const

export function CeoInfrastructure() {
  const [rows, setRows] = useState<any[]>([])
  const [filter, setFilter] = useState<typeof FILTERS[number]['key']>('ALL')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = async () => {
    const { data } = await supabase
      .from('v_ceo_infrastructure_dashboard')
      .select('*')
      .order('current_invoice_due_date', { ascending: true, nullsFirst: false })
    setRows(data ?? [])
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (filter === 'ALL') return rows
    return rows.filter((r) => {
      // Match against either invoice status, coverage status, or infrastructure status
      return r.current_invoice_status === filter
        || r.coverage_status === filter
        || r.infrastructure_status === filter
    })
  }, [rows, filter])

  async function runCron() {
    setBusy('cron')
    setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')
      const res = await fetch(`${SUPABASE_URL}/functions/v1/run-infrastructure-billing-cron`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_ANON },
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'cron failed')
      setMsg(`Cron: overdue=${json.overdue_marked} suspended=${json.suspended} renewals=${json.renewals_generated} new_emails=${json.new_invoices_emailed}`)
      await load()
    } catch (e: any) {
      setMsg(e.message ?? 'Cron failed')
    } finally {
      setBusy(null)
    }
  }

  async function suspendNow(invoiceId: string) {
    setBusy(invoiceId)
    try {
      const { data, error } = await supabase.rpc('execute_suspension', { p_invoice_id: invoiceId })
      if (error) throw error
      setMsg(JSON.stringify(data))
      await load()
    } catch (e: any) {
      setMsg(e.message ?? 'suspend failed')
    } finally {
      setBusy(null)
    }
  }

  async function confirmRestore(invoiceId: string) {
    setBusy(invoiceId + ':restore')
    try {
      const { error } = await supabase.rpc('confirm_restoration', { p_invoice_id: invoiceId })
      if (error) throw error
      setMsg('Restored.')
      await load()
    } catch (e: any) {
      setMsg(e.message ?? 'restore failed')
    } finally {
      setBusy(null)
    }
  }

  async function markPaid(invoiceId: string) {
    setBusy(invoiceId + ':paid')
    try {
      const { error } = await supabase.rpc('mark_invoice_paid', {
        p_invoice_id: invoiceId,
        p_payment_method: 'MANUAL',
      })
      if (error) throw error
      setMsg('Marked paid.')
      await load()
    } catch (e: any) {
      setMsg(e.message ?? 'mark paid failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <Eyebrow>Commerce</Eyebrow>
      <H1 className="chrome-text">Infrastructure Billing</H1>

      <div className="flex flex-wrap gap-2 items-center">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip ${filter === f.key ? 'chip-info' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <button className="btn-ghost ml-auto" onClick={runCron} disabled={busy === 'cron'}>
          Run daily cron now
        </button>
      </div>

      {msg && <div className="rounded-md border border-line/40 p-3 text-xs text-muted">{msg}</div>}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-muted">
              <tr>
                <th className="text-left py-2">Customer</th>
                <th className="text-left">Project</th>
                <th className="text-left">Plan</th>
                <th className="text-left">Coverage</th>
                <th className="text-left">Provider</th>
                <th className="text-right">Infra cost</th>
                <th className="text-right">Coverage fee</th>
                <th className="text-left">Invoice</th>
                <th className="text-right">Amount</th>
                <th className="text-left">Status</th>
                <th className="text-left">Due</th>
                <th className="text-left">Next renewal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.order_id} className="table-row align-top">
                  <td className="py-2">
                    <div className="text-hi">{r.customer_name || r.customer_email}</div>
                    <div className="text-xs text-muted">{r.customer_email}</div>
                  </td>
                  <td>
                    <Link className="text-primary hover:underline" to={`/ceo/orders/${r.order_id}`}>{r.project_name ?? '—'}</Link>
                    <div className="text-xs text-muted font-mono">#{r.order_id.slice(0, 8)}</div>
                  </td>
                  <td><Chip tone={r.management_plan && r.management_plan !== 'NONE' ? 'purp' : 'default'}>{r.management_plan ?? 'NONE'}</Chip></td>
                  <td>
                    <Chip tone={r.coverage_type === 'MAI_CORP_COVERED' ? 'info' : 'default'}>{r.coverage_type ?? 'NONE'}</Chip>
                    <div className="text-[11px] text-muted mt-1">{r.coverage_status}</div>
                  </td>
                  <td>{r.provider ?? '—'}</td>
                  <td className="text-right">{r.infrastructure_monthly_cost_cents ? fmtUSD(r.infrastructure_monthly_cost_cents) : '—'}</td>
                  <td className="text-right">{r.monthly_fee_cents ? fmtUSD(r.monthly_fee_cents) : '—'}</td>
                  <td>
                    {r.invoice_number ? (
                      <>
                        <div className="font-mono text-xs">{r.invoice_number}</div>
                        {r.current_invoice_paypal_approval_url && r.current_invoice_status !== 'PAID' && (
                          <a className="text-[11px] text-primary" href={r.current_invoice_paypal_approval_url} target="_blank" rel="noreferrer">PayPal link</a>
                        )}
                      </>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="text-right">{r.current_invoice_total_cents ? fmtUSD(r.current_invoice_total_cents) : '—'}</td>
                  <td>
                    <Chip tone={
                      r.current_invoice_status === 'PAID' ? 'ok' :
                      r.current_invoice_status === 'OVERDUE' || r.current_invoice_status === 'SUSPENDED' || r.infrastructure_status === 'SUSPENSION_REQUIRED' ? 'err' :
                      r.infrastructure_status === 'PAYMENT_OVERDUE' ? 'crit' :
                      'warn'
                    }>
                      {r.current_invoice_status ?? r.infrastructure_status ?? 'NO_INVOICE'}
                    </Chip>
                    {r.infrastructure_status === 'SUSPENSION_REQUIRED' && (
                      <div className="mt-1 text-[10px] text-crit font-bold">🔴 INFRASTRUCTURE PAYMENT REQUIRED</div>
                    )}
                  </td>
                  <td className="text-xs">{r.current_invoice_due_date ? fmtDate(r.current_invoice_due_date) : '—'}</td>
                  <td className="text-xs">{r.next_invoice_date ? fmtDate(r.next_invoice_date) : '—'}</td>
                  <td className="text-right space-x-1">
                    {r.current_invoice_id && r.current_invoice_status !== 'PAID' && (
                      <>
                        <button
                          className="text-[11px] text-err"
                          disabled={busy === r.current_invoice_id}
                          onClick={() => suspendNow(r.current_invoice_id)}
                        >Suspend</button>
                        <button
                          className="text-[11px] text-ok ml-2"
                          disabled={busy === r.current_invoice_id + ':paid'}
                          onClick={() => markPaid(r.current_invoice_id)}
                        >Mark paid</button>
                      </>
                    )}
                    {r.coverage_status === 'RESTORATION_REQUIRED' && (
                      <button
                        className="text-[11px] text-ok ml-2"
                        disabled={busy === r.current_invoice_id + ':restore'}
                        onClick={() => confirmRestore(r.current_invoice_id)}
                      >Restore</button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={13} className="py-6 text-center text-muted">No infrastructure records match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="text-sm font-semibold">Infrastructure alerts</div>
        <p className="text-xs text-muted mt-1">The daily cron (<code>run-infrastructure-billing-cron</code>) drives the full lifecycle. Use the button above to trigger it on demand.</p>
        <ul className="mt-3 text-xs text-muted space-y-1 list-disc list-inside">
          <li>🔴 INFRASTRUCTURE PAYMENT REQUIRED when <code>infrastructure_accounts.status = SUSPENSION_REQUIRED</code></li>
          <li>PAYMENT_OVERDUE → SUSPENSION_REQUIRED immediately when <code>invoices.due_date &lt; today</code></li>
          <li>Restoration required after an overdue invoice is paid; CEO confirms via the Restore button.</li>
        </ul>
      </Card>
    </div>
  )
}
