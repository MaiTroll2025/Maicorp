import { useEffect, useState } from 'react'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

interface Platform { id: string; slug: string; name: string; description: string | null; enabled: boolean; monitoring_enabled: boolean; analytics_enabled: boolean; analytics_config: any; last_status: string | null; last_check_at: string | null }

export function CeoAnalytics() {
  const [rows, setRows] = useState<Platform[]>([])
  useEffect(() => {
    supabase.from('platforms').select('*').order('slug').then(({ data }) => setRows((data ?? []) as any))
  }, [])
  return (
    <div className="space-y-6">
      <Eyebrow>Ecosystem</Eyebrow>
      <H1 className="chrome-text">Analytics center</H1>
      <p className="text-muted text-sm">Each platform's analytics configuration is read-only here; configure values on the Platforms page.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-2">
              <div><H1 className="text-xl">{p.name}</H1><div className="text-xs text-muted">{p.slug}</div></div>
              <Chip tone={p.analytics_enabled ? 'ok' : 'default'}>{p.analytics_enabled ? 'Configured' : 'Disabled'}</Chip>
            </div>
            <pre className="mt-3 text-xs text-muted whitespace-pre-wrap">{JSON.stringify(p.analytics_config ?? {}, null, 2)}</pre>
            <div className="mt-3 text-xs text-muted">
              {Object.keys(p.analytics_config ?? {}).length === 0
                ? 'No analytics source configured. Add one to enable metrics.'
                : 'Metrics depend on the underlying platform schema. Unavailable data is shown as "Unavailable".'}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}