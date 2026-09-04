import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Container, H1, Card, Eyebrow, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const nav = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null)
    if (password !== confirm) { setErr('Passwords do not match'); return }
    if (password.length < 8) { setErr('Password must be at least 8 characters'); return }
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: name } },
    })
    if (error) { setErr(error.message); return }
    if (data.user) {
      // Create public.users row
      await supabase.from('users').upsert({ id: data.user.id, email, full_name: name, role: 'CUSTOMER' })
      setDone(true)
      setTimeout(() => nav('/login'), 1500)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 py-16">
      <Container className="max-w-md w-full">
        <Eyebrow>Create account</Eyebrow>
        <H1 className="mt-2 chrome-text text-4xl">Join MAI Corp.</H1>
        <Card className="mt-6">
          {done ? <Chip tone="ok">Account created — check your email to verify. Redirecting…</Chip> : (
            <form onSubmit={submit} className="space-y-4">
              <div><label className="label">Full name</label><input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><label className="label">Email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><label className="label">Password</label><input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div><label className="label">Confirm password</label><input className="input" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
              {err && <Chip tone="err">{err}</Chip>}
              <button className="btn-primary w-full justify-center" type="submit">Create account</button>
            </form>
          )}
          <div className="mt-5 text-sm text-muted flex justify-between">
            <Link to="/login" className="hover:text-hi">Sign in</Link>
          </div>
        </Card>
      </Container>
    </div>
  )
}