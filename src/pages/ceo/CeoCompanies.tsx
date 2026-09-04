import { useEffect, useState } from 'react'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

interface Company { id: string; slug: string; name: string; tagline: string | null; description: string | null; status: string; website: string | null; play_url: string | null; store_url: string | null; featured: boolean; sort_order: number; launch_date: string | null }

export function CeoCompanies() {
  const [rows, setRows] = useState<Company[]>([])
  const [editing, setEditing] = useState<Partial<Company> | null>(null)
  const load = () => supabase.from('companies').select('*').order('sort_order').then(({ data }) => setRows((data ?? []) as any))
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!editing) return
    if (editing.id) await supabase.from('companies').update(editing).eq('id', editing.id)
    else await supabase.from('companies').insert(editing)
    setEditing(null); load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div><Eyebrow>Companies</Eyebrow><H1 className="chrome-text">Companies directory</H1></div>
        <button className="btn-primary" onClick={() => setEditing({ slug: '', name: '', status: 'COMING_SOON' })}>Add company</button>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted">
            <tr><th className="text-left py-2">Name</th><th>Slug</th><th>Status</th><th>Featured</th><th>Sort</th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="table-row">
                <td className="py-2">{c.name}</td>
                <td className="text-xs text-muted">{c.slug}</td>
                <td><Chip>{c.status.replace('_',' ')}</Chip></td>
                <td>{c.featured ? '★' : ''}</td>
                <td>{c.sort_order}</td>
                <td><button className="text-xs text-primary" onClick={() => setEditing(c)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editing && (
        <Card>
          <H1 className="text-2xl">{editing.id ? 'Edit company' : 'New company'}</H1>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Slug" value={editing.slug ?? ''} onChange={(v) => setEditing({ ...editing, slug: v })} />
            <Field label="Name" value={editing.name ?? ''} onChange={(v) => setEditing({ ...editing, name: v })} />
            <Field label="Tagline" value={editing.tagline ?? ''} onChange={(v) => setEditing({ ...editing, tagline: v })} />
            <Field label="Status" value={editing.status ?? ''} onChange={(v) => setEditing({ ...editing, status: v as any })} />
            <Field label="Website" value={editing.website ?? ''} onChange={(v) => setEditing({ ...editing, website: v })} />
            <Field label="Google Play URL" value={editing.play_url ?? ''} onChange={(v) => setEditing({ ...editing, play_url: v })} />
            <Field label="App Store URL" value={editing.store_url ?? ''} onChange={(v) => setEditing({ ...editing, store_url: v })} />
            <Field label="Sort order" value={String(editing.sort_order ?? 100)} onChange={(v) => setEditing({ ...editing, sort_order: Number(v) })} />
            <Field label="Featured" value={String(editing.featured ?? false)} onChange={(v) => setEditing({ ...editing, featured: v === 'true' })} />
            <Field label="Launch date" value={editing.launch_date ?? ''} onChange={(v) => setEditing({ ...editing, launch_date: v })} />
            <div className="md:col-span-2"><label className="label">Description</label><textarea className="input" rows={4} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
          </div>
          <div className="mt-5 flex gap-2">
            <button className="btn-primary" onClick={save}>Save</button>
            <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </Card>
      )}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}