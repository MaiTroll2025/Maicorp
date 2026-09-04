import { useEffect, useState } from 'react'
import { Container, H1, Card, Eyebrow } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function EmployeeEmployment() {
  const { user } = useAuth()
  const [records, setRecords] = useState<any[]>([])
  useEffect(() => {
    if (!user) return
    supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        supabase.from('employment_records').select('*').eq('employee_id', data.id).order('effective_from', { ascending: false })
          .then(({ data: rows }) => setRecords(rows ?? []))
      })
  }, [user])
  return (
    <div className="space-y-6">
      <Eyebrow>Employment</Eyebrow>
      <H1 className="chrome-text">Employment history</H1>
      <Card>
        <ul className="space-y-2 text-sm">
          {records.map((r) => (
            <li key={r.id} className="flex items-center justify-between border-b border-white/5 pb-2">
              <div><div className="font-medium">{r.change_type}</div><div className="text-xs text-muted">{r.effective_from} → {r.effective_to ?? 'current'}</div></div>
              <div className="text-xs text-muted">{r.reason ?? ''}</div>
            </li>
          ))}
          {records.length === 0 && <li className="text-muted">No employment history.</li>}
        </ul>
      </Card>
    </div>
  )
}