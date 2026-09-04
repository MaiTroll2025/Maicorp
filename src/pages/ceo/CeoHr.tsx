import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

function Stat({ label, v, tone = 'default' }: { label: string; v: any; tone?: 'default' | 'warn' | 'err' | 'ok' }) {
  const cls = tone === 'err' ? 'text-crit' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'chrome-text'
  return <Card><div className="text-xs uppercase tracking-widest text-muted">{label}</div><div className={`mt-2 text-2xl font-semibold ${cls}`}>{v}</div></Card>
}

export function CeoHr() {
  const [stats, setStats] = useState<any>(null)
  const [recent, setRecent] = useState<any[]>([])
  useEffect(() => {
    Promise.all([
      supabase.from('employees').select('employment_status,account_status', { count: 'exact' }),
      supabase.from('pto_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('timesheets').select('id', { count: 'exact', head: true }).eq('status', 'SUBMITTED'),
      supabase.from('payroll_periods').select('*').order('starts_at', { ascending: false }).limit(1),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(8),
    ]).then(([emp, pto, ts, ppRow, log]) => {
      const rows = (emp.data ?? []) as any[]
      const counts = { total: rows.length, active: 0, onLeave: 0, suspended: 0, terminated: 0 }
      for (const r of rows) {
        if (r.employment_status === 'ACTIVE') counts.active += 1
        if (r.employment_status === 'ON_LEAVE') counts.onLeave += 1
        if (r.employment_status === 'SUSPENDED') counts.suspended += 1
        if (r.employment_status === 'TERMINATED') counts.terminated += 1
      }
      setStats({ ...counts, pto: pto.count ?? 0, timesheets: ts.count ?? 0, payroll: ppRow.data?.[0] })
      setRecent(log.data ?? [])
    })
  }, [])

  return (
    <div className="space-y-6">
      <Eyebrow>HR</Eyebrow>
      <H1 className="chrome-text">HR dashboard</H1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total employees" v={stats?.total ?? '—'} />
        <Stat label="Active" v={stats?.active ?? '—'} tone="ok" />
        <Stat label="On leave" v={stats?.onLeave ?? '—'} />
        <Stat label="Suspended" v={stats?.suspended ?? '—'} tone="warn" />
        <Stat label="Terminated" v={stats?.terminated ?? '—'} tone="err" />
        <Stat label="Pending PTO" v={stats?.pto ?? '—'} />
        <Stat label="Submitted timesheets" v={stats?.timesheets ?? '—'} />
        <Stat label="Current payroll period" v={stats?.payroll?.starts_at ?? '—'} />
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <H1 className="text-2xl">Quick links</H1>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Link className="btn-ghost justify-center" to="/ceo/hr/employees">Employees</Link>
          <Link className="btn-ghost justify-center" to="/ceo/hr/departments">Departments</Link>
          <Link className="btn-ghost justify-center" to="/ceo/hr/positions">Positions</Link>
          <Link className="btn-ghost justify-center" to="/ceo/hr/documents">HR Documents</Link>
          <Link className="btn-ghost justify-center" to="/ceo/payroll">Payroll</Link>
        </div>
      </Card>

      <Card>
        <H1 className="text-2xl">Recent HR activity</H1>
        <ul className="mt-4 space-y-2 text-sm">
          {recent.map((r) => (
            <li key={r.id} className="flex items-center justify-between border-b border-white/5 pb-2">
              <div>
                <div className="font-medium">{r.action}</div>
                <div className="text-xs text-muted">{new Date(r.created_at).toLocaleString()}</div>
              </div>
              <Chip tone={r.result === 'OK' ? 'ok' : 'err'}>{r.result ?? '—'}</Chip>
            </li>
          ))}
          {recent.length === 0 && <li className="text-muted">No recent activity.</li>}
        </ul>
      </Card>
    </div>
  )
}