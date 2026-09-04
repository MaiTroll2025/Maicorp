import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Container, H1, H3, Card, Eyebrow, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { fmtPrice } from '../public/StoreIndexPage'
import { ProjectChat } from '@/components/ProjectChat'
import { ProjectProgress } from '@/components/ProjectProgress'
import { ProjectStoreManagement } from '@/components/ProjectStoreManagement'
import { ClipboardList, AlertCircle } from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export function AccountOrderDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [order, setOrder] = useState<any | null>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [infra, setInfra] = useState<any | null>(null)
  const [intake, setIntake] = useState<any | null>(null)

  useEffect(() => {
    if (!user || !id) return
    supabase.from('orders').select('*,products(name)').eq('id', id).eq('customer_id', user.id).maybeSingle()
      .then(({ data }) => setOrder(data))
    supabase.from('order_timeline').select('*').eq('order_id', id).order('created_at')
      .then(({ data }) => setTimeline(data ?? []))
    supabase.from('customer_infrastructure').select('*').eq('order_id', id).maybeSingle()
      .then(({ data }) => setInfra(data))
    supabase.from('project_intakes').select('*').eq('order_id', id).maybeSingle()
      .then(({ data }) => setIntake(data))
  }, [user, id])

  if (!order) return <Container className="py-20 text-muted">Loading…</Container>

  const submitIntake = async (payload: Record<string, string>) => {
    await supabase.from('project_intakes').upsert({ order_id: id, payload })
    setIntake({ order_id: id, payload })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await fetch(`${SUPABASE_URL}/functions/v1/send-intake-email`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_ANON, 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'CONFIRMATION', order_id: id }),
        })
      }
    } catch (_) { /* non-fatal */ }
  }

  return (
    <Container className="py-12">
      <Eyebrow>Account · Order</Eyebrow>
      <H1 className="mt-2 chrome-text">Order #{(id ?? '').slice(0, 8)}</H1>

      <div className="mt-8 grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Chip>{order.status.replace('_',' ')}</Chip>
                <H3 className="mt-3">{fmtPrice(order.amount_cents, order.currency)}</H3>
                {order.management_plan && order.management_plan !== 'NONE' && (
                  <div className="text-sm text-muted mt-1">Management: {order.management_plan}</div>
                )}
              </div>
              <div className="text-xs text-muted text-right">
                <div>Created: {new Date(order.created_at).toLocaleString()}</div>
                <div>Updated: {new Date(order.updated_at).toLocaleString()}</div>
              </div>
            </div>
          </Card>

          <ProjectProgress orderId={id!} />
          <ProjectStoreManagement orderId={id!} />
          <ProjectChat orderId={id!} projectName={order.products?.name ?? 'Project'} />

          {!intake && order.status === 'PAID' && (
            <div className="rounded-lg border border-warn/40 bg-warn/10 text-warn px-4 py-3 flex items-start gap-3 text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Complete your project intake</div>
                <div className="text-warn/80 mt-0.5 text-xs">
                  The CEO reviews every intake before kickoff. Please fill out the form below so we can begin your project.
                </div>
              </div>
            </div>
          )}

          {!intake ? <IntakeForm onSubmit={submitIntake} /> : (
            <Card>
              <div className="flex items-center gap-2 text-ok text-sm">
                <ClipboardList size={16} /> Project intake submitted
              </div>
              <pre className="mt-3 text-xs text-muted overflow-auto bg-bg/40 p-3 rounded-md border border-line/40">{JSON.stringify(intake.payload, null, 2)}</pre>
            </Card>
          )}

          <Card>
            <H3>Timeline</H3>
            <ul className="mt-4 space-y-3">
              {timeline.map((t) => (
                <li key={t.id} className="flex items-start gap-3 text-sm">
                  <Chip>{t.status}</Chip>
                  <div>
                    <div>{t.note ?? 'Status update'}</div>
                    <div className="text-xs text-muted">{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                </li>
              ))}
              {timeline.length === 0 && <li className="text-muted text-sm">Awaiting kickoff.</li>}
            </ul>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card>
            <H3>Infrastructure</H3>
            {infra ? (
              <ul className="mt-3 text-sm space-y-2">
                {infra.domain && <li><span className="text-muted">Domain:</span> {infra.domain}</li>}
                {infra.hosting && <li><span className="text-muted">Hosting:</span> {infra.hosting}</li>}
                {infra.email && <li><span className="text-muted">Email:</span> {infra.email}</li>}
                {!infra.domain && !infra.hosting && !infra.email && (
                  <li className="text-muted">Infrastructure details will appear here once the CEO provisions your project.</li>
                )}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">No infrastructure assigned yet.</p>}
            <Link to="/account/infrastructure" className="text-xs text-primary mt-3 inline-block">View all infrastructure →</Link>
          </Card>
          <Card>
            <H3>Need help?</H3>
            <p className="mt-2 text-sm text-muted">Contact MAI Corp any time for project questions.</p>
            <Link to="/contact" className="btn-ghost mt-3 inline-flex text-xs">Contact support</Link>
          </Card>
        </div>
      </div>
    </Container>
  )
}

function IntakeForm({ onSubmit }: { onSubmit: (payload: Record<string, string>) => void }) {
  const [v, setV] = useState<Record<string, string>>({})
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }))
  const submit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(v) }
  return (
    <Card>
      <H3>Project intake</H3>
      <p className="text-sm text-muted mt-1">Tell us about your project. CEO will review and follow up.</p>
      <form onSubmit={submit} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label className="label">Business name</label><input className="input" onChange={set('business_name')} /></div>
        <div><label className="label">Contact name</label><input className="input" onChange={set('contact_name')} /></div>
        <div><label className="label">Phone</label><input className="input" onChange={set('phone')} /></div>
        <div><label className="label">Email</label><input className="input" type="email" onChange={set('email')} /></div>
        <div><label className="label">Business type</label><input className="input" onChange={set('business_type')} /></div>
        <div><label className="label">Domain (existing or desired)</label><input className="input" onChange={set('domain')} /></div>
        <div className="md:col-span-2"><label className="label">Website purpose</label><textarea className="input" rows={3} onChange={set('purpose')} /></div>
        <div className="md:col-span-2"><label className="label">Pages / features</label><textarea className="input" rows={3} onChange={set('features')} /></div>
        <div className="md:col-span-2"><label className="label">Special requirements</label><textarea className="input" rows={3} onChange={set('special')} /></div>
        <div className="md:col-span-2"><button className="btn-primary" type="submit">Submit intake</button></div>
      </form>
    </Card>
  )
}