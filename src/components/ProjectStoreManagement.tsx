import { useEffect, useState } from 'react'
import { Card, Chip, H3 } from './ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const STORE_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'SUBMISSION', 'REVIEW', 'PUBLISHED', 'BLOCKED'] as const
type Owner = 'CUSTOMER' | 'MAI_CORP'
type StoreStatus = typeof STORE_STATUSES[number]

interface StoreManagement {
  order_id: string
  apple_account_owner: Owner
  google_account_owner: Owner
  apple_status: StoreStatus
  google_status: StoreStatus
  apple_app_id: string | null
  google_package_name: string | null
  management_enabled: boolean
  monthly_fee_cents: number | null
  updated_at: string
}

export function ProjectStoreManagement({ orderId, isCeo = false }: { orderId: string; isCeo?: boolean }) {
  const { user } = useAuth()
  const [store, setStore] = useState<StoreManagement | null>(null)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<StoreManagement>(defaultStore(orderId))

  const load = async () => {
    const { data } = await supabase.from('project_store_management').select('*').eq('order_id', orderId).maybeSingle()
    if (data) { setStore(data); setDraft(data) }
  }

  useEffect(() => { load() }, [orderId])

  const save = async () => {
    if (!user || !isCeo) return
    setSaving(true)
    const { data } = await supabase.from('project_store_management').upsert({ ...draft, updated_by: user.id, updated_at: new Date().toISOString() }).select().single()
    if (data) setStore(data)
    setSaving(false)
  }

  const current = store ?? draft
  return (
    <Card>
      <div className="flex items-center justify-between gap-3"><H3>App store management</H3>{current.management_enabled && <Chip tone="purp">MAI Corp managed</Chip>}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <StoreRow label="Apple App Store" owner={current.apple_account_owner} status={current.apple_status} identifier={current.apple_app_id} identifierLabel="App ID" />
        <StoreRow label="Google Play" owner={current.google_account_owner} status={current.google_status} identifier={current.google_package_name} identifierLabel="Package name" />
      </div>
      {isCeo && (
        <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
          <div className="text-xs uppercase tracking-widest text-muted">Publishing responsibility</div>
          <StoreEditor label="Apple" owner={draft.apple_account_owner} status={draft.apple_status} identifier={draft.apple_app_id ?? ''} identifierLabel="Apple App ID" onOwner={(value) => setDraft({ ...draft, apple_account_owner: value })} onStatus={(value) => setDraft({ ...draft, apple_status: value })} onIdentifier={(value) => setDraft({ ...draft, apple_app_id: value || null })} />
          <StoreEditor label="Google Play" owner={draft.google_account_owner} status={draft.google_status} identifier={draft.google_package_name ?? ''} identifierLabel="Google package name" onOwner={(value) => setDraft({ ...draft, google_account_owner: value })} onStatus={(value) => setDraft({ ...draft, google_status: value })} onIdentifier={(value) => setDraft({ ...draft, google_package_name: value || null })} />
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={draft.management_enabled} onChange={(event) => setDraft({ ...draft, management_enabled: event.target.checked })} /> MAI Corp manages store publishing</label>
          <input className="input" type="number" min="0" value={draft.monthly_fee_cents ?? ''} onChange={(event) => setDraft({ ...draft, monthly_fee_cents: event.target.value ? Number(event.target.value) : null })} placeholder="Monthly management fee in cents" />
          <button className="btn-primary w-full" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save store management'}</button>
        </div>
      )}
    </Card>
  )
}

function StoreRow({ label, owner, status, identifier, identifierLabel }: { label: string; owner: Owner; status: StoreStatus; identifier: string | null; identifierLabel: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/10 p-4"><div className="font-medium">{label}</div><div className="mt-3 flex flex-wrap gap-2"><Chip>{owner === 'MAI_CORP' ? 'MAI Corp account' : 'Customer account'}</Chip><Chip tone={status === 'PUBLISHED' ? 'ok' : status === 'BLOCKED' ? 'err' : 'info'}>{formatStatus(status)}</Chip></div>{identifier && <div className="mt-3 text-xs text-muted">{identifierLabel}: <span className="text-hi/80">{identifier}</span></div>}</div>
}

function StoreEditor({ label, owner, status, identifier, identifierLabel, onOwner, onStatus, onIdentifier }: { label: string; owner: Owner; status: StoreStatus; identifier: string; identifierLabel: string; onOwner: (value: Owner) => void; onStatus: (value: StoreStatus) => void; onIdentifier: (value: string) => void }) {
  return <div className="rounded-xl border border-white/10 p-3"><div className="mb-2 text-sm font-medium">{label}</div><div className="grid gap-2 sm:grid-cols-3"><select className="input" value={owner} onChange={(event) => onOwner(event.target.value as Owner)}><option value="CUSTOMER">Customer account</option><option value="MAI_CORP">MAI Corp account</option></select><select className="input" value={status} onChange={(event) => onStatus(event.target.value as StoreStatus)}>{STORE_STATUSES.map((value) => <option key={value} value={value}>{formatStatus(value)}</option>)}</select><input className="input" value={identifier} onChange={(event) => onIdentifier(event.target.value)} placeholder={identifierLabel} /></div></div>
}

function defaultStore(orderId: string): StoreManagement {
  return { order_id: orderId, apple_account_owner: 'CUSTOMER', google_account_owner: 'CUSTOMER', apple_status: 'NOT_STARTED', google_status: 'NOT_STARTED', apple_app_id: null, google_package_name: null, management_enabled: false, monthly_fee_cents: null, updated_at: new Date().toISOString() }
}

function formatStatus(status: StoreStatus) {
  return status.replaceAll('_', ' ').toLowerCase().replace(/(^| )\w/g, (letter) => letter.toUpperCase())
}
