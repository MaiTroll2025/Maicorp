import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { H1, Card, Chip, Eyebrow } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { fmtPrice } from '../public/StoreIndexPage'

export function CeoOrders() {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    supabase.from('orders').select('*,products(name),users!orders_customer_id_fkey(email)').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setRows(data ?? []))
  }, [])
  return (
    <div className="space-y-6">
      <Eyebrow>Commerce</Eyebrow>
      <H1 className="chrome-text">Orders</H1>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted">
            <tr><th className="text-left py-2">Order</th><th className="text-left">Customer</th><th className="text-left">Product</th><th className="text-left">Status</th><th className="text-left">Plan</th><th className="text-right">Amount</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="table-row">
                <td className="py-2 font-mono text-xs text-muted">#{o.id.slice(0,8)}</td>
                <td className="text-xs">{o.users?.email ?? '—'}</td>
                <td>{o.products?.name ?? '—'}</td>
                <td><Chip tone={o.status === 'PAID' || o.status === 'COMPLETED' ? 'ok' : o.status === 'CANCELLED' || o.status === 'REFUNDED' ? 'err' : 'info'}>{o.status.replace('_',' ')}</Chip></td>
                <td><Chip tone={o.management_plan && o.management_plan !== 'NONE' ? 'purp' : 'default'}>{o.management_plan ?? 'NONE'}</Chip></td>
                <td className="text-right">{fmtPrice(o.amount_cents, o.currency)}</td>
                <td><Link to={`/ceo/orders/${o.id}`} className="text-primary text-xs">Open →</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">No orders yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}