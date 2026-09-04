import { useEffect, useState } from 'react'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

interface Announcement { id: string; title: string; body: string | null; status: string; featured: boolean; publish_at: string | null; expire_at: string | null; company_id: string | null }

export function CeoAnnouncements() {
  const [rows, setRows] = useState<Announcement[]>([])
  const [editing, setEditing] = useState<Partial<Announcement> | null>(null)
  const [companies, setCompanies] = useState<any[]>([])
  const load = () => supabase.from('announcements').select('*').order('created_at', { ascending: false }).then(({ data }) => setRows((data ?? []) as any))
  useEffect(() => { load(); supabase.from('companies').select('id,name').then(({ data }) => setCompanies(data ?? [])) }, [])
  const save = async () => {
    if (!editing) return
    const payload: any = { ...editing }
    if (editing.id) await supabase.from('announcements').update(payload).eq('id', editing.id)
    else await supabase.from('announcements').insert(payload)
    setEditing(null); load()
  }
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div><Eyebrow>Communications</Eyebrow><H1 className="chrome-text">Announcements</H1></div>
        <button className="btn-primary" onClick={() => setEditing({ title: '', body: '', status: 'DRAFT', featured: false })}>New announcement</button>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted">
            <tr><th className="text-left py-2">Title</th><th>Status</th><th>Featured</th><th>Publish</th><th>Expire</th></tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="table-row">
                <td className="py-2">{a.title}</td>
                <td><Chip tone={a.status === 'PUBLISHED' ? 'ok' : a.status === 'ARCHIVED' ? 'default' : 'info'}>{a.status}</Chip></td>
                <td>{a.featured ? '★' : ''}</td>
                <td className="text-xs text-muted">{a.publish_at ?? '—'}</td>
                <td className="text-xs text-muted">{a.expire_at ?? '—'}</td>
                <td><button className="text-xs text-primary" onClick={() => setEditing(a)}>Edit</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">No announcements.</td></tr>}
          </tbody>
        </table>
      </Card>

      {editing && (
        <Card>
          <H1 className="text-2xl">{editing.id ? 'Edit announcement' : 'New announcement'}</H1>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">Title</label><input className="input" value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
            <div><label className="label">Company</label>
              <select className="input" value={editing.company_id ?? ''} onChange={(e) => setEditing({ ...editing, company_id: e.target.value || null })}>
                <option value="">— None —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">Status</label>
              <select className="input" value={editing.status ?? 'DRAFT'} onChange={(e) => setEditing({ ...editing, status: e.target.value as any })}>
                {['DRAFT','PUBLISHED','ARCHIVED'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Featured</label>
              <select className="input" value={String(editing.featured ?? false)} onChange={(e) => setEditing({ ...editing, featured: e.target.value === 'true' })}>
                <option value="false">No</option><option value="true">Yes</option>
              </select>
            </div>
            <div><label className="label">Publish at</label><input className="input" type="datetime-local" value={(editing.publish_at ?? '').slice(0,16)} onChange={(e) => setEditing({ ...editing, publish_at: e.target.value || null })} /></div>
            <div><label className="label">Expire at</label><input className="input" type="datetime-local" value={(editing.expire_at ?? '').slice(0,16)} onChange={(e) => setEditing({ ...editing, expire_at: e.target.value || null })} /></div>
            <div className="md:col-span-2"><label className="label">Body</label><textarea className="input" rows={5} value={editing.body ?? ''} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={save}>Save</button>
            <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </Card>
      )}
    </div>
  )
}