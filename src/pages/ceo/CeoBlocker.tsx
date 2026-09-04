import { useEffect, useState } from 'react'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function CeoBlocker() {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    supabase.from('universal_blocker_events').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setRows(data ?? []))
  }, [])
  return (
    <div className="space-y-6">
      <Eyebrow>Security</Eyebrow>
      <H1 className="chrome-text">Universal Blocker</H1>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted">
            <tr><th className="text-left py-2">Time</th><th>Action</th><th>Actor</th><th>Code</th><th>Reason</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="py-2 text-xs text-muted">{new Date(r.created_at).toLocaleString()}</td>
                <td className="font-mono text-xs">{r.action}</td>
                <td className="text-xs">{r.actor_email ?? '—'} ({r.actor_role ?? '—'})</td>
                <td><Chip tone={r.code === 'BLOCKED' ? 'err' : 'warn'}>{r.code ?? '—'}</Chip></td>
                <td className="text-xs text-muted">{r.reason ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted">No blocked events recorded. System operating normally.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}