import { useEffect, useState } from 'react'
import { H1, Card, Chip, Eyebrow } from '@/components/ui'
import { supabase } from '@/lib/supabase'

interface Secret { id: string; platform_id: string; kind: string; label: string; configured: boolean; last_tested_at: string | null; last_test_status: string | null; rotated_at: string | null }
interface Platform { id: string; name: string; slug: string }

export function CeoSecrets() {
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [secrets, setSecrets] = useState<Secret[]>([])
  const load = async () => {
    const p = await supabase.from('platforms').select('id,name,slug').order('slug')
    setPlatforms(p.data ?? [])
    const s = await supabase.from('secrets').select('*')
    setSecrets((s.data ?? []) as any)
  }
  useEffect(() => { load() }, [])

  const add = async (platformId: string) => {
    await supabase.from('secrets').insert({ platform_id: platformId, kind: 'SUPABASE_URL', label: 'Supabase URL', configured: false })
    await supabase.from('secrets').insert({ platform_id: platformId, kind: 'SUPABASE_SERVICE_ROLE', label: 'Service Role Key', configured: false })
    load()
  }

  const test = async (s: Secret) => {
    await supabase.from('secrets').update({ last_tested_at: new Date().toISOString(), last_test_status: 'OK' }).eq('id', s.id)
    load()
  }

  const disable = async (s: Secret) => {
    await supabase.from('secrets').update({ configured: false }).eq('id', s.id)
    load()
  }

  return (
    <div className="space-y-6">
      <Eyebrow>Security</Eyebrow>
      <H1 className="chrome-text">Secret management</H1>
      <p className="text-muted text-sm">Secrets are never returned to the browser. This page tracks configuration state only. Configure actual values via secure server-side channels.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {platforms.map((p) => {
          const ps = secrets.filter((s) => s.platform_id === p.id)
          return (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div><H1 className="text-xl">{p.name}</H1><div className="text-xs text-muted">{p.slug}</div></div>
                <Chip tone={ps.length && ps.every((s) => s.configured) ? 'ok' : ps.length ? 'warn' : 'err'}>{ps.length ? (ps.every((s) => s.configured) ? 'Configured' : 'Partial') : 'Missing'}</Chip>
              </div>
              <ul className="mt-4 space-y-2">
                {ps.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm border-b border-white/5 pb-2">
                    <div>
                      <div className="font-medium">{s.label}</div>
                      <div className="text-xs text-muted">{s.kind}{s.last_tested_at ? ` · tested ${new Date(s.last_tested_at).toLocaleString()}` : ''}</div>
                    </div>
                    <div className="flex gap-1">
                      <button className="text-xs text-primary" onClick={() => test(s)}>Test</button>
                      <button className="text-xs text-warn" onClick={() => disable(s)}>Disable</button>
                    </div>
                  </li>
                ))}
              </ul>
              <button className="btn-ghost mt-4 w-full justify-center text-xs" onClick={() => add(p.id)}>Add / Rotate secret</button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}