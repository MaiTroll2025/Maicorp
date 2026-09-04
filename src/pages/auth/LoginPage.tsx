import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Container, H1, Card, Eyebrow, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useEffect } from 'react'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()
  const [params] = useSearchParams()
  const { refresh } = useAuth()

  useEffect(() => {
    const msg = params.get('msg')
    if (msg === 'revoked') setErr('Your account access has been revoked.')
  }, [params])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null); setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setErr(error.message); return }
    await refresh()
    const next = params.get('next')
    if (next) { nav(next); return }
    const u = await supabase.from('users').select('role').eq('id', data.user.id).maybeSingle()
    switch (u.data?.role) {
      case 'CEO': nav('/ceo'); break
      case 'HR_MANAGER': nav('/hr'); break
      case 'EMPLOYEE': nav('/employee'); break
      case 'CUSTOMER': nav('/account'); break
      default: nav('/')
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 py-16">
      <Container className="max-w-md w-full">
        <Eyebrow>Sign in</Eyebrow>
        <H1 className="mt-2 chrome-text text-4xl">Welcome back.</H1>
        <Card className="mt-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && <Chip tone="err">{err}</Chip>}
            <button className="btn-primary w-full justify-center" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <div className="mt-5 text-sm text-muted flex justify-between">
            <Link to="/signup" className="hover:text-hi">Create account</Link>
          </div>
        </Card>
      </Container>
    </div>
  )
}