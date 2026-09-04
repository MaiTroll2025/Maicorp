import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Chip, Eyebrow, H1 } from '@/components/ui'
import { supabase } from '@/lib/supabase'

interface Project {
  order_id: string
  order_status: string
  order_created_at: string
  customer_name: string | null
  customer_email: string
  product_name: string | null
  management_plan: string | null
  current_stage: string
  progress_percent: number
  estimated_completion: string | null
  store_account_owner: 'CUSTOMER' | 'MAI_CORP'
  latest_message: string | null
  latest_sender_role: 'CUSTOMER' | 'CEO' | null
  latest_message_at: string | null
  unread_count: number
  apple_account_owner: string
  google_account_owner: string
  apple_status: string
  google_status: string
  management_enabled: boolean
  monthly_fee_cents: number | null
}

export function CeoChats() {
  const [projects, setProjects] = useState<Project[]>([])
  const [query, setQuery] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)

  const load = async () => {
    const { data, error } = await supabase.rpc('get_ceo_project_summaries')
    if (error) {
      console.error('Failed to load CEO project summaries:', error)
      setProjects([])
      return
    }
    setProjects((data ?? []).map((row) => ({ ...row, unread_count: Number(row.unread_count ?? 0) })) as Project[])
  }

  useEffect(() => {
    load()
    const channel = supabase.channel('ceo-order-chat-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_messages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_progress' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const visible = useMemo(() => projects.filter((project) => {
    const haystack = `${project.customer_name ?? ''} ${project.customer_email} ${project.product_name ?? ''} ${project.order_id}`.toLowerCase()
    return (!query || haystack.includes(query.toLowerCase())) && (!unreadOnly || project.unread_count > 0)
  }), [projects, query, unreadOnly])

  return (
    <div className="space-y-6">
      <Eyebrow>Commerce · Communication</Eyebrow>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><H1 className="chrome-text">Customer chats</H1><p className="mt-2 text-sm text-muted">Each conversation stays attached to its order and project.</p></div><Chip tone="info">{projects.reduce((total, project) => total + project.unread_count, 0)} unread</Chip></div>
      <div className="flex flex-col gap-3 sm:flex-row"><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, email, project, or order" /><label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} /> Unread only</label></div>
      <div className="space-y-3">
        {visible.map((project) => <Link key={project.order_id} to={`/ceo/orders/${project.order_id}`} className="block"><Card className="transition-transform hover:translate-y-[-2px]"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-base font-semibold">{project.customer_name || project.customer_email || 'Customer'}</div><div className="mt-1 text-sm text-hi/80">{project.product_name ?? 'Custom project'}</div><div className="mt-2 text-xs text-muted">#{project.order_id.slice(0, 8)} · {new Date(project.order_created_at).toLocaleDateString()}</div></div><div className="flex items-center gap-2"><Chip tone="info">{project.order_status.replaceAll('_', ' ')}</Chip>{project.unread_count > 0 && <Chip tone="warn">{project.unread_count} unread</Chip>}</div></div><div className="mt-4"><div className="flex items-center justify-between text-xs"><span className="text-hi/80">{labelFor(project.current_stage)}</span><span className="text-muted">{project.progress_percent}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-brand-grad" style={{ width: `${project.progress_percent}%` }} /></div></div><div className="mt-4 flex flex-wrap gap-2"><Chip>{project.management_plan && project.management_plan !== 'NONE' ? `Management: ${project.management_plan}` : 'No management plan'}</Chip><Chip tone="purp">Apple: {formatStore(project.apple_account_owner, project.apple_status)}</Chip><Chip tone="purp">Google: {formatStore(project.google_account_owner, project.google_status)}</Chip></div><div className="mt-4 text-sm text-muted">{project.latest_message ? <><span className="text-hi/80">{project.latest_sender_role === 'CEO' ? 'You: ' : ''}{project.latest_message}</span>{project.latest_message_at && <span className="ml-2 text-xs">{new Date(project.latest_message_at).toLocaleString()}</span>}</> : 'No messages yet. Open the project to start the conversation.'}</div></Card></Link>)}
        {visible.length === 0 && <Card><p className="text-sm text-muted">{unreadOnly ? 'No unread customer chats.' : 'No customer projects found.'}</p></Card>}
      </div>
    </div>
  )
}

function labelFor(stage: string) {
  return stage.replaceAll('_', ' ').toLowerCase().replace(/(^| )\w/g, (letter) => letter.toUpperCase())
}

function formatStore(owner: string, status: string) {
  const ownerLabel = owner === 'MAI_CORP' ? 'MAI Corp' : 'Customer'
  return `${ownerLabel} · ${labelFor(status)}`
}
