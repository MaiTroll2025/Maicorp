import { useEffect, useState } from 'react'
import { Container, H1, Card, Chip, Eyebrow } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function EmployeePay() {
  const { user } = useAuth()
  const [records, setRecords] = useState<any[]>([])
  useEffect(() => {
    if (!user) return
    supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        supabase.from('payroll_records').select('*,payroll_periods(starts_at,ends_at)').eq('employee_id', data.id).in('status', ['APPROVED','PAID','LOCKED']).order('created_at', { ascending: false })
          .then(({ data: rows }) => setRecords(rows ?? []))
      })
  }, [user])
  return (
    <div className="space-y-6">
      <Eyebrow>Pay</Eyebrow>
      <H1 className="chrome-text">Pay stubs</H1>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted"><tr><th className="text-left py-2">Period</th><th>Reg</th><th>OT</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Status</th></tr></thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="py-2">{r.payroll_periods?.starts_at} → {r.payroll_periods?.ends_at}</td>
                <td>{r.regular_minutes} min</td>
                <td>{r.overtime_minutes} min</td>
                <td>${r.gross}</td>
                <td>${r.deductions_total}</td>
                <td className="font-semibold">${r.net}</td>
                <td><Chip tone={r.status === 'LOCKED' ? 'ok' : 'info'}>{r.status}</Chip></td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">No finalized pay records yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}