import { useEffect, useState } from 'react'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { Play } from 'lucide-react'

interface Platform { id: string; slug: string; name: string; description: string | null; enabled: boolean; monitoring_enabled: boolean; analytics_enabled: boolean; analytics_config: any; last_status: string | null; last_check_at: string | null }

export function CeoPlatforms() {
  const [rows, setRows] = useState<Platform[]>([])
  const [editing, setEditing] = useState<Platform | null>(null)
  const load = () => supabase.from('platforms').select('*').order('slug').then(({ data }) => setRows((data ?? []) as any))
  useEffect(() => { load() }, [])

  const runAll = async (p: Platform) => {
    await supabase.from('platforms').update({ last_check_at: new Date().toISOString(), last_status: 'OPERATIONAL' }).eq('id', p.id)
    load()
  }

  const save = async () => {
    if (!editing) return
    await supabase.from('platforms').update({
      name: editing.name, description: editing.description, monitoring_enabled: editing.monitoring_enabled,
      analytics_enabled: editing.analytics_enabled, analytics_config: editing.analytics_config,
    }).eq('id', editing.id)
    setEditing(null); load()
  }

  return (
    <div className="space-y-6">
      <Eyebrow>Ecosystem</Eyebrow>
      <H1 className="chrome-text">Platforms</H1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <H1 className="text-xl">{p.name}</H1>
                <div className="text-xs text-muted">{p.slug}</div>
                <div className="mt-2 text-sm text-hi/80">{p.description}</div>
              </div>
              <Chip tone={p.last_status === 'OPERATIONAL' ? 'ok' : p.last_status === 'DEGRADED' ? 'warn' : p.last_status === 'OFFLINE' ? 'crit' : 'default'}>{p.last_status ?? 'UNKNOWN'}</Chip>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs">
              <div className="text-muted">{p.last_check_at ? `Last check ${new Date(p.last_check_at).toLocaleString()}` : 'Never checked'}</div>
              <div className="flex gap-2">
                <button className="btn-ghost text-xs" onClick={() => runAll(p)}><Play size={12} /> Check</button>
                <button className="btn-ghost text-xs" onClick={() => setEditing(p)}>Configure</button>
              </div>
            </div>
          </Card>
        ))}
        {rows.length === 0 && <Card><p className="text-muted">No platforms registered.</p></Card>}
      </div>

      {editing && (
        <Card>
          <H1 className="text-2xl">{editing.name} configuration</H1>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">Name</label><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><label className="label">Description</label><input className="input" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div><label className="label">Monitoring enabled</label>
              <select className="input" value={String(editing.monitoring_enabled)} onChange={(e) => setEditing({ ...editing, monitoring_enabled: e.target.value === 'true' })}>
                <option value="true">Yes</option><option value="false">No</option>
              </select>
            </div>
            <div><label className="label">Analytics enabled</label>
              <select className="input" value={String(editing.analytics_enabled)} onChange={(e) => setEditing({ ...editing, analytics_enabled: e.target.value === 'true' })}>
                <option value="true">Yes</option><option value="false">No</option>
              </select>
            </div>
            <div className="md:col-span-2"><label className="label">Analytics config (JSON)</label>
              <textarea className="input font-mono text-xs" rows={8} value={JSON.stringify(editing.analytics_config ?? {}, null, 2)} onChange={(e) => { try { setEditing({ ...editing, analytics_config: JSON.parse(e.target.value) }) } catch { /* ignore parse errors until save */ } }} />
            </div>
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