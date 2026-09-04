import { useEffect, useState } from 'react'
import { Container, H1, Card, Chip, Eyebrow } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function HrDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [clocked, setClocked] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  useEffect(() => {
    Promise.all([
      supabase.from('employees').select('employment_status', { count: 'exact' }),
      supabase.from('time_entries').select('id,clock_in_at,employees(first_name,last_name)').is('clock_out_at', null).limit(20),
      supabase.from('pto_requests').select('id,starts_at,ends_at,status,employees(first_name,last_name)').eq('status', 'PENDING').limit(10),
      supabase.from('timesheets').select('id', { count: 'exact', head: true }).eq('status', 'SUBMITTED'),
    ]).then(([emp, open, pto, ts]) => {
      const counts: any = { active: 0, onLeave: 0, suspended: 0, terminated: 0 }
      for (const e of emp.data ?? []) counts[e.employment_status === 'ACTIVE' ? 'active' : e.employment_status === 'ON_LEAVE' ? 'onLeave' : e.employment_status === 'SUSPENDED' ? 'suspended' : e.employment_status === 'TERMINATED' ? 'terminated' : 'active'] += 1
      setStats({ ...counts, pendingPto: pto.data?.length ?? 0, pendingTs: ts.count ?? 0 })
      setClocked((open.data ?? []) as any)
      setPending((pto.data ?? []) as any)
    })
  }, [])

  return (
    <div className="space-y-6">
      <Eyebrow>HR</Eyebrow>
      <H1 className="chrome-text">HR dashboard</H1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Active" v={stats?.active ?? '—'} tone="ok" />
        <Stat label="On leave" v={stats?.onLeave ?? '—'} />
        <Stat label="Suspended" v={stats?.suspended ?? '—'} tone="warn" />
        <Stat label="Terminated" v={stats?.terminated ?? '—'} tone="err" />
        <Stat label="Pending timesheets" v={stats?.pendingTs ?? '—'} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <H1 className="text-xl">Currently clocked in</H1>
          <ul className="mt-3 text-sm space-y-2">
            {clocked.map((c) => (
              <li key={c.id} className="border-b border-white/5 pb-2 flex items-center justify-between">
                <span>{c.employees?.first_name} {c.employees?.last_name}</span>
                <span className="text-xs text-muted">{new Date(c.clock_in_at).toLocaleTimeString()}</span>
              </li>
            ))}
            {clocked.length === 0 && <li className="text-muted">Nobody is currently clocked in.</li>}
          </ul>
        </Card>
        <Card>
          <H1 className="text-xl">Pending PTO</H1>
          <ul className="mt-3 text-sm space-y-2">
            {pending.map((p) => (
              <li key={p.id} className="border-b border-white/5 pb-2 flex items-center justify-between">
                <span>{p.employees?.first_name} {p.employees?.last_name}</span>
                <Chip>{p.status}</Chip>
              </li>
            ))}
            {pending.length === 0 && <li className="text-muted">No pending PTO.</li>}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, v, tone = 'default' }: any) {
  const cls = tone === 'err' ? 'text-crit' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'chrome-text'
  return <Card><div className="text-xs uppercase tracking-widest text-muted">{label}</div><div className={`mt-2 text-2xl font-semibold ${cls}`}>{v}</div></Card>
}