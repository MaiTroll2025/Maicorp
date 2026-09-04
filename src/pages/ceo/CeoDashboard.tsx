import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { H1, H3, Eyebrow, Card, Chip, StatusDot, Skeleton } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { fmtPrice } from '../public/StoreIndexPage'
import { Bug, DollarSign, ShoppingBag, Users, Briefcase, Server, Globe } from 'lucide-react'

export function CeoDashboard() {
  const [stats, setStats] = useState<any>(null)
  useEffect(() => {
    Promise.all([
      supabase.from('orders').select('id,amount_cents,status,management_plan'),
      supabase.from('users').select('id', { count: 'exact', head: true }).neq('role', 'CUSTOMER'),
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('employment_status', 'ACTIVE'),
      supabase.from('bug_reports').select('id', { count: 'exact', head: true }).neq('status', 'FIXED').neq('status', 'DELETED'),
      supabase.from('platforms').select('*'),
      supabase.rpc('app_updates_count'),
    ]).then(([o, u, e, b, p, a]) => {
      const orders = o.data ?? []
      const revenue = orders.filter((x) => x.status !== 'CANCELLED' && x.status !== 'REFUNDED').reduce((s, x) => s + x.amount_cents, 0)
      const mrr = orders.filter((x) => x.management_plan && x.management_plan !== 'NONE').reduce((s, _x) => s + 10000, 0) // cents per plan tier average
      setStats({
        orders: orders.length,
        revenue,
        mrr,
         activeEmployees: e.count ?? 0,
        workforce: u.count ?? 0,
        openBugs: b.count ?? 0,
        platforms: p.data ?? [],
        appUpdates: a.data ?? 0,
      })
    })
  }, [])

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Eyebrow>CEO Command Center</Eyebrow>
          <H1 className="mt-2 chrome-text">Overview</H1>
        </div>
        <Link to="/ceo/bug-catcher" className="btn-ghost text-xs">Bug Catcher</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Revenue" value={stats ? fmtPrice(stats.revenue ?? 0, 'USD') : '—'} />
        <Stat icon={ShoppingBag} label="Orders" value={stats ? String(stats.orders) : '—'} />
        <Stat icon={Briefcase} label="Active employees" value={stats ? String(stats.activeEmployees) : '—'} />
        <Stat icon={Bug} label="Open bugs" value={stats ? String(stats.openBugs) : '—'} tone={stats && stats.openBugs > 0 ? 'crit' : 'ok'} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Users} label="Workforce (CEO+HR+EMP)" value={stats ? String(stats.workforce) : '—'} />
        <Stat icon={DollarSign} label="Estimated MRR" value={stats ? fmtPrice(stats.mrr ?? 0, 'USD') : '—'} />
         <Stat icon={Server} label="Platforms" value={stats ? String(stats.platforms.length) : '—'} />
        <Stat icon={Globe} label="App updates" value={stats ? String(stats.appUpdates) : '—'} />
        <Stat icon={Bug} label="Critical bugs" value={'—'} />
      </div>

       <div className="grid lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-5">
          <div className="flex items-center justify-between">
            <H3>App updates</H3>
            <Link to="/ceo/app-updates" className="text-xs text-muted hover:text-hi">Manage →</Link>
          </div>
          <div className="mt-4 space-y-2">
            {!stats ? (
              <Skeleton className="h-24 w-full" />
            ) : (stats.platforms as any[]).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/5">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-muted" />
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted">{p.slug}</div>
                  </div>
                </div>
                {p.last_sync_at ? (
                  <Chip tone="ok">Synced {new Date(p.last_sync_at).toLocaleDateString()}</Chip>
                ) : (
                  <Chip tone="warn">Not synced</Chip>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-line/30 text-xs text-muted">
            Updates are fetched from each project's MAIUPDATE.json on git push.{' '}
            <Link to="/ceo/app-updates" className="text-primary hover:text-hi">Open updates hub</Link>
          </div>
        </Card>

        <Card className="lg:col-span-7">
          <div className="flex items-center justify-between">
            <H3>Platform health</H3>
            <Link to="/ceo/platforms" className="text-xs text-muted hover:text-hi">All platforms →</Link>
          </div>
          <div className="mt-4 space-y-2">
            {!stats ? <Skeleton className="h-24 w-full" /> : stats.platforms.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/5">
                <div className="flex items-center gap-3">
                  <StatusDot tone={p.last_status === 'OPERATIONAL' ? 'ok' : p.last_status === 'DEGRADED' ? 'warn' : p.last_status === 'OFFLINE' ? 'crit' : 'unknown'} />
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted">{p.last_check_at ? `Checked ${new Date(p.last_check_at).toLocaleString()}` : 'No diagnostic run yet'}</div>
                  </div>
                </div>
                <Chip tone={p.last_status === 'OPERATIONAL' ? 'ok' : p.last_status === 'DEGRADED' ? 'warn' : p.last_status === 'OFFLINE' ? 'crit' : 'default'}>
                  {p.last_status ?? 'UNKNOWN'}
                </Chip>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-5">
          <div className="flex items-center justify-between">
            <H3>Recent activity</H3>
            <Link to="/ceo/audit-log" className="text-xs text-muted hover:text-hi">Audit log →</Link>
          </div>
          <RecentActivity />
        </Card>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, tone = 'default' }: { icon: any; label: string; value: string; tone?: 'default' | 'ok' | 'crit' }) {
  return (
    <Card>
      <div className="flex items-center justify-between text-muted text-xs tracking-[0.25em] uppercase"><span>{label}</span><Icon size={16} /></div>
      <div className={`mt-3 text-2xl font-semibold ${tone === 'crit' ? 'text-crit' : tone === 'ok' ? 'text-ok' : 'chrome-text'}`}>{value}</div>
    </Card>
  )
}

function RecentActivity() {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(8).then(({ data }) => setRows(data ?? []))
  }, [])
  if (!rows.length) return <p className="mt-4 text-sm text-muted">No recent activity.</p>
  return (
    <ul className="mt-4 space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
          <div>
            <div className="font-medium">{r.action}</div>
            <div className="text-xs text-muted">{new Date(r.created_at).toLocaleString()}</div>
          </div>
          <Chip tone={r.result === 'OK' ? 'ok' : 'err'}>{r.result ?? '—'}</Chip>
        </li>
      ))}
    </ul>
  )
}