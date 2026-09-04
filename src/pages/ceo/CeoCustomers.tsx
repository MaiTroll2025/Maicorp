import { useEffect, useState } from 'react'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function CeoCustomers() {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    supabase.from('users').select('id,email,full_name,role,employment_status,account_status,created_at').neq('role', 'CUSTOMER').order('created_at', { ascending: false })
      .then(({ data }) => setRows(data ?? []))
  }, [])
  return (
    <div className="space-y-6">
      <Eyebrow>Customers</Eyebrow>
      <H1 className="chrome-text">Workforce & Customers</H1>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted">
            <tr><th className="text-left py-2">Name</th><th className="text-left">Email</th><th className="text-left">Role</th><th className="text-left">Status</th><th className="text-left">Account</th></tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="table-row">
                <td className="py-2">{u.full_name ?? '—'}</td>
                <td className="text-xs text-muted">{u.email}</td>
                <td><Chip>{u.role}</Chip></td>
                <td><Chip tone={u.employment_status === 'ACTIVE' ? 'ok' : u.employment_status === 'TERMINATED' ? 'err' : 'warn'}>{u.employment_status}</Chip></td>
                <td><Chip tone={u.account_status === 'ACTIVE' ? 'ok' : 'err'}>{u.account_status}</Chip></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted">No records yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}