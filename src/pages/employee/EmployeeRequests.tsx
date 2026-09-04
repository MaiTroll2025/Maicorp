import { useEffect, useState } from 'react'
import { Container, H1, Card, Chip, Eyebrow } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function EmployeeRequests() {
  const { user } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [kind, setKind] = useState('QUESTION')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const load = async () => {
    if (!user) return
    const { data: emp } = await supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle()
    if (!emp) return
    supabase.from('hr_requests').select('*').eq('employee_id', emp.id).order('created_at', { ascending: false })
      .then(({ data }) => setRows(data ?? []))
  }
  useEffect(() => { load() }, [user])

  const submit = async () => {
    if (!user) return
    const { data: emp } = await supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle()
    if (!emp) return
    await supabase.from('hr_requests').insert({ employee_id: emp.id, kind, subject, body, status: 'OPEN' })
    setSubject(''); setBody(''); load()
  }

  return (
    <div className="space-y-6">
      <Eyebrow>Requests</Eyebrow>
      <H1 className="chrome-text">HR requests</H1>
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="label">Kind</label>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {['QUESTION','PTO','SCHEDULE','PAYROLL','TIME_CORRECTION','DOCUMENT','POLICY'].map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>
          <div><label className="label">Subject</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="md:col-span-2"><label className="label">Body</label><textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div className="md:col-span-2"><button className="btn-primary" onClick={submit}>Submit</button></div>
        </div>
      </Card>
      <Card>
        <ul className="text-sm space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-white/5 pb-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{r.subject ?? r.kind}</div>
                <div className="text-xs text-muted">{r.body}</div>
                <div className="text-[11px] text-muted">{new Date(r.created_at).toLocaleString()}</div>
              </div>
              <Chip tone={r.status === 'RESOLVED' || r.status === 'CLOSED' ? 'ok' : 'info'}>{r.status}</Chip>
            </li>
          ))}
          {rows.length === 0 && <li className="text-muted">No requests yet.</li>}
        </ul>
      </Card>
    </div>
  )
}