import { Link } from 'react-router-dom'
import { Container, H1, H3, Card, Eyebrow, Chip } from '@/components/ui'
import { useAuth } from '@/lib/auth'

export function AccountPage() {
  const { user } = useAuth()
  return (
    <Container className="py-16">
      <Eyebrow>Client Portal</Eyebrow>
      <H1 className="mt-2 chrome-text">Welcome back.</H1>
      <p className="mt-2 text-muted">{user?.email}</p>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/account/orders" className="block"><Card><H3>Orders</H3><p className="mt-2 text-sm text-muted">View purchases and project status.</p></Card></Link>
        <Link to="/account/infrastructure" className="block"><Card><H3>Infrastructure</H3><p className="mt-2 text-sm text-muted">Hosting, domains, and handoff documents.</p></Card></Link>
        <Link to="/account/profile" className="block"><Card><H3>Profile</H3><p className="mt-2 text-sm text-muted">Update your account details.</p></Card></Link>
      </div>
    </Container>
  )
}