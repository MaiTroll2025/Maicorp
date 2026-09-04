import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function CeoEmployees() {
  const [rows, setRows] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const load = () => supabase.from('employees').select('id,employee_number,first_name,last_name,preferred_name,email,position:positions(title),department:departments(name),employment_status,account_status,start_date,user_id').order('created_at', { ascending: false })
    .then(({ data }) => setRows(data ?? []))
  useEffect(() => { load() }, [])

  const filtered = rows.filter((r) => {
      if (statusFilter && r.employment_status !== statusFilter) return false
      if (search && !(`${r.first_name} ${r.last_name} ${r.email}`.toLowerCase().includes(search.toLowerCase()))) return false
      return true
    })

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div><Eyebrow>HR</Eyebrow><H1 className="chrome-text">Employees</H1></div>
        <button className="btn-primary" onClick={() => setCreating(true)}>Add employee</button>
      </div>

      <Card>
        <div className="flex gap-2 mb-3">
          <input className="input max-w-xs" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {['PENDING','ACTIVE','ON_LEAVE','SUSPENDED','TERMINATED','INACTIVE'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted">
            <tr><th className="text-left py-2">Employee</th><th>Position</th><th>Department</th><th>Status</th><th>Account</th><th>Started</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="table-row">
                <td className="py-2"><div className="font-medium">{e.first_name} {e.last_name}</div><div className="text-xs text-muted">{e.email}</div></td>
                <td>{e.position?.title ?? '—'}</td>
                <td>{e.department?.name ?? '—'}</td>
                <td><Chip tone={e.employment_status === 'ACTIVE' ? 'ok' : e.employment_status === 'TERMINATED' ? 'err' : 'warn'}>{e.employment_status}</Chip></td>
                <td><Chip tone={e.account_status === 'ACTIVE' ? 'ok' : 'err'}>{e.account_status}</Chip></td>
                <td className="text-xs text-muted">{e.start_date ?? '—'}</td>
                <td><Link className="text-primary text-xs" to={`/ceo/hr/employees/${e.id}`}>Open →</Link></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">No employees.</td></tr>}
          </tbody>
        </table>
      </Card>

      {creating && <NewEmployee onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load() }} />}
    </div>
  )
}

function NewEmployee({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({ first_name: '', last_name: '', email: '', employment_type: 'FULL_TIME', phone: '', address: '', emergency_contact: '', employee_number: '', notes: '' })
  const [departments, setDepartments] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  useEffect(() => {
    supabase.from('departments').select('id,name').then(({ data }) => setDepartments(data ?? []))
    supabase.from('positions').select('id,title').then(({ data }) => setPositions(data ?? []))
  }, [])

  const submit = async () => {
    if (!form.first_name || !form.last_name || !form.email) { alert('Name and email required'); return }
    const employee_number = form.employee_number || `MAI-${Date.now().toString().slice(-6)}`
    const { data, error } = await supabase.from('employees').insert({ ...form, employee_number, employment_status: 'PENDING', account_status: 'PENDING' }).select('id').single()
    if (error || !data) { alert(error?.message ?? 'Failed'); return }
    await supabase.from('audit_logs').insert({ action: 'EMPLOYEE_CREATED', target: data.id, result: 'OK' })
    onSaved()
  }

  return (
    <Card>
      <H1 className="text-2xl">Add employee</H1>
      <p className="text-sm text-muted mt-1">Personal information. Hiring activates account status and triggers secure account invitation.</p>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <F label="First name" k="first_name" v={form.first_name} onChange={(k,v) => setForm({...form, [k]: v})} />
        <F label="Last name" k="last_name" v={form.last_name} onChange={(k,v) => setForm({...form, [k]: v})} />
        <F label="Preferred name" k="preferred_name" v={form.preferred_name} onChange={(k,v) => setForm({...form, [k]: v})} />
        <F label="Email" k="email" v={form.email} type="email" onChange={(k,v) => setForm({...form, [k]: v})} />
        <F label="Phone" k="phone" v={form.phone} onChange={(k,v) => setForm({...form, [k]: v})} />
        <F label="Employee #" k="employee_number" v={form.employee_number} onChange={(k,v) => setForm({...form, [k]: v})} />
        <F label="Address" k="address" v={form.address} onChange={(k,v) => setForm({...form, [k]: v})} />
        <F label="Emergency contact" k="emergency_contact" v={form.emergency_contact} onChange={(k,v) => setForm({...form, [k]: v})} />
        <div className="md:col-span-2">
          <label className="label">Department</label>
          <select className="input" value={form.department_id ?? ''} onChange={(e) => setForm({...form, department_id: e.target.value || null})}>
            <option value="">—</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Position</label>
          <select className="input" value={form.position_id ?? ''} onChange={(e) => setForm({...form, position_id: e.target.value || null})}>
            <option value="">—</option>
            {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Employment type</label>
          <select className="input" value={form.employment_type} onChange={(e) => setForm({...form, employment_type: e.target.value})}>
            {['FULL_TIME','PART_TIME','CONTRACTOR','INTERN'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="md:col-span-2"><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></div>
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn-primary" onClick={submit}>Create record</button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Card>
  )
}

function F({ label, k, v, onChange, type = 'text' }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={v ?? ''} onChange={(e) => onChange(k, e.target.value)} />
    </div>
  )
}