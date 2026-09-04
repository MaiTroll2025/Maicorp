import { useEffect, useState } from 'react'
import { Container, H1, Card, Eyebrow, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

const KEYS = [
  'hero.headline','hero.subhead','hero.cta_primary','hero.cta_secondary',
  'mission.title','mission.body','mission.attribution',
  'infrastructure.disclaimer','support.headline','support.body',
]

export function CeoWebsite() {
  const [data, setData] = useState<Record<string, any>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [editor, setEditor] = useState<string>('')
  const load = () => supabase.from('page_content').select('key,value').in('key', KEYS).then(({ data: rows }) => {
    const m: Record<string, any> = {}
    for (const r of rows ?? []) m[r.key] = r.value
    setData(m)
  })
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!selected) return
    let value: any
    try { value = JSON.parse(editor) } catch { alert('Must be valid JSON'); return }
    await supabase.from('page_content').upsert({ key: selected, value })
    load()
  }

  return (
    <div className="space-y-6">
      <Eyebrow>CMS</Eyebrow>
      <H1 className="chrome-text">Website content</H1>
      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted">
            <tr><th className="text-left py-2">Key</th><th>Value</th></tr>
          </thead>
          <tbody>
            {KEYS.map((k) => (
              <tr key={k} className="table-row cursor-pointer hover:bg-white/5" onClick={() => { setSelected(k); setEditor(JSON.stringify(data[k] ?? {}, null, 2)) }}>
                <td className="py-2 font-mono text-xs">{k}</td>
                <td className="text-xs text-muted truncate max-w-[600px]">{JSON.stringify(data[k] ?? {}).slice(0, 120)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {selected && (
        <Card>
          <H1 className="text-2xl">{selected}</H1>
          <p className="text-sm text-muted mt-1">Edit JSON. Save to update the public site immediately.</p>
          <textarea className="input mt-4 font-mono text-xs" rows={16} value={editor} onChange={(e) => setEditor(e.target.value)} />
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={save}>Save</button>
            <button className="btn-ghost" onClick={() => setSelected(null)}>Close</button>
          </div>
        </Card>
      )}
    </div>
  )
}