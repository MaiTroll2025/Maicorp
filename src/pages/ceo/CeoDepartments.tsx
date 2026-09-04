import { useEffect, useState } from 'react'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function CeoDepartments() {
  const [rows, setRows] = useState<any[]>([])
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const load = () => supabase.from('departments').select('*').order('name').then(({ data }) => setRows(data ?? []))
  useEffect(() => { load() }, [])
  const add = async () => {
    if (!name) return
    await supabase.from('departments').insert({ name, description: desc, enabled: true })
    setName(''); setDesc(''); load()
  }
  const toggle = async (id: string, enabled: boolean) => {
    await supabase.from('departments').update({ enabled: !enabled }).eq('id', id); load()
  }
  return (
    <div className="space-y-6">
      <Eyebrow>HR</Eyebrow>
      <H1 className="chrome-text">Departments</H1>
      <Card>
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <input className="input flex-1 min-w-[200px]" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" />
          <button className="btn-primary" onClick={add}>Add</button>
        </div>
      </Card>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted"><tr><th className="text-left py-2">Name</th><th>Description</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="table-row">
                <td className="py-2">{d.name}</td>
                <td className="text-xs text-muted">{d.description}</td>
                <td><Chip tone={d.enabled ? 'ok' : 'default'}>{d.enabled ? 'Active' : 'Disabled'}</Chip></td>
                <td><button className="text-xs text-primary" onClick={() => toggle(d.id, d.enabled)}>{d.enabled ? 'Disable' : 'Enable'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}