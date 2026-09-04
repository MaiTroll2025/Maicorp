import { useEffect, useState } from 'react'
import { H1, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

interface Product { id: string; slug: string; name: string; category: string; description: string | null; price_cents: number; currency: string; status: string; featured: boolean; sort_order: number; estimated_delivery: string | null; management_available: boolean; features: string[] }

export function CeoProducts() {
  const [rows, setRows] = useState<Product[]>([])
  const [editing, setEditing] = useState<Partial<Product> | null>(null)
  const load = () => supabase.from('products').select('*').order('sort_order').then(({ data }) => setRows((data ?? []) as any))
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!editing) return
    const payload: any = { ...editing }
    if (editing.id) await supabase.from('products').update(payload).eq('id', editing.id)
    else await supabase.from('products').insert(payload)
    setEditing(null); load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div><Eyebrow>Store</Eyebrow><H1 className="chrome-text">Products</H1></div>
        <button className="btn-primary" onClick={() => setEditing({ slug: '', name: '', category: 'WEBSITES', currency: 'USD', price_cents: 0, status: 'AVAILABLE', sort_order: 100 })}>Add product</button>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted">
            <tr><th className="text-left py-2">Name</th><th>Category</th><th>Status</th><th>Featured</th><th className="text-right">Price</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="table-row">
                <td className="py-2">{p.name}</td>
                <td>{p.category}</td>
                <td><Chip>{p.status}</Chip></td>
                <td>{p.featured ? '★' : ''}</td>
                <td className="text-right">{p.price_cents ? `$${(p.price_cents/100).toFixed(2)}` : 'Quote'}</td>
                <td><button className="text-xs text-primary" onClick={() => setEditing(p)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editing && (
        <Card>
          <H1 className="text-2xl">{editing.id ? 'Edit product' : 'New product'}</H1>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">Slug</label><input className="input" value={editing.slug ?? ''} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
            <div><label className="label">Name</label><input className="input" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><label className="label">Category</label>
              <select className="input" value={editing.category ?? 'WEBSITES'} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                {['WEBSITES','APPLICATIONS','ECOMMERCE','CUSTOM','MANAGEMENT'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Status</label>
              <select className="input" value={editing.status ?? 'AVAILABLE'} onChange={(e) => setEditing({ ...editing, status: e.target.value as any })}>
                {['AVAILABLE','DRAFT','RETIRED'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Price (cents)</label><input className="input" type="number" value={editing.price_cents ?? 0} onChange={(e) => setEditing({ ...editing, price_cents: Number(e.target.value) })} /></div>
            <div><label className="label">Currency</label><input className="input" value={editing.currency ?? 'USD'} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} /></div>
            <div><label className="label">Featured</label>
              <select className="input" value={String(editing.featured ?? false)} onChange={(e) => setEditing({ ...editing, featured: e.target.value === 'true' })}>
                <option value="false">No</option><option value="true">Yes</option>
              </select>
            </div>
            <div><label className="label">Sort order</label><input className="input" type="number" value={editing.sort_order ?? 100} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
            <div><label className="label">Estimated delivery</label><input className="input" value={editing.estimated_delivery ?? ''} onChange={(e) => setEditing({ ...editing, estimated_delivery: e.target.value })} /></div>
            <div><label className="label">Management available</label>
              <select className="input" value={String(editing.management_available ?? true)} onChange={(e) => setEditing({ ...editing, management_available: e.target.value === 'true' })}>
                <option value="true">Yes</option><option value="false">No</option>
              </select>
            </div>
            <div className="md:col-span-2"><label className="label">Description</label><textarea className="input" rows={4} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="md:col-span-2"><label className="label">Features (one per line)</label><textarea className="input" rows={5} value={(Array.isArray(editing.features) ? editing.features : []).join('\n')} onChange={(e) => setEditing({ ...editing, features: e.target.value.split('\n').filter(Boolean) })} /></div>
          </div>
          <div className="mt-5 flex gap-2">
            <button className="btn-primary" onClick={save}>Save</button>
            <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </Card>
      )}
    </div>
  )
}