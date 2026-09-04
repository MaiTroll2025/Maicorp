import { useState } from 'react'
import { Container, H1, Card, Eyebrow, Chip } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function AccountProfilePage() {
  const { user, refresh } = useAuth()
  const [name, setName] = useState((user as any)?.full_name ?? '')
  const [msg, setMsg] = useState<string | null>(null)
  const save = async () => {
    if (!user) return
    const { error } = await supabase.from('users').update({ full_name: name }).eq('id', user.id)
    setMsg(error ? error.message : 'Profile updated.')
    await refresh()
  }
  return (
    <Container className="py-12 max-w-2xl">
      <Eyebrow>Account</Eyebrow>
      <H1 className="mt-2 chrome-text">Profile</H1>
      <Card className="mt-6 space-y-4">
        <div><label className="label">Email</label><input className="input" value={user?.email ?? ''} disabled /></div>
        <div><label className="label">Full name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        {msg && <Chip>{msg}</Chip>}
        <button className="btn-primary" onClick={save}>Save</button>
      </Card>
    </Container>
  )
}