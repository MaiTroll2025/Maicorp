import { useEffect, useMemo, useState } from 'react'
import { H1, H3, Eyebrow, Card, Chip, StatusDot } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { Play, RefreshCw, Trash2, Copy, Download } from 'lucide-react'

interface BugReport {
  id: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
  status: string
  title: string | null
  error_type: string | null
  error_message: string | null
  stack_trace: string | null
  route: string | null
  component: string | null
  function_name: string | null
  database_error_code: string | null
  metadata: any
  environment: string | null
  app_version: string | null
  fingerprint: string | null
  occurrence_count: number
  first_seen_at: string
  last_seen_at: string
  resolved_at: string | null
  resolution: string | null
  user_id: string | null
  created_at: string
  updated_at: string
}

export function CeoBugCatcher() {
  const [rows, setRows] = useState<BugReport[]>([])
  const [sel, setSel] = useState<BugReport | null>(null)
  const [running, setRunning] = useState(false)
  const [runLog, setRunLog] = useState<string[]>([])

  const load = () => supabase.from('bug_reports').select('*').order('last_seen_at', { ascending: false }).limit(200)
    .then(({ data }) => { setRows((data ?? []) as any); if (!sel && data && data[0]) setSel(data[0] as any) })

  useEffect(() => { load() }, [])

  const counts = useMemo(() => {
    const c = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0, OPEN: 0, AUTO_REPAIRING: 0 }
    for (const r of rows) {
      if (c[r.severity as keyof typeof c] !== undefined) c[r.severity as keyof typeof c] += 1
      if (r.status !== 'FIXED' && r.status !== 'DELETED') c.OPEN += 1
    }
    return c
  }, [rows])

  const runDiagnostics = async () => {
    setRunning(true); setRunLog([])
    const log = (m: string) => setRunLog((l) => [...l, `[${new Date().toLocaleTimeString()}] ${m}`])
    try {
      log('Inspecting schema…')
      const expected = ['users','employees','orders','products','companies','platforms','bug_reports','audit_logs']
      const found: string[] = []
      for (const t of expected) {
        const r = await supabase.from(t as any).select('id', { head: true, count: 'exact' })
        if (!r.error) found.push(t)
      }
      const missing = expected.filter((t) => !found.includes(t))
      if (missing.length) log(`Missing tables: ${missing.join(', ')}`)
      else log('All expected tables present.')

      log('Checking RPC health…')
      const rpcArgs: Record<string, any> = {
        hire_employee: { p_employee_id: '00000000-0000-0000-0000-000000000000' },
        terminate_employee: { p_employee_id: '00000000-0000-0000-0000-000000000000', p_reason: 'probe' },
        clock_in: { p_employee_id: '00000000-0000-0000-0000-000000000000' },
        clock_out: { p_employee_id: '00000000-0000-0000-0000-000000000000' },
        calculate_payroll: { p_period_id: '00000000-0000-0000-0000-000000000000' },
      }
      const rpcs = Object.keys(rpcArgs)
      for (const f of rpcs) {
        const { error } = await supabase.rpc(f as any, rpcArgs[f])
        const msg = error?.message ?? 'available'
        const missing = msg.toLowerCase().includes('could not find the function')
        log(`RPC ${f}: ${missing ? 'NOT FOUND' : msg.slice(0,80)}`)
      }

      log('Done.')
    } catch (e: any) {
      log('FAILED: ' + (e?.message ?? 'unknown'))
    } finally {
      setRunning(false)
    }
  }

  const setStatus = async (id: string, status: string) => {
    await supabase.from('bug_reports').update({ status, updated_at: new Date().toISOString(), resolved_at: status === 'FIXED' ? new Date().toISOString() : null }).eq('id', id)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Soft-delete this report?')) return
    await supabase.from('bug_reports').update({ status: 'DELETED', deleted_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const reportText = (r: BugReport) => `MAI CORP BUG REPORT
==================

Bug ID:        ${r.id}
Severity:      ${r.severity}
Status:        ${r.status}

Title:         ${r.title ?? ''}
Error Type:    ${r.error_type ?? ''}
Error Message: ${r.error_message ?? ''}

Route:         ${r.route ?? ''}
Component:     ${r.component ?? ''}
Function:      ${r.function_name ?? ''}
DB Code:       ${r.database_error_code ?? ''}

Environment:   ${r.environment ?? ''}
App Version:   ${r.app_version ?? ''}
User ID:       ${r.user_id ?? ''}

Occurrences:   ${r.occurrence_count}
First Seen:    ${r.first_seen_at}
Last Seen:     ${r.last_seen_at}
Resolved:      ${r.resolved_at ?? '—'}
Resolution:    ${r.resolution ?? ''}

Stack Trace:
${r.stack_trace ?? ''}

Metadata:
${JSON.stringify(r.metadata ?? {}, null, 2)}`

  const copyReport = (r: BugReport) => navigator.clipboard.writeText(reportText(r)).catch(() => {})
  const downloadReport = (r: BugReport) => {
    const blob = new Blob([reportText(r)], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bug-${r.id.slice(0,8)}.txt`; a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Eyebrow>MAI CORP BUG CATCHER</Eyebrow>
          <H1 className="mt-2 chrome-text">Universal Platform Health & Diagnostics</H1>
        </div>
        <button className="btn-primary" disabled={running} onClick={runDiagnostics}>
          <Play size={16} /> {running ? 'Running…' : 'Run Diagnostics'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><div className="text-xs uppercase tracking-widest text-muted">All systems</div><div className="text-2xl chrome-text font-semibold mt-2">{rows.length}</div></Card>
        <Card><div className="text-xs uppercase tracking-widest text-muted">Critical</div><div className="text-2xl text-crit font-semibold mt-2">{counts.CRITICAL}</div></Card>
        <Card><div className="text-xs uppercase tracking-widest text-muted">High</div><div className="text-2xl text-warn font-semibold mt-2">{counts.HIGH}</div></Card>
        <Card><div className="text-xs uppercase tracking-widest text-muted">Open</div><div className="text-2xl text-info font-semibold mt-2">{counts.OPEN}</div></Card>
        <Card><div className="text-xs uppercase tracking-widest text-muted">Auto-repairing</div><div className="text-2xl text-secondary font-semibold mt-2">{counts.AUTO_REPAIRING}</div></Card>
      </div>

      <div className="grid lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-7">
          <div className="flex items-center justify-between">
            <H3>Reports</H3>
            <button className="text-xs text-muted hover:text-hi" onClick={load}><RefreshCw size={12} className="inline" /> Refresh</button>
          </div>
          <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto">
            {rows.length === 0 ? <p className="text-sm text-muted">No bugs reported. Good.</p> : rows.map((r) => (
              <button key={r.id} onClick={() => setSel(r)} className={`w-full text-left rounded-lg px-3 py-2.5 border ${sel?.id === r.id ? 'border-primary/60 bg-white/5' : 'border-white/5 hover:bg-white/5'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusDot tone={r.severity === 'CRITICAL' ? 'crit' : r.severity === 'HIGH' ? 'warn' : r.severity === 'MEDIUM' ? 'info' : 'unknown'} />
                      <span className="text-sm font-medium truncate">{r.title ?? r.error_type ?? 'Issue'}</span>
                    </div>
                    <div className="text-xs text-muted mt-0.5">{r.error_type ?? '—'} · {r.route ?? '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted">×{r.occurrence_count}</div>
                    <Chip tone={r.status === 'FIXED' ? 'ok' : r.status === 'DELETED' ? 'default' : 'warn'} className="mt-1">{r.status}</Chip>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-5 space-y-3">
          {sel ? (
            <Card>
              <div className="flex items-start justify-between gap-2">
                <H3>Detail</H3>
                <div className="flex gap-1">
                  <button title="Copy report" onClick={() => copyReport(sel)} className="p-2 rounded-md hover:bg-white/5"><Copy size={14} /></button>
                  <button title="Download TXT" onClick={() => downloadReport(sel)} className="p-2 rounded-md hover:bg-white/5"><Download size={14} /></button>
                  <button title="Delete" onClick={() => remove(sel.id)} className="p-2 rounded-md hover:bg-white/5 text-err"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted text-xs uppercase tracking-widest">Severity</span><div className="mt-1"><Chip tone={sel.severity === 'CRITICAL' ? 'crit' : sel.severity === 'HIGH' ? 'warn' : 'info'}>{sel.severity}</Chip></div></div>
                <div><span className="text-muted text-xs uppercase tracking-widest">Status</span><div className="mt-1"><Chip>{sel.status}</Chip></div></div>
                <div><span className="text-muted text-xs uppercase tracking-widest">Route</span><div className="mt-1">{sel.route ?? '—'}</div></div>
                <div><span className="text-muted text-xs uppercase tracking-widest">Component</span><div className="mt-1">{sel.component ?? '—'}</div></div>
                <div><span className="text-muted text-xs uppercase tracking-widest">Function</span><div className="mt-1">{sel.function_name ?? '—'}</div></div>
                <div><span className="text-muted text-xs uppercase tracking-widest">DB Code</span><div className="mt-1">{sel.database_error_code ?? '—'}</div></div>
                <div><span className="text-muted text-xs uppercase tracking-widest">First seen</span><div className="mt-1">{new Date(sel.first_seen_at).toLocaleString()}</div></div>
                <div><span className="text-muted text-xs uppercase tracking-widest">Last seen</span><div className="mt-1">{new Date(sel.last_seen_at).toLocaleString()}</div></div>
              </div>
              <div className="mt-4">
                <div className="text-muted text-xs uppercase tracking-widest">Error message</div>
                <pre className="mt-1 text-xs whitespace-pre-wrap text-hi/85">{sel.error_message ?? ''}</pre>
              </div>
              {sel.stack_trace && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-muted text-xs uppercase tracking-widest">Stack trace</summary>
                  <pre className="mt-2 text-[11px] whitespace-pre-wrap text-muted">{sel.stack_trace}</pre>
                </details>
              )}
              <div className="mt-5 flex gap-2">
                <button className="btn-ghost text-xs" onClick={() => setStatus(sel.id, 'FIXED')}>Mark Fixed</button>
                <button className="btn-ghost text-xs" onClick={() => setStatus(sel.id, 'WONT_FIX')}>Won't Fix</button>
                <button className="btn-ghost text-xs" onClick={() => setStatus(sel.id, 'INVESTIGATING')}>Investigating</button>
              </div>
            </Card>
          ) : null}

          {runLog.length > 0 && (
            <Card>
              <H3>Diagnostic output</H3>
              <pre className="mt-3 text-[11px] text-muted whitespace-pre-wrap max-h-72 overflow-auto">{runLog.join('\n')}</pre>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}