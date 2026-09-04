import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Container, H1, H3, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function CeoEmployeeDetail() {
  const { id } = useParams()
  const [emp, setEmp] = useState<any | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [records, setRecords] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [audit, setAudit] = useState<any[]>([])

  const load = async () => {
    if (!id) return
    const { data } = await supabase.from('employees').select('*,positions(title),departments(name)').eq('id', id).maybeSingle()
    setEmp(data)
    const [h, r, d, a] = await Promise.all([
      supabase.from('employee_status_history').select('*').eq('employee_id', id).order('effective_from', { ascending: false }),
      supabase.from('employment_records').select('*').eq('employee_id', id).order('effective_from', { ascending: false }),
      supabase.from('employee_documents').select('*').eq('employee_id', id).order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*').eq('target', id).order('created_at', { ascending: false }).limit(50),
    ])
    setHistory((h.data ?? []) as any)
    setRecords((r.data ?? []) as any)
    setDocs((d.data ?? []) as any)
    setAudit((a.data ?? []) as any)
  }
  useEffect(() => { load() }, [id])

  const run = async (fn: () => Promise<any>, label: string) => {
    if (label.startsWith('Terminate')) {
      const reason = prompt('Termination reason?') ?? ''
      const { error } = await fn()
      if (error) alert(error.message); else load()
      return
    }
    if (label.startsWith('Place on leave')) {
      const expected = prompt('Expected return date (YYYY-MM-DD)?') ?? ''
      const { error } = await fn()
      if (error) alert(error.message); else load()
      return
    }
    const { error } = await fn()
    if (error) alert(error.message); else load()
  }

  if (!emp) return <Container className="py-20 text-muted">Loading…</Container>

  const empId = emp.id
  const call = async (fn: string, args: any) => {
    const { error } = await supabase.rpc(fn as any, args)
    return { error }
  }

  return (
    <div className="space-y-6">
      <Eyebrow>HR</Eyebrow>
      <H1 className="chrome-text">{emp.first_name} {emp.last_name}</H1>
      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          <Card>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted text-xs uppercase tracking-widest">Employee #</span><div className="mt-1">{emp.employee_number}</div></div>
              <div><span className="text-muted text-xs uppercase tracking-widest">Email</span><div className="mt-1">{emp.email}</div></div>
              <div><span className="text-muted text-xs uppercase tracking-widest">Position</span><div className="mt-1">{emp.positions?.title ?? '—'}</div></div>
              <div><span className="text-muted text-xs uppercase tracking-widest">Department</span><div className="mt-1">{emp.departments?.name ?? '—'}</div></div>
              <div><span className="text-muted text-xs uppercase tracking-widest">Status</span><div className="mt-1"><Chip tone={emp.employment_status === 'ACTIVE' ? 'ok' : emp.employment_status === 'TERMINATED' ? 'err' : 'warn'}>{emp.employment_status}</Chip></div></div>
              <div><span className="text-muted text-xs uppercase tracking-widest">Account</span><div className="mt-1"><Chip tone={emp.account_status === 'ACTIVE' ? 'ok' : 'err'}>{emp.account_status}</Chip></div></div>
              <div><span className="text-muted text-xs uppercase tracking-widest">Phone</span><div className="mt-1">{emp.phone ?? '—'}</div></div>
              <div><span className="text-muted text-xs uppercase tracking-widest">Start date</span><div className="mt-1">{emp.start_date ?? '—'}</div></div>
            </div>
          </Card>

          <Card>
            <H3>Employment history</H3>
            <ul className="mt-4 space-y-2 text-sm">
              {records.map((r) => (
                <li key={r.id} className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div><div className="font-medium">{r.change_type}</div><div className="text-xs text-muted">{r.effective_from} → {r.effective_to ?? 'current'}</div></div>
                  <div className="text-xs text-muted">{r.reason ?? ''}</div>
                </li>
              ))}
              {records.length === 0 && <li className="text-muted">No records.</li>}
            </ul>
          </Card>

          <Card>
            <H3>Status history</H3>
            <ul className="mt-4 space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between border-b border-white/5 pb-2">
                  <Chip>{h.status}</Chip>
                  <span className="text-xs text-muted">{new Date(h.effective_from).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <H3>Audit history</H3>
            <ul className="mt-4 space-y-2 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div><div className="font-mono text-xs">{a.action}</div><div className="text-xs text-muted">{new Date(a.created_at).toLocaleString()}</div></div>
                  <Chip tone={a.result === 'OK' ? 'ok' : 'err'}>{a.result ?? '—'}</Chip>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-3">
          <Card>
            <H3>Lifecycle actions</H3>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
              {emp.employment_status !== 'ACTIVE' && (
                <button className="btn-primary justify-center" onClick={() => run(() => call('hire_employee', { p_employee_id: empId, p_position_id: emp.position_id, p_department_id: emp.department_id, p_manager_id: emp.manager_id, p_start_date: new Date().toISOString().slice(0,10) }), 'Hire')}>Hire</button>
              )}
              <button className="btn-ghost justify-center" onClick={() => run(() => call('promote_employee', { p_employee_id: empId, p_position_id: emp.position_id, p_department_id: emp.department_id, p_manager_id: emp.manager_id, p_reason: 'Promote' }), 'Promote')}>Promote</button>
              <button className="btn-ghost justify-center" onClick={() => run(() => call('transfer_employee', { p_employee_id: empId, p_department_id: emp.department_id, p_manager_id: emp.manager_id, p_reason: 'Transfer' }), 'Transfer')}>Transfer</button>
              <button className="btn-ghost justify-center" onClick={() => run(() => call('place_on_leave', { p_employee_id: empId, p_expected_return: null, p_reason: 'On leave' }), 'Place on leave')}>Place on leave</button>
              <button className="btn-ghost justify-center" onClick={() => run(() => call('return_from_leave', { p_employee_id: empId, p_reason: 'Return' }), 'Return')}>Return from leave</button>
              <button className="btn-ghost justify-center" onClick={() => run(() => call('suspend_employee', { p_employee_id: empId, p_reason: 'Suspended' }), 'Suspend')}>Suspend</button>
              <button className="btn-ghost justify-center" onClick={() => run(() => call('reactivate_employee', { p_employee_id: empId, p_reason: 'Reactivated' }), 'Reactivate')}>Reactivate</button>
              <button className="btn-danger justify-center" onClick={() => run(() => call('terminate_employee', { p_employee_id: empId, p_reason: prompt('Termination reason?') ?? '' }), 'Terminate')}>Terminate</button>
            </div>
            <p className="text-[11px] text-muted mt-3">All actions are audited. Terminate immediately revokes sessions and access.</p>
          </Card>

          <Card>
            <H3>Documents</H3>
            <ul className="mt-3 space-y-2 text-sm">
              {docs.length === 0 ? <li className="text-muted">No documents uploaded.</li> : docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div>{d.title}</div>
                  <span className="text-xs text-muted">{d.kind}</span>
                </li>
              ))}
            </ul>
            <Link to="/ceo/hr/documents" className="text-xs text-primary mt-3 inline-block">Manage documents →</Link>
          </Card>
        </div>
      </div>
    </div>
  )
}