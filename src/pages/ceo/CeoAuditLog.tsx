import { useEffect, useState } from 'react'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function CeoAuditLog() {
  const [rows, setRows] = useState<any[]>([])
  const [filter, setFilter] = useState('')
  useEffect(() => {
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setRows(data ?? []))
  }, [])
  const filtered = rows.filter((r) => !filter || r.action?.includes(filter) || r.target?.includes(filter))
  return (
    <div className="space-y-6">
      <Eyebrow>Security</Eyebrow>
      <H1 className="chrome-text">Audit log</H1>
      <div className="flex gap-2 items-center">
        <input className="input max-w-sm" placeholder="Filter by action or target" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className="text-xs text-muted">{filtered.length} entries</span>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted">
            <tr><th className="text-left py-2">Time</th><th>Action</th><th>Target</th><th>Result</th><th>Reason</th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="py-2 text-xs text-muted whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="font-mono text-xs">{r.action}</td>
                <td className="text-xs">{r.target ?? '—'}</td>
                <td><Chip tone={r.result === 'OK' ? 'ok' : r.result === 'BLOCKED' ? 'err' : 'warn'}>{r.result ?? '—'}</Chip></td>
                <td className="text-xs text-muted">{r.reason ?? '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted">No entries.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}