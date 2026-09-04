import { useEffect, useState } from 'react'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function CeoContactInbox() {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    supabase.from('contact_submissions').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setRows(data ?? []))
  }, [])
  return (
    <div className="space-y-6">
      <Eyebrow>Communications</Eyebrow>
      <H1 className="chrome-text">Contact inbox</H1>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted"><tr><th className="text-left py-2">Date</th><th>Name</th><th>Email</th><th>Category</th><th>Subject</th><th>Body</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="py-2 text-xs text-muted whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.name}</td>
                <td className="text-xs">{r.email}</td>
                <td><Chip>{r.category}</Chip></td>
                <td>{r.subject}</td>
                <td className="text-xs text-muted max-w-[360px] truncate">{r.body}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">No submissions yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}