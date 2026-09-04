import { useEffect, useState } from 'react'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function CeoPositions() {
  const [rows, setRows] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [form, setForm] = useState({ title: '', description: '', department_id: '', employment_type: 'FULL_TIME' })
  const load = () => supabase.from('positions').select('*,departments(name)').order('title').then(({ data }) => setRows(data ?? []))
  useEffect(() => {
    load()
    supabase.from('departments').select('id,name').then(({ data }) => setDepartments(data ?? []))
  }, [])
  const add = async () => {
    if (!form.title) return
    await supabase.from('positions').insert({ ...form, department_id: form.department_id || null, enabled: true })
    setForm({ title: '', description: '', department_id: '', employment_type: 'FULL_TIME' }); load()
  }
  return (
    <div className="space-y-6">
      <Eyebrow>HR</Eyebrow>
      <H1 className="chrome-text">Positions</H1>
      <Card>
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-xs" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="input max-w-xs" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="input max-w-xs" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            <option value="">No department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="input max-w-xs" value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })}>
            {['FULL_TIME','PART_TIME','CONTRACTOR','INTERN'].map((t) => <option key={t}>{t}</option>)}
          </select>
          <button className="btn-primary" onClick={add}>Add</button>
        </div>
      </Card>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted"><tr><th className="text-left py-2">Title</th><th>Department</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="table-row">
                <td className="py-2">{p.title}</td>
                <td>{p.departments?.name ?? '—'}</td>
                <td>{p.employment_type}</td>
                <td><Chip tone={p.enabled ? 'ok' : 'default'}>{p.enabled ? 'Active' : 'Disabled'}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}