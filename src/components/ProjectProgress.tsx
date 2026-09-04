import { useEffect, useState } from 'react'
import { Card, Chip, H3 } from './ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export const PROJECT_STAGES = [
  ['ORDER_RECEIVED', 'Order Received'],
  ['PAYMENT_CONFIRMED', 'Payment Confirmed'],
  ['PLANNING', 'Planning'],
  ['DESIGN', 'Design'],
  ['DEVELOPMENT', 'Development'],
  ['CUSTOMER_REVIEW', 'Customer Review'],
  ['REVISIONS', 'Revisions'],
  ['TESTING', 'Testing'],
  ['STORE_SUBMISSION', 'Store Submission'],
  ['STORE_REVIEW', 'Store Review'],
  ['LAUNCH_READY', 'Launch Ready'],
  ['LAUNCHED', 'Launched'],
  ['MANAGEMENT', 'Management'],
  ['COMPLETED', 'Completed'],
] as const

export function ProjectProgress({ orderId, isCeo = false }: { orderId: string; isCeo?: boolean }) {
  const { user } = useAuth()
  const [progress, setProgress] = useState<any>({ current_stage: 'ORDER_RECEIVED', progress_percent: 0, customer_visible: true })
  const [history, setHistory] = useState<any[]>([])
  const [percent, setPercent] = useState('0')
  const [stage, setStage] = useState('ORDER_RECEIVED')
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(true)
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const current = await supabase.from('project_progress').select('*').eq('order_id', orderId).maybeSingle()
    if (current.data) {
      setProgress(current.data)
      setPercent(String(current.data.progress_percent))
      setStage(current.data.current_stage)
      setMessage(current.data.customer_message ?? '')
      setVisible(current.data.customer_visible)
      setDueDate(current.data.estimated_completion ?? '')
    }
    const historyResult = await supabase.from('project_progress_history').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).limit(30)
    setHistory(historyResult.data ?? [])
  }

  useEffect(() => {
    load()
    const channel = supabase.channel(`project-progress-${orderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_progress', filter: `order_id=eq.${orderId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [orderId])

  const save = async () => {
    if (!user || !isCeo) return
    setSaving(true)
    const next = { order_id: orderId, current_stage: stage, progress_percent: Math.min(100, Math.max(0, Number(percent) || 0)), customer_visible: visible, customer_message: message || null, estimated_completion: dueDate || null, updated_by: user.id, updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from('project_progress').upsert(next).select().single()
    if (!error && data) setProgress(data)
    setSaving(false)
    load()
  }

  const currentIndex = PROJECT_STAGES.findIndex(([key]) => key === progress.current_stage)
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <H3>{isCeo ? 'Project progress' : 'My project'}</H3>
        <Chip tone={progress.progress_percent >= 100 ? 'ok' : 'info'}>{progress.progress_percent}%</Chip>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-brand-grad transition-all" style={{ width: `${progress.progress_percent}%` }} /></div>
      <div className="mt-3 text-sm text-muted">Current stage: <strong className="text-hi">{labelFor(progress.current_stage)}</strong></div>
      {progress.customer_message && <p className="mt-2 text-sm text-hi/80">{progress.customer_message}</p>}
      {progress.estimated_completion && <p className="mt-2 text-xs text-muted">Estimated completion: {progress.estimated_completion}</p>}
      <div className="mt-5 border-t border-white/10 pt-5">
        <div className="text-xs uppercase tracking-widest text-muted">Project timeline</div>
        <div className="mt-3 space-y-2">
        {PROJECT_STAGES.map(([key, label], index) => (
          <div key={key} className="flex items-center gap-2 text-xs"><span className={`grid h-5 w-5 place-items-center rounded-full ${index < currentIndex || (index === currentIndex && progress.progress_percent >= 100) ? 'bg-ok/20 text-ok' : index === currentIndex ? 'bg-primary/20 text-primary' : 'bg-white/10 text-muted'}`}>{index < currentIndex ? '✓' : index + 1}</span><span className={index <= currentIndex ? 'text-hi' : 'text-muted'}>{label}</span></div>
        ))}
        </div>
      </div>
      {isCeo && (
        <div className="mt-6 border-t border-white/10 pt-5 space-y-3">
          <div className="text-xs uppercase tracking-widest text-muted">CEO update</div>
          <select className="input" value={stage} onChange={(event) => setStage(event.target.value)}>{PROJECT_STAGES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <input className="input" type="number" min="0" max="100" value={percent} onChange={(event) => setPercent(event.target.value)} placeholder="Progress percent" />
          <input className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <textarea className="input" rows={2} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Customer-visible progress note" />
          <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} /> Show progress update to customer</label>
          <button className="btn-primary w-full" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save progress'}</button>
        </div>
      )}
      {isCeo && history.length > 0 && <div className="mt-6 border-t border-white/10 pt-5"><div className="text-xs uppercase tracking-widest text-muted">Progress history</div><div className="mt-3 space-y-2">{history.map((item) => <div key={item.id} className="text-xs text-muted">{new Date(item.created_at).toLocaleString()} · {labelFor(item.previous_stage)} → <span className="text-hi">{labelFor(item.new_stage)}</span> · {item.new_percent}%</div>)}</div></div>}
    </Card>
  )
}

function labelFor(stage: string) {
  return PROJECT_STAGES.find(([key]) => key === stage)?.[1] ?? stage.replaceAll('_', ' ')
}
