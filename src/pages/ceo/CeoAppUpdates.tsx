import { useEffect, useState } from 'react'
import { H1, H2, H3, Eyebrow, Card, Chip, StatusDot, Skeleton } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Plus, Edit3, Trash2, Download, X, Globe } from 'lucide-react'
import { format } from 'date-fns'

interface Platform {
  id: string
  slug: string
  name: string
  description: string | null
  maiupdate_url: string | null
  last_sync_at: string | null
  enabled: boolean
}

interface PlatformApp {
  id: string
  platform_id: string
  name: string
  version: string
  build_number: string | null
  download_url: string | null
  file_size: number | null
  icon_url: string | null
  description: string | null
  app_status: string
  release_time: string
  is_latest: boolean
  created_at: string
}

interface AppUpdate {
  id: string
  platform_id: string
  app_id: string | null
  version: string
  title: string
  description: string | null
  release_notes: string | null
  release_time: string
  download_url: string | null
  file_size: number | null
  is_featured: boolean
  update_type: string
  status: string
  published_at: string | null
  synced_from_maiupdate: boolean
  created_at: string
}

type ModalMode = 'app' | 'update' | 'url' | 'preview'

export function CeoAppUpdates() {
  const { user } = useAuth()
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [apps, setApps] = useState<PlatformApp[]>([])
  const [updates, setUpdates] = useState<AppUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalMode | null>(null)
  const [editApp, setEditApp] = useState<Partial<PlatformApp> | null>(null)
  const [editUpdate, setEditUpdate] = useState<Partial<AppUpdate> | null>(null)
  const [editPlatform, setEditPlatform] = useState<Platform | null>(null)
  const [previewData, setPreviewData] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      supabase.from('platforms').select('id,slug,name,description,maiupdate_url,last_sync_at,enabled').order('slug'),
      supabase.from('platform_apps').select('*').order('created_at', { ascending: false }),
      supabase.from('app_updates').select('*').order('release_time', { ascending: false }),
    ]).then(([p, a, u]) => {
      setPlatforms((p.data ?? []) as any)
      setApps((a.data ?? []) as any)
      setUpdates((u.data ?? []) as any)
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  const platformName = (id: string) => platforms.find((p) => p.id === id)?.name ?? '—'

  const openAppModal = (app?: PlatformApp) => {
    setEditApp(app ? { ...app } : { platform_id: '', version: '', app_status: 'CURRENT', is_latest: true, release_time: new Date().toISOString().slice(0, 16) })
    setModal('app')
  }

  const openUpdateModal = (upd?: AppUpdate) => {
    setEditUpdate(upd ? { ...upd } : { platform_id: '', version: '', title: '', update_type: 'feature', status: 'PUBLISHED', release_time: new Date().toISOString().slice(0, 16), is_featured: false, published_at: '' })
    setModal('update')
  }

  const openUrlModal = (p: Platform) => {
    setEditPlatform({ ...p })
    setModal('url')
  }

  const saveApp = async (data: Partial<PlatformApp>) => {
    if (!data || !data.platform_id) return
    const payload: any = { ...data }
    delete payload.id
    if (data.id) {
      await supabase.from('platform_apps').update(payload).eq('id', data.id)
    } else {
      await supabase.from('platform_apps').insert(payload)
    }
    await logAudit(data.id ? 'APP_UPDATED' : 'APP_CREATED', data.id ?? '', 'OK')
    setModal(null); setEditApp(null); load()
  }

  const saveUpdate = async (data: Partial<AppUpdate>) => {
    if (!data || !data.platform_id) return
    const payload: any = { ...data }
    delete payload.id
    if (payload.published_at === '') payload.published_at = null
    if (data.id) {
      await supabase.from('app_updates').update(payload).eq('id', data.id)
    } else {
      await supabase.from('app_updates').insert(payload)
    }
    await logAudit(data.id ? 'UPDATE_EDITED' : 'UPDATE_CREATED', data.id ?? '', 'OK')
    setModal(null); setEditUpdate(null); load()
  }

  const saveUrl = async (url: string) => {
    if (!editPlatform) return
    await supabase.from('platforms').update({ maiupdate_url: url }).eq('id', editPlatform.id)
    setModal(null); setEditPlatform(null); load()
  }

  const syncMaiUpdate = async (p: Platform) => {
    setPreviewData(null); setPreviewLoading(true); setModal('preview')
    const url = p.maiupdate_url
    if (!url) {
      alert(`No MAIUPDATE.json URL configured for ${p.name}. Set one first.`)
      setModal(null); setPreviewLoading(false); return
    }
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPreviewData({ platform: p, data })
      await logAudit('MAIUPDATE_FETCHED', p.id, 'OK')
    } catch (e: any) {
      setPreviewData({ platform: p, error: e.message })
      alert(`Could not fetch MAIUPDATE.json for ${p.name}:\n${e.message}`)
    } finally {
      setPreviewLoading(false)
    }
  }

  const applyPreview = async () => {
    if (!previewData?.data || !previewData.platform) return
    const { app, slug, version, status, updates } = previewData.data
    const platform = previewData.platform as Platform
    try {
      if (app && version) {
        await supabase.from('platform_apps').upsert({
          id: undefined,
          platform_id: platform.id,
          name: app,
          version,
          app_status: status || 'CURRENT',
          is_latest: true,
          release_time: new Date().toISOString(),
        }, { onConflict: 'platform_id' })
      }
      if (Array.isArray(updates)) {
        for (const u of updates) {
          await supabase.rpc('upsert_app_update', {
            p_platform_slug: slug || platform.slug,
            p_version: u.version,
            p_title: u.title,
            p_description: u.description,
            p_release_notes: u.release_notes ?? u.description,
            p_release_time: u.date ? new Date(u.date).toISOString() : new Date().toISOString(),
            p_download_url: u.download_url ?? null,
            p_icon_url: u.icon_url ?? null,
            p_update_type: u.type || 'feature',
            p_is_featured: u.featured || false,
            p_status: 'PUBLISHED',
          })
        }
      }
      await supabase.from('platforms').update({ last_sync_at: new Date().toISOString() }).eq('id', platform.id)
      setModal(null); setPreviewData(null); load()
      await logAudit('MAIUPDATE_SYNCED', platform.id, 'OK')
    } catch (e: any) {
      alert(`Sync error: ${e.message}`)
    }
  }

  const downloadPreviewPdf = () => {
    if (!previewData) return
    const { platform, data } = previewData
    const lines: string[] = []
    lines.push('MAI CORP — MAIUPDATE.json Preview')
    lines.push('=================================')
    lines.push(`Platform: ${platform?.name ?? '—'} (${platform?.slug ?? '—'})`)
    lines.push(`URL: ${platform?.maiupdate_url ?? '—'}`)
    lines.push('')
    lines.push(JSON.stringify(data, null, 2))
    const blob = new Blob([lines.join('\n')], { type: 'application/pdf' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${platform?.slug ?? 'app'}-maiupdate.pdf`
    a.click()
  }

  const removeUpdate = async (id: string) => {
    if (!confirm('Delete this update?')) return
    await supabase.from('app_updates').delete().eq('id', id)
    load()
  }

  const removeApp = async (id: string) => {
    if (!confirm('Delete this app upload?')) return
    await supabase.from('platform_apps').delete().eq('id', id)
    load()
  }

  const logAudit = async (action: string, target: string, result: string) => {
    try {
      await supabase.from('audit_logs').insert({
        actor_id: user?.id,
        action,
        target,
        result,
      })
    } catch {}
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Eyebrow>App Updates</Eyebrow>
          <H1 className="mt-2 chrome-text">App Updates Hub</H1>
          <p className="mt-2 text-sm text-muted max-w-2xl">
            Manage apps and updates for all MAI Corp platforms. Updates can be published manually
            or synced automatically from each project's <code className="text-primary">MAIUPDATE.json</code> file on git push.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => openAppModal()}><Plus size={16} /> Upload app</button>
          <button className="btn-ghost" onClick={() => openUpdateModal()}><Plus size={16} /> Add update</button>
        </div>
      </div>

      {/* Platforms + MAIUPDATE sources */}
      <Card>
        <H2 className="text-xl mb-4">Platforms &amp; MAIUPDATE sources</H2>
        <div className="space-y-3">
          {platforms.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 border border-line/30">
              <div className="flex items-center gap-3">
                <StatusDot tone={p.enabled ? 'ok' : 'unknown'} />
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted">{p.slug}</div>
                  {p.last_sync_at && <div className="text-xs text-muted mt-0.5">Last synced {format(new Date(p.last_sync_at), 'PPpp')}</div>}
                </div>
              </div>
              <div className="flex gap-2">
                {p.maiupdate_url && (
                  <button className="btn-ghost text-xs" onClick={() => syncMaiUpdate(p)} title="Fetch & preview MAIUPDATE.json">
                    <Globe size={12} /> Sync
                  </button>
                )}
                <button className="btn-ghost text-xs" onClick={() => openUrlModal(p)} title="Edit MAIUPDATE source URL">
                  <Edit3 size={12} /> URL
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Uploaded apps */}
      <Card>
        <div className="flex items-center justify-between">
          <H2 className="text-xl">Uploaded apps</H2>
          <button className="btn-ghost text-xs" onClick={() => openAppModal()}><Plus size={12} /> Upload app</button>
        </div>
        {loading ? <Skeleton className="h-12 w-full" /> : (
          apps.length === 0 ? <p className="mt-4 text-sm text-muted">No apps uploaded yet.</p> : (
            <div className="mt-4 space-y-2">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-widest text-muted">
                  <tr><th className="text-left py-1">App</th><th>Platform</th><th>Version</th><th>Status</th><th>Released</th><th></th></tr>
                </thead>
                <tbody>
                  {apps.map((a) => (
                    <tr key={a.id} className="table-row">
                      <td className="py-1">{a.name}</td>
                      <td className="text-xs text-muted">{platformName(a.platform_id)}</td>
                      <td><Chip tone="info">v{a.version}</Chip></td>
                      <td><Chip tone={a.app_status === 'CURRENT' ? 'ok' : a.app_status === 'BETA' ? 'warn' : 'default'}>{a.app_status.replace('_',' ')}</Chip></td>
                      <td className="text-xs text-muted">{a.release_time ? format(new Date(a.release_time), 'PP') : '—'}</td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          <button className="text-xs text-muted hover:text-hi" onClick={() => openAppModal(a)}><Edit3 size={12} /></button>
                          <button className="text-xs text-err hover:text-crit" onClick={() => removeApp(a.id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Card>

      {/* All updates */}
      <Card>
        <div className="flex items-center justify-between">
          <H2 className="text-xl">All updates</H2>
          <button className="btn-ghost text-xs" onClick={() => openUpdateModal()}><Plus size={12} /> Add update</button>
        </div>
        {loading ? <Skeleton className="h-12 w-full" /> : (
          updates.length === 0 ? <p className="mt-4 text-sm text-muted">No updates yet.</p> : (
            <div className="mt-4 space-y-2 max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-widest text-muted">
                  <tr><th className="text-left py-1">Title</th><th>Platform</th><th>Version</th><th>Type</th><th>Date</th><th>Status</th><th>Synced</th><th></th></tr>
                </thead>
                <tbody>
                  {updates.map((u) => (
                    <tr key={u.id} className="table-row">
                      <td className="py-1">{u.title}</td>
                      <td className="text-xs text-muted">{platformName(u.platform_id)}</td>
                      <td><Chip tone="info">v{u.version}</Chip></td>
                      <td className="text-xs text-muted">{u.update_type}</td>
                      <td className="text-xs text-muted">{u.release_time ? format(new Date(u.release_time), 'PP') : '—'}</td>
                      <td><Chip tone={u.status === 'PUBLISHED' ? 'ok' : 'warn'}>{u.status}</Chip></td>
                      <td>{u.synced_from_maiupdate ? '✓' : ''}</td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          <button className="text-xs text-muted hover:text-hi" onClick={() => openUpdateModal(u)}><Edit3 size={12} /></button>
                          <button className="text-xs text-err hover:text-crit" onClick={() => removeUpdate(u.id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Card>

      {/* Modal: Upload App / Add Update / Edit URL / Preview MAIUPDATE */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-4 overflow-y-auto">
          {modal === 'preview' && previewLoading ? (
            <Card className="w-full max-w-lg">
              <H3>Syncing…</H3>
              <p className="mt-4 text-muted">Fetching MAIUPDATE.json…</p>
              <Skeleton className="h-4 w-full mt-2" />
            </Card>
          ) : modal === 'preview' && previewData ? (
            <PreviewModal previewData={previewData} onApply={applyPreview} onDownload={downloadPreviewPdf} onClose={() => { setModal(null); setPreviewData(null) }} />
          ) : modal === 'app' && editApp ? (
            <AppForm app={editApp} platforms={platforms} onSave={saveApp} onCancel={() => { setModal(null); setEditApp(null) }} />
          ) : modal === 'update' && editUpdate ? (
            <UpdateForm update={editUpdate} platforms={platforms} apps={apps} onSave={saveUpdate} onCancel={() => { setModal(null); setEditUpdate(null) }} />
          ) : modal === 'url' && editPlatform ? (
            <UrlForm platform={editPlatform} onSave={saveUrl} onCancel={() => { setModal(null); setEditPlatform(null) }} />
          ) : null}
        </div>
      )}
    </div>
  )
}

function AppForm({ app, platforms, onSave, onCancel }: {
  app: Partial<PlatformApp>; platforms: Platform[]; onSave: (data: Partial<PlatformApp>) => void; onCancel: () => void
}) {
  const [local, setLocal] = useState(app)
  const update = (k: string, v: any) => setLocal((prev: any) => ({ ...prev, [k]: v }))
  return (
    <Card className="w-full max-w-2xl">
      <div className="flex items-center justify-between">
        <H3>{local.id ? 'Edit app' : 'Upload app'}</H3>
        <button className="p-2 rounded-md hover:bg-white/5" onClick={onCancel}><X size={16} /></button>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label className="label">Platform</label>
          <select className="input" value={local.platform_id ?? ''} onChange={(e) => update('platform_id', e.target.value)}>
            <option value="">Select platform</option>
            {platforms.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.slug})</option>)}</select>
        </div>
        <div><label className="label">App name</label><input className="input" value={local.name ?? ''} onChange={(e) => update('name', e.target.value)} /></div>
        <div><label className="label">Version</label><input className="input" value={local.version ?? ''} onChange={(e) => update('version', e.target.value)} /></div>
        <div><label className="label">Build number</label><input className="input" value={local.build_number ?? ''} onChange={(e) => update('build_number', e.target.value)} /></div>
        <div><label className="label">Release time</label><input className="input" type="datetime-local" value={(local.release_time ?? '').slice(0, 16)} onChange={(e) => update('release_time', e.target.value ? new Date(e.target.value).toISOString() : '')} /></div>
        <div><label className="label">App status</label>
          <select className="input" value={local.app_status ?? 'CURRENT'} onChange={(e) => update('app_status', e.target.value)}>
            <option value="CURRENT">Current</option><option value="BETA">Beta</option><option value="DEPRECATED">Deprecated</option>
          </select>
        </div>
        <div><label className="label">Is latest</label>
          <select className="input" value={String(local.is_latest ?? true)} onChange={(e) => update('is_latest', e.target.value === 'true')}>
            <option value="true">Yes</option><option value="false">No</option>
          </select>
        </div>
        <div className="md:col-span-2"><label className="label">Download URL</label><input className="input" value={local.download_url ?? ''} onChange={(e) => update('download_url', e.target.value)} /></div>
        <div className="md:col-span-2"><label className="label">File size (bytes)</label><input className="input" type="number" value={local.file_size ?? ''} onChange={(e) => update('file_size', e.target.value ? Number(e.target.value) : null)} /></div>
        <div className="md:col-span-2"><label className="label">Description</label><textarea className="input" rows={3} value={local.description ?? ''} onChange={(e) => update('description', e.target.value)}></textarea></div>
      </div>
      <div className="mt-5 flex gap-2 justify-end">
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={() => onSave(local)}>{local.id ? 'Save' : 'Upload'}</button>
      </div>
    </Card>
  )
}

function UpdateForm({ update: initialU, platforms, apps, onSave, onCancel }: {
  update: Partial<AppUpdate>; platforms: Platform[]; apps: PlatformApp[]; onSave: (data: Partial<AppUpdate>) => void; onCancel: () => void
}) {
  const [u, setU] = useState<Partial<AppUpdate>>(initialU)
  const set = (k: string, v: any) => setU((prev: any) => ({ ...prev, [k]: v }))
  const handleReleaseTime = (e: any) => {
    const val = e.target.value
    set('release_time', val ? new Date(val).toISOString() : '')
  }
  const handlePublishedAt = (e: any) => {
    const val = e.target.value
    set('published_at', val ? new Date(val).toISOString() : '')
  }
  return (
    <Card className="w-full max-w-2xl">
      <div className="flex items-center justify-between">
        <H3>{u.id ? 'Edit update' : 'Add update'}</H3>
        <button className="p-2 rounded-md hover:bg-white/5" onClick={onCancel}><X size={16} /></button>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label className="label">Platform</label>
          <select className="input" value={u.platform_id ?? ''} onChange={(e) => set('platform_id', e.target.value)}>
            <option value="">Select platform</option>
            {platforms.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.slug})</option>)}
          </select>
        </div>
        <div><label className="label">App (optional)</label>
          <select className="input" value={u.app_id ?? ''} onChange={(e) => set('app_id', e.target.value || null)}>
            <option value="">None</option>
            {apps.filter((a) => a.platform_id === u.platform_id).map((a) => <option key={a.id} value={a.id}>v{a.version} — {a.name}</option>)}
          </select>
        </div>
        <div><label className="label">Version</label><input className="input" value={u.version ?? ''} onChange={(e) => set('version', e.target.value)} /></div>
        <div><label className="label">Title</label><input className="input" value={u.title ?? ''} onChange={(e) => set('title', e.target.value)} /></div>
        <div><label className="label">Update type</label>
          <select className="input" value={u.update_type ?? 'feature'} onChange={(e) => set('update_type', e.target.value)}>
            <option value="major">Major</option><option value="feature">Feature</option><option value="fix">Fix</option><option value="security">Security</option><option value="announcement">Announcement</option>
          </select>
        </div>
        <div><label className="label">Release time</label><input className="input" type="datetime-local" value={(u.release_time ?? '').slice(0, 16)} onChange={handleReleaseTime} /></div>
        <div><label className="label">Status</label>
          <select className="input" value={u.status ?? 'PUBLISHED'} onChange={(e) => set('status', e.target.value)}>
            <option value="PUBLISHED">Published</option><option value="DRAFT">Draft</option>
          </select>
        </div>
        <div><label className="label">Published at</label><input className="input" type="datetime-local" value={(u.published_at ?? '').slice(0, 16)} onChange={handlePublishedAt} /></div>
        <div className="md:col-span-2"><label className="label">Description (friendly, user-readable)</label><textarea className="input" rows={3} value={u.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="A friendly summary that users will read."></textarea></div>
        <div className="md:col-span-2"><label className="label">Release notes</label><textarea className="input" rows={4} value={u.release_notes ?? ''} onChange={(e) => set('release_notes', e.target.value)}></textarea></div>
        <div><label className="label">Download URL</label><input className="input" value={u.download_url ?? ''} onChange={(e) => set('download_url', e.target.value)} /></div>
        <div><label className="label">Is featured</label>
          <select className="input" value={String(u.is_featured ?? false)} onChange={(e) => set('is_featured', e.target.value === 'true')}>
            <option value="false">No</option><option value="true">Yes</option>
          </select>
        </div>
      </div>
      <div className="mt-5 flex gap-2 justify-end">
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={() => onSave(u)}>{u.id ? 'Save' : 'Create'}</button>
      </div>
    </Card>
  )
}

function UrlForm({ platform, onSave, onCancel }: {
  platform: Platform; onSave: (url: string) => void; onCancel: () => void
}) {
   const [url, setUrl] = useState(platform.maiupdate_url ?? '')
  const save = () => { onSave(url) }
  return (
    <Card className="w-full max-w-lg">
      <div className="flex items-center justify-between">
        <H3>MAIUPDATE source — {platform.name}</H3>
        <button className="p-2 rounded-md hover:bg-white/5" onClick={onCancel}><X size={16} /></button>
      </div>
      <div className="mt-4">
        <label className="label">MAIUPDATE.json URL</label>
        <input
          className="input font-mono text-xs"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://raw.githubusercontent.com/Org/Repo/main/MAIUPDATE.json"
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        This URL should point to the raw MAIUPDATE.json file in the project's git repo.
        On each git push, a webhook or manual sync fetches this file and publishes the updates.
      </p>
      <div className="mt-5 flex gap-2 justify-end">
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={save}>Save URL</button>
      </div>
    </Card>
  )
}

function PreviewModal({ previewData, onApply, onDownload, onClose }: {
  previewData: any; onApply: () => void; onDownload: () => void; onClose: () => void
}) {
  const { platform, data, error } = previewData
  return (
    <Card className="w-full max-w-2xl">
      <div className="flex items-center justify-between">
        <H3>MAIUPDATE.json preview — {platform?.name}</H3>
        <div className="flex gap-1">
          <button className="p-2 rounded-md hover:bg-white/5" onClick={onDownload} title="Download as PDF"><Download size={16} /></button>
          <button className="p-2 rounded-md hover:bg-white/5" onClick={onClose}><X size={16} /></button>
        </div>
      </div>
      {error ? (
        <pre className="mt-4 text-xs text-err whitespace-pre-wrap">{error}</pre>
      ) : data ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted text-xs uppercase">App</span><div>{data.app ?? '—'}</div></div>
            <div><span className="text-muted text-xs uppercase">Version</span><div>{data.version ?? '—'}</div></div>
            <div><span className="text-muted text-xs uppercase">Status</span><div>{data.status ?? '—'}</div></div>
            <div><span className="text-muted text-xs uppercase">Updates count</span><div>{Array.isArray(data.updates) ? data.updates.length : 0}</div></div>
          </div>
          {data.links && (
            <div className="mt-4">
              <span className="text-muted text-xs uppercase">Links</span>
              <pre className="mt-1 text-xs text-hi/70 font-mono">{JSON.stringify(data.links, null, 2)}</pre>
            </div>
          )}
          <div className="mt-4">
            <span className="text-muted text-xs uppercase">Update list</span>
            {Array.isArray(data.updates) && data.updates.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {data.updates.map((u: any, i: number) => (
                  <li key={i} className="text-xs text-hi/80 border-l border-line/30 pl-3">
                    <strong>v{u.version}</strong> — {u.title} ({u.date}) — {u.type}
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted mt-1">No updates listed.</p>}
          </div>
          <div className="mt-5 flex gap-2 justify-end">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={onApply}>Apply to database</button>
          </div>
        </>
      ) : null}
    </Card>
  )
}
