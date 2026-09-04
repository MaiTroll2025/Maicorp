import { useEffect, useState } from 'react'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function CeoPayroll() {
  const [periods, setPeriods] = useState<any[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [records, setRecords] = useState<any[]>([])
  const load = () => supabase.from('payroll_periods').select('*').order('starts_at', { ascending: false }).then(({ data }) => setPeriods(data ?? []))
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!sel) return
    supabase.from('payroll_records').select('*,employees(first_name,last_name)').eq('period_id', sel).order('created_at').then(({ data }) => setRecords(data ?? []))
  }, [sel])

  const create = async () => {
    const starts = prompt('Start date YYYY-MM-DD?')
    const ends = prompt('End date YYYY-MM-DD?')
    if (!starts || !ends) return
    const { data, error } = await supabase.from('payroll_periods').insert({ starts_at: starts, ends_at: ends, status: 'OPEN' }).select('id').single()
    if (data) setSel(data.id); load()
  }

  const calc = async (id: string) => { await supabase.rpc('calculate_payroll', { p_period_id: id }); setSel(id) }
  const approve = async (id: string) => { await supabase.rpc('approve_payroll', { p_period_id: id }); load() }
  const close = async (id: string) => { await supabase.rpc('close_payroll', { p_period_id: id }); load() }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div><Eyebrow>Payroll</Eyebrow><H1 className="chrome-text">Payroll</H1></div>
        <button className="btn-primary" onClick={create}>New period</button>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted"><tr><th className="text-left py-2">Period</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id} className="table-row">
                <td className="py-2">{p.starts_at} → {p.ends_at}</td>
                <td><Chip tone={p.status === 'LOCKED' ? 'default' : p.status === 'PROCESSED' ? 'ok' : 'info'}>{p.status}</Chip></td>
                <td className="flex gap-2 flex-wrap">
                  <button className="text-xs text-primary" onClick={() => setSel(p.id)}>View</button>
                  {p.status === 'OPEN' && <button className="text-xs text-primary" onClick={() => calc(p.id)}>Calculate</button>}
                  {p.status === 'OPEN' && <button className="text-xs text-primary" onClick={() => approve(p.id)}>Approve</button>}
                  {p.status !== 'LOCKED' && <button className="text-xs text-warn" onClick={() => close(p.id)}>Close</button>}
                </td>
              </tr>
            ))}
            {periods.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-muted">No payroll periods.</td></tr>}
          </tbody>
        </table>
      </Card>

      {sel && (
        <Card>
          <H1 className="text-2xl">Records</H1>
          <table className="mt-4 w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-muted"><tr><th className="text-left py-2">Employee</th><th>Reg (min)</th><th>OT (min)</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Status</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="py-2">{r.employees?.first_name} {r.employees?.last_name}</td>
                  <td>{r.regular_minutes}</td>
                  <td>{r.overtime_minutes}</td>
                  <td>${r.gross}</td>
                  <td>${r.deductions_total}</td>
                  <td>${r.net}</td>
                  <td><Chip>{r.status}</Chip></td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">No records.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}