import { useEffect, useState } from 'react'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function CeoDonations() {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    supabase.from('support_donations').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setRows(data ?? []))
  }, [])
  return (
    <div className="space-y-6">
      <Eyebrow>Communications</Eyebrow>
      <H1 className="chrome-text">Support / Donations</H1>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted"><tr><th className="text-left py-2">Date</th><th>Name</th><th>Email</th><th>Amount</th><th>Status</th><th>Message</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="py-2 text-xs text-muted whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.name ?? '—'}</td>
                <td className="text-xs">{r.email ?? '—'}</td>
                <td>${(r.amount_cents / 100).toFixed(2)}</td>
                <td><Chip tone={r.status === 'COMPLETED' ? 'ok' : r.status === 'FAILED' ? 'err' : 'info'}>{r.status}</Chip></td>
                <td className="text-xs text-muted max-w-[300px] truncate">{r.message ?? ''}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">No donations yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}