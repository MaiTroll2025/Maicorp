import { useEffect, useState } from 'react'
import { Container, H1, Card, Chip, Eyebrow } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function EmployeeTimesheets() {
  const { user } = useAuth()
  const [timesheets, setTimesheets] = useState<any[]>([])
  const [entries, setEntries] = useState<any[]>([])
  const [sel, setSel] = useState<string | null>(null)

  const load = async () => {
    if (!user) return
    const { data: emp } = await supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle()
    if (!emp) return
    const ts = await supabase.from('timesheets').select('*').eq('employee_id', emp.id).order('period_start', { ascending: false })
    setTimesheets(ts.data ?? [])
  }
  useEffect(() => { load() }, [user])

  useEffect(() => {
    if (!sel) return
    supabase.from('time_entries').select('*').gte('clock_in_at', new Date(sel).toISOString()).order('clock_in_at').then(({ data }) => setEntries(data ?? []))
  }, [sel])

  const submit = async (id: string) => {
    await supabase.rpc('submit_timesheet', { p_timesheet_id: id })
    load()
  }

  return (
    <div className="space-y-6">
      <Eyebrow>Timesheets</Eyebrow>
      <H1 className="chrome-text">My timesheets</H1>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted"><tr><th className="text-left py-2">Period</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {timesheets.map((t) => (
              <tr key={t.id} className="table-row">
                <td className="py-2">{t.period_start} → {t.period_end}</td>
                <td><Chip tone={t.status === 'APPROVED' ? 'ok' : t.status === 'REJECTED' ? 'err' : 'info'}>{t.status}</Chip></td>
                <td>
                  <button className="text-xs text-primary" onClick={() => setSel(t.id)}>View</button>
                  {(t.status === 'DRAFT' || t.status === 'REJECTED') && (
                    <button className="ml-3 text-xs text-primary" onClick={() => submit(t.id)}>Submit</button>
                  )}
                </td>
              </tr>
            ))}
            {timesheets.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-muted">No timesheets yet.</td></tr>}
          </tbody>
        </table>
      </Card>
      {sel && (
        <Card>
          <H1 className="text-2xl">Entries</H1>
          <table className="w-full text-sm mt-3">
            <thead className="text-xs uppercase tracking-widest text-muted"><tr><th className="text-left py-2">Date</th><th>In</th><th>Out</th><th>Break (min)</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="table-row">
                  <td className="py-2">{new Date(e.clock_in_at).toLocaleDateString()}</td>
                  <td>{new Date(e.clock_in_at).toLocaleTimeString()}</td>
                  <td>{e.clock_out_at ? new Date(e.clock_out_at).toLocaleTimeString() : '—'}</td>
                  <td>{e.break_minutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}