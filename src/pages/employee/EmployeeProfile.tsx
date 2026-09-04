import { useEffect, useState } from 'react'
import { Container, H1, Card, Eyebrow } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function EmployeeProfile() {
  const { user } = useAuth()
  const [emp, setEmp] = useState<any | null>(null)
  useEffect(() => {
    if (!user) return
    supabase.from('employees').select('*,positions(title),departments(name)').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setEmp(data))
  }, [user])
  if (!emp) return <Container className="py-20 text-muted">Loading…</Container>
  return (
    <div className="space-y-6">
      <Eyebrow>Profile</Eyebrow>
      <H1 className="chrome-text">{emp.first_name} {emp.last_name}</H1>
      <Card>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field k="Email" v={emp.email} />
          <Field k="Phone" v={emp.phone} />
          <Field k="Preferred name" v={emp.preferred_name} />
          <Field k="Employee #" v={emp.employee_number} />
          <Field k="Department" v={emp.departments?.name} />
          <Field k="Position" v={emp.positions?.title} />
          <Field k="Start date" v={emp.start_date} />
          <Field k="Type" v={emp.employment_type} />
        </div>
      </Card>
    </div>
  )
}

function Field({ k, v }: { k: string; v: any }) {
  return <div><div className="text-xs uppercase tracking-widest text-muted">{k}</div><div className="mt-1">{v ?? '—'}</div></div>
}