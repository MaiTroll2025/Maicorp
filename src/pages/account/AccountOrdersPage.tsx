import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Container, H1, H3, Card, Eyebrow, Chip, Skeleton } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { fmtPrice } from '../public/StoreIndexPage'

interface Order { id: string; status: string; amount_cents: number; currency: string; created_at: string; management_plan: string | null; products: { name: string; slug: string } | null }

export function AccountOrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[] | null>(null)
  useEffect(() => {
    if (!user) return
    supabase.from('orders')
      .select('id,status,amount_cents,currency,created_at,management_plan,products(name,slug)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setOrders((data ?? []) as any))
  }, [user])

  return (
    <Container className="py-12">
      <Eyebrow>Account</Eyebrow>
      <H1 className="mt-2 chrome-text">Your orders</H1>
      <div className="mt-8 space-y-3">
        {orders === null ? <Skeleton className="h-20 w-full" /> : orders.length === 0 ? (
          <Card><p className="text-muted">No orders yet. <Link to="/store" className="text-primary">Browse the store →</Link></p></Card>
        ) : orders.map((o) => (
          <Link key={o.id} to={`/account/orders/${o.id}`} className="block">
            <Card className="hover:translate-y-[-2px] transition-transform">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <H3>{o.products?.name ?? 'Custom project'}</H3>
                  <div className="text-xs text-muted mt-1">{new Date(o.created_at).toLocaleString()}</div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <Chip tone={o.status === 'PAID' || o.status === 'COMPLETED' ? 'ok' : o.status === 'CANCELLED' || o.status === 'REFUNDED' ? 'err' : 'info'}>{o.status.replace('_',' ')}</Chip>
                    {o.management_plan && o.management_plan !== 'NONE' && <Chip tone="purp">{o.management_plan}</Chip>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-semibold chrome-text">{fmtPrice(o.amount_cents, o.currency)}</div>
                  <div className="text-xs text-muted">#{(o.id as string).slice(0, 8)}</div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  )
}