import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Container, H1, H3, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { fmtPrice } from '../public/StoreIndexPage'
import { ProjectChat } from '@/components/ProjectChat'
import { ProjectProgress } from '@/components/ProjectProgress'
import { ProjectStoreManagement } from '@/components/ProjectStoreManagement'

export function CeoOrderDetail() {
  const { id } = useParams()
  const [o, setO] = useState<any | null>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [intake, setIntake] = useState<any | null>(null)
  const [infra, setInfra] = useState<any | null>(null)
  const [newStatus, setNewStatus] = useState('')
  const [internalNotes, setInternalNotes] = useState<any[]>([])
  const [noteDraft, setNoteDraft] = useState('')

  const load = async () => {
    if (!id) return
    const { data } = await supabase.from('orders').select('*,products(name),users!orders_customer_id_fkey(email,full_name)').eq('id', id).maybeSingle()
    setO(data)
    const tl = await supabase.from('order_timeline').select('*').eq('order_id', id).order('created_at')
    setTimeline(tl.data ?? [])
    const in_ = await supabase.from('project_intakes').select('*').eq('order_id', id).maybeSingle()
    setIntake(in_.data)
    const inf = await supabase.from('customer_infrastructure').select('*').eq('order_id', id).maybeSingle()
    setInfra(inf.data)
    const notes = await supabase.from('project_internal_notes').select('*').eq('order_id', id).order('created_at', { ascending: false })
    setInternalNotes(notes.data ?? [])
  }
  useEffect(() => {
    load()
    if (id) supabase.rpc('mark_order_messages_read', { p_order_id: id })
  }, [id])

  const updateStatus = async () => {
    if (!id || !newStatus) return
    await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('order_timeline').insert({ order_id: id, status: newStatus, note: 'CEO updated status' })
    setNewStatus(''); load()
  }

  if (!o) return <Container className="py-20 text-muted">Loading…</Container>

  return (
    <div className="space-y-6">
      <Eyebrow>Order</Eyebrow>
      <H1 className="chrome-text">#{id?.slice(0,8)}</H1>

      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          <Card>
            <H3>Order</H3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted text-xs uppercase tracking-widest">Customer</span><div className="mt-1">{o.users?.email ?? '—'}</div></div>
              <div><span className="text-muted text-xs uppercase tracking-widest">Product</span><div className="mt-1">{o.products?.name ?? '—'}</div></div>
              <div><span className="text-muted text-xs uppercase tracking-widest">Status</span><div className="mt-1"><Chip>{o.status.replace('_',' ')}</Chip></div></div>
              <div><span className="text-muted text-xs uppercase tracking-widest">Plan</span><div className="mt-1"><Chip>{o.management_plan ?? 'NONE'}</Chip></div></div>
              <div><span className="text-muted text-xs uppercase tracking-widest">PayPal Order</span><div className="mt-1 font-mono text-xs">{o.paypal_order_id ?? '—'}</div></div>
              <div><span className="text-muted text-xs uppercase tracking-widest">PayPal Capture</span><div className="mt-1 font-mono text-xs">{o.paypal_capture_id ?? '—'}</div></div>
              <div><span className="text-muted text-xs uppercase tracking-widest">Amount</span><div className="mt-1">{fmtPrice(o.amount_cents, o.currency)}</div></div>
              <div><span className="text-muted text-xs uppercase tracking-widest">Created</span><div className="mt-1">{new Date(o.created_at).toLocaleString()}</div></div>
            </div>
          </Card>

          {intake && <Card><H3>Project intake</H3><pre className="mt-3 text-xs text-muted overflow-auto">{JSON.stringify(intake.payload, null, 2)}</pre></Card>}

          <ProjectProgress orderId={id!} isCeo />
          <ProjectStoreManagement orderId={id!} isCeo />
          <ProjectChat orderId={id!} isCeo projectName={o.products?.name ?? 'Project'} />

          <Card>
            <H3>Internal project notes</H3>
            <p className="mt-1 text-xs text-muted">CEO-only notes. Customers never receive this content.</p>
            <div className="mt-4 space-y-2">{internalNotes.map((note) => <div key={note.id} className="rounded-lg border border-white/10 bg-black/10 p-3 text-sm"><div className="whitespace-pre-wrap">{note.body}</div><div className="mt-1 text-[10px] text-muted">{new Date(note.created_at).toLocaleString()}</div></div>)}</div>
            <form className="mt-4 flex gap-2" onSubmit={async (event) => { event.preventDefault(); if (!noteDraft.trim() || !id) return; await supabase.from('project_internal_notes').insert({ order_id: id, body: noteDraft.trim() }); setNoteDraft(''); load() }}>
              <label className="sr-only" htmlFor="internal-note">Internal note</label>
              <textarea id="internal-note" className="input" rows={2} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add a private project note" />
              <button className="btn-ghost self-end" type="submit" disabled={!noteDraft.trim()}>Add note</button>
            </form>
          </Card>

          <Card>
            <H3>Timeline</H3>
            <ul className="mt-4 space-y-2">
              {timeline.map((t) => (
                <li key={t.id} className="flex items-center gap-3 text-sm border-b border-white/5 pb-2">
                  <Chip>{t.status}</Chip>
                  <div className="text-muted text-xs">{new Date(t.created_at).toLocaleString()}</div>
                  <div className="text-hi/80">{t.note ?? ''}</div>
                </li>
              ))}
              {timeline.length === 0 && <li className="text-muted text-sm">No timeline entries yet.</li>}
            </ul>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card>
            <H3>Update status</H3>
            <div className="mt-3 space-y-2">
              <select className="input" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                <option value="">Select…</option>
                {['IN_PROGRESS','WAITING_FOR_CUSTOMER','DEVELOPMENT','REVIEW','DEPLOYMENT','COMPLETED','CANCELLED','REFUNDED'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn-primary w-full justify-center" disabled={!newStatus} onClick={updateStatus}>Apply</button>
            </div>
          </Card>

          <Card>
            <H3>Infrastructure</H3>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
              <Infra label="Domain" k="domain" value={infra?.domain} orderId={id!} onSaved={load} />
              <Infra label="Hosting" k="hosting" value={infra?.hosting} orderId={id!} onSaved={load} />
              <Infra label="Database" k="database_info" value={infra?.database_info} orderId={id!} onSaved={load} />
              <Infra label="Email" k="email" value={infra?.email} orderId={id!} onSaved={load} />
              <Infra label="Storage" k="storage" value={infra?.storage} orderId={id!} onSaved={load} />
              <Infra label="Other" k="other" value={infra?.other} orderId={id!} onSaved={load} />
            </div>
            <button
              className="btn-ghost w-full justify-center mt-4"
              onClick={async () => {
                if (!id) return
                const { data } = await supabase.from('customer_infrastructure').select('*').eq('order_id', id).maybeSingle()
                const text = generateHandoff(o, data)
                const blob = new Blob([text], { type: 'text/plain' })
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `infrastructure-handoff-${id.slice(0,8)}.txt`; a.click()
              }}
            >Generate Infrastructure Handoff (TXT)</button>
            <p className="text-[11px] text-muted mt-2">Sensitive credentials live server-side and are revealed only via this CEO action. Each download is auditable.</p>
          </Card>

          <Card>
            <H3>Actions</H3>
            <div className="mt-3 flex flex-col gap-2">
              <Link to="/ceo/orders" className="text-xs text-muted hover:text-hi">← All orders</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Infra({ label, k, value, orderId, onSaved }: { label: string; k: string; value: string | null | undefined; orderId: string; onSaved: () => void }) {
  const [v, setV] = useState(value ?? '')
  const [editing, setEditing] = useState(false)
  useEffect(() => { setV(value ?? '') }, [value])
  return (
    <div>
      <label className="label">{label}</label>
      {editing ? (
        <div className="flex gap-2">
          <input className="input" value={v} onChange={(e) => setV(e.target.value)} />
          <button className="btn-ghost text-xs" onClick={async () => {
            await supabase.from('customer_infrastructure').upsert({ order_id: orderId, [k]: v }, { onConflict: 'order_id' })
            setEditing(false); onSaved()
          }}>Save</button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="text-sm">{v || <span className="text-muted">—</span>}</div>
          <button className="text-xs text-primary" onClick={() => setEditing(true)}>Edit</button>
        </div>
      )}
    </div>
  )
}

function generateHandoff(order: any, infra: any | null) {
  return `MAI CORP
INFRASTRUCTURE HANDOFF
=======================

Customer:    ${order.users?.full_name ?? order.users?.email ?? '—'}
Project:     ${order.products?.name ?? '—'}
Order #:     ${order.id}
Date:        ${new Date().toISOString()}

Website:     ${infra?.domain ?? '—'}
Hosting:     ${infra?.hosting ?? '—'}
Database:    ${infra?.database_info ?? '—'}
Email:       ${infra?.email ?? '—'}
Storage:     ${infra?.storage ?? '—'}
Other:       ${infra?.other ?? '—'}

Instructions:
This document is generated by MAI Corp for your project. Use these details
to manage your website or application. For assistance, contact the CEO
directly through the Client Portal.

SECURITY WARNING:
This file contains infrastructure information for your project. Store it
securely. Do not share publicly. If you suspect compromise, contact MAI Corp
immediately so credentials can be rotated.

Support:     support@mai.corp  ·  https://mai.corp/contact
`
}