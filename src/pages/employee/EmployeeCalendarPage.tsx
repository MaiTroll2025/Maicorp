import { useEffect, useState } from 'react'
import { Container, H1, Card, Chip, Eyebrow } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function EmployeeCalendarPage() {
  const { user } = useAuth()
  const [schedules, setSchedules] = useState<any[]>([])
  const [pto, setPto] = useState<any[]>([])
  useEffect(() => {
    if (!user) return
    supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle()
      .then(async ({ data }) => {
        if (!data) return
        const [s, p] = await Promise.all([
          supabase.from('schedules').select('*').eq('employee_id', data.id).gte('starts_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('starts_at'),
          supabase.from('pto_requests').select('*').eq('employee_id', data.id).order('starts_at'),
        ])
        setSchedules(s.data ?? [])
        setPto(p.data ?? [])
      })
  }, [user])
  return (
    <div className="space-y-6">
      <Eyebrow>Calendar</Eyebrow>
      <H1 className="chrome-text">My schedule</H1>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted"><tr><th className="text-left py-2">Start</th><th>End</th><th>Break</th><th>Notes</th></tr></thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id} className="table-row">
                <td className="py-2">{new Date(s.starts_at).toLocaleString()}</td>
                <td>{new Date(s.ends_at).toLocaleString()}</td>
                <td>{s.break_minutes} min</td>
                <td className="text-xs text-muted">{s.notes ?? ''}</td>
              </tr>
            ))}
            {schedules.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted">No upcoming shifts.</td></tr>}
          </tbody>
        </table>
      </Card>
      <Card>
        <H1 className="text-2xl">PTO</H1>
        <table className="w-full text-sm mt-3">
          <thead className="text-xs uppercase tracking-widest text-muted"><tr><th className="text-left py-2">Dates</th><th>Hours</th><th>Reason</th><th>Status</th></tr></thead>
          <tbody>
            {pto.map((p) => (
              <tr key={p.id} className="table-row">
                <td className="py-2">{new Date(p.starts_at).toLocaleDateString()} → {new Date(p.ends_at).toLocaleDateString()}</td>
                <td>{p.hours}</td>
                <td className="text-xs text-muted">{p.reason ?? ''}</td>
                <td><Chip tone={p.status === 'APPROVED' ? 'ok' : p.status === 'REJECTED' ? 'err' : 'info'}>{p.status}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}