import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Container, H1, H3, Card, Chip, Eyebrow } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function EmployeeDashboard() {
  const { user } = useAuth()
  const [emp, setEmp] = useState<any | null>(null)
  const [open, setOpen] = useState<any | null>(null)
  const [breaks, setBreaks] = useState<any | null>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])

  const load = async () => {
    if (!user) return
    const { data } = await supabase.from('employees').select('*,positions(title),departments(name),employees!employees_manager_id_fkey(first_name,last_name)').eq('user_id', user.id).maybeSingle()
    setEmp(data)
    if (data) {
      const open = await supabase.from('time_entries').select('*').eq('employee_id', data.id).eq('status', 'OPEN').maybeSingle()
      setOpen(open.data ?? null)
      if (open.data) {
        const b = await supabase.from('break_entries').select('*').eq('time_entry_id', open.data.id).is('ended_at', null).maybeSingle()
        setBreaks(b.data ?? null)
      }
    }
    const ann = await supabase.from('announcements').select('*').eq('status', 'PUBLISHED').order('publish_at', { ascending: false }).limit(5)
    setAnnouncements(ann.data ?? [])
  }
  useEffect(() => { load() }, [user])

  const clockIn = async () => {
    if (!emp) return
    await supabase.rpc('clock_in', { p_employee_id: emp.id })
    load()
  }
  const clockOut = async () => {
    if (!emp) return
    await supabase.rpc('clock_out', { p_employee_id: emp.id })
    load()
  }
  const startBreak = async () => {
    if (!emp) return
    await supabase.rpc('start_break', { p_employee_id: emp.id })
    load()
  }
  const endBreak = async () => {
    if (!emp) return
    await supabase.rpc('end_break', { p_employee_id: emp.id })
    load()
  }

  if (!emp) return <Container className="py-20 text-muted">Loading…</Container>

  return (
    <div className="space-y-6">
      <Eyebrow>Employee</Eyebrow>
      <H1 className="chrome-text">Welcome, {emp.first_name}.</H1>
      <div className="grid lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-4">
          <H3>Status</H3>
          <div className="mt-3 space-y-2 text-sm">
            <div><span className="text-muted">Position:</span> {emp.positions?.title ?? '—'}</div>
            <div><span className="text-muted">Department:</span> {emp.departments?.name ?? '—'}</div>
            <div><span className="text-muted">Manager:</span> {emp.employees?.first_name ?? '—'} {emp.employees?.last_name ?? ''}</div>
            <div><span className="text-muted">Status:</span> <Chip tone={emp.employment_status === 'ACTIVE' ? 'ok' : 'warn'}>{emp.employment_status}</Chip></div>
          </div>
        </Card>
        <Card className="lg:col-span-4">
          <H3>Time clock</H3>
          {!open ? (
            <button className="btn-primary mt-4 w-full justify-center" onClick={clockIn}>Clock in</button>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="text-sm text-muted">Clocked in at {new Date(open.clock_in_at).toLocaleTimeString()}</div>
              {breaks ? (
                <button className="btn-danger w-full justify-center" onClick={endBreak}>End break</button>
              ) : (
                <button className="btn-ghost w-full justify-center" onClick={startBreak}>Start break</button>
              )}
              <button className="btn-primary w-full justify-center" onClick={clockOut}>Clock out</button>
            </div>
          )}
        </Card>
        <Card className="lg:col-span-4">
          <H3>Quick links</H3>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
            <Link className="btn-ghost justify-center" to="/employee/timesheets">Timesheets</Link>
            <Link className="btn-ghost justify-center" to="/employee/calendar">Schedule</Link>
            <Link className="btn-ghost justify-center" to="/employee/pay">Pay</Link>
            <Link className="btn-ghost justify-center" to="/employee/documents">Documents</Link>
            <Link className="btn-ghost justify-center" to="/employee/requests">HR requests</Link>
          </div>
        </Card>
      </div>
      <Card>
        <H3>Company announcements</H3>
        <ul className="mt-3 space-y-2 text-sm">
          {announcements.map((a) => (
            <li key={a.id} className="border-b border-white/5 pb-2">
              <div className="font-medium">{a.title}</div>
              <div className="text-xs text-muted">{a.body}</div>
            </li>
          ))}
          {announcements.length === 0 && <li className="text-muted">No announcements.</li>}
        </ul>
      </Card>
    </div>
  )
}