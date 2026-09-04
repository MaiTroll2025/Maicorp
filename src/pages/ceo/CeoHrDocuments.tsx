import { useEffect, useState } from 'react'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function CeoHrDocuments() {
  const [rows, setRows] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [form, setForm] = useState({ employee_id: '', title: '', storage_path: '', kind: 'GENERAL' })
  const load = () => supabase.from('employee_documents').select('*,employees(first_name,last_name)').order('created_at', { ascending: false }).then(({ data }) => setRows(data ?? []))
  useEffect(() => {
    load()
    supabase.from('employees').select('id,first_name,last_name').then(({ data }) => setEmployees(data ?? []))
  }, [])
  const add = async () => {
    if (!form.employee_id || !form.title) { alert('Employee and title required'); return }
    await supabase.from('employee_documents').insert({ ...form })
    setForm({ employee_id: '', title: '', storage_path: '', kind: 'GENERAL' }); load()
  }
  return (
    <div className="space-y-6">
      <Eyebrow>HR</Eyebrow>
      <H1 className="chrome-text">HR documents</H1>
      <Card>
        <div className="flex flex-wrap gap-2">
          <select className="input max-w-xs" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
            <option value="">Employee…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </select>
          <input className="input max-w-xs" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="input flex-1 min-w-[200px]" placeholder="Storage path (private bucket)" value={form.storage_path} onChange={(e) => setForm({ ...form, storage_path: e.target.value })} />
          <select className="input max-w-xs" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {['GENERAL','AGREEMENT','POLICY','ONBOARDING','TRAINING','PERFORMANCE'].map((k) => <option key={k}>{k}</option>)}
          </select>
          <button className="btn-primary" onClick={add}>Add</button>
        </div>
      </Card>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted"><tr><th className="text-left py-2">Title</th><th>Employee</th><th>Kind</th><th>Created</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="table-row">
                <td className="py-2">{d.title}</td>
                <td>{d.employees?.first_name} {d.employees?.last_name}</td>
                <td><Chip>{d.kind}</Chip></td>
                <td className="text-xs text-muted">{new Date(d.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted">No documents.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}