import { useEffect, useState } from 'react'
import { Container, H1, Card, Eyebrow } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function EmployeeDocuments() {
  const { user } = useAuth()
  const [docs, setDocs] = useState<any[]>([])
  useEffect(() => {
    if (!user) return
    supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        supabase.from('employee_documents').select('*').eq('employee_id', data.id).order('created_at', { ascending: false })
          .then(({ data: rows }) => setDocs(rows ?? []))
      })
  }, [user])
  return (
    <div className="space-y-6">
      <Eyebrow>Documents</Eyebrow>
      <H1 className="chrome-text">My documents</H1>
      <Card>
        {docs.length === 0 ? <p className="text-muted">No documents assigned.</p> : (
          <ul className="text-sm space-y-2">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between border-b border-white/5 pb-2">
                <div><div className="font-medium">{d.title}</div><div className="text-xs text-muted">{d.kind}</div></div>
                <span className="text-xs text-muted">{new Date(d.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}