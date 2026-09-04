import { NavLink, Outlet, Link, useLocation, Navigate } from 'react-router-dom'
import { Container, StatusDot } from './ui'
import clsx from 'clsx'
import { useAuth } from '@/lib/auth'
import { useEffect } from 'react'
import {
  LayoutDashboard, ShoppingBag, Users, Building2, Package, Globe, Megaphone,
  BarChart3, Bug, Server, KeyRound, FileLock, Settings, ShieldAlert, BookOpen,
  Briefcase, ClipboardList, ScrollText, Wrench, ListChecks, MessageCircle,
} from 'lucide-react'
import { NotificationCenter } from './NotificationCenter'

export function CeoShell() {
  const { user, loading, initialized } = useAuth()
  const loc = useLocation()

  useEffect(() => {
    document.title = `MAI CORP — CEO Command Center`
  }, [])

  if (!initialized || loading) {
    return <CenterLoading />
  }
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />
  }
  if (user.role !== 'CEO') {
    return <Forbidden />
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <CeoHeader />
      <div className="flex-1 flex">
        <CeoSidebar />
        <main className="flex-1 min-w-0">
          <Container className="py-6 lg:py-8">
            <Outlet />
          </Container>
        </main>
      </div>
    </div>
  )
}

export function HrShell() {
  const { user, loading, initialized } = useAuth()
  const loc = useLocation()
  useEffect(() => {
    document.title = `MAI CORP — HR`
  }, [])
  if (!initialized || loading) return <CenterLoading />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />
  if (user.role !== 'HR_MANAGER' && user.role !== 'CEO') return <Forbidden />
  return (
    <div className="min-h-screen flex flex-col">
      <HrHeader />
      <Container className="py-6">
        <Outlet />
      </Container>
    </div>
  )
}

export function EmployeeShell() {
  const { user, loading, initialized } = useAuth()
  const loc = useLocation()
  useEffect(() => {
    document.title = `MAI CORP — Employee Portal`
  }, [])
  if (!initialized || loading) return <CenterLoading />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />
  if (user.role !== 'EMPLOYEE' && user.role !== 'CEO') return <Forbidden />
  return (
    <div className="min-h-screen flex flex-col">
      <EmployeeHeader />
      <Container className="py-6">
        <Outlet />
      </Container>
    </div>
  )
}

function CeoHeader() {
  const { user, signOut } = useAuth()
  return (
    <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur border-b border-line/40">
      <Container className="h-14 flex items-center justify-between gap-4">
        <Link to="/ceo" className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(0,191,255,.7)]" />
          <span className="text-sm font-semibold tracking-widest chrome-text">CEO COMMAND CENTER</span>
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <NotificationCenter />
          <span className="text-muted hidden sm:inline">{user?.email}</span>
          <Link to="/" className="text-muted hover:text-hi">Public site</Link>
          <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => signOut()}>Sign out</button>
        </div>
      </Container>
    </header>
  )
}

function HrHeader() {
  const { user, signOut } = useAuth()
  return (
    <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur border-b border-line/40">
      <Container className="h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_10px_rgba(139,92,246,.7)]" />
          <span className="text-sm font-semibold tracking-widest chrome-text">HR OPERATIONS</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted hidden sm:inline">{user?.email}</span>
          <Link to="/employee" className="text-muted hover:text-hi">Employee view</Link>
          <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => signOut()}>Sign out</button>
        </div>
      </Container>
    </header>
  )
}

function EmployeeHeader() {
  const { user, signOut } = useAuth()
  return (
    <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur border-b border-line/40">
      <Container className="h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_rgba(191,0,255,.7)]" />
          <span className="text-sm font-semibold tracking-widest chrome-text">EMPLOYEE PORTAL</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted hidden sm:inline">{user?.email}</span>
          <Link to="/" className="text-muted hover:text-hi">Public site</Link>
          <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => signOut()}>Sign out</button>
        </div>
      </Container>
    </header>
  )
}

function CeoSidebar() {
  const groups = [
    {
      title: 'Overview',
      links: [
        ['Dashboard', '/ceo', LayoutDashboard],
        ['System Health', '/ceo/system', Server],
        ['Bug Catcher', '/ceo/bug-catcher', Bug],
        ['Universal Blocker', '/ceo/blocker', ShieldAlert],
        ['Audit Log', '/ceo/audit-log', FileLock],
      ],
    },
    {
      title: 'Operations',
      links: [
        ['HR', '/ceo/hr', Briefcase],
        ['Employees', '/ceo/hr/employees', Users],
        ['Departments', '/ceo/hr/departments', Building2],
        ['Positions', '/ceo/hr/positions', ListChecks],
        ['HR Documents', '/ceo/hr/documents', ScrollText],
        ['Payroll', '/ceo/payroll', BookOpen],
      ],
    },
    {
      title: 'Commerce',
      links: [
        ['Orders', '/ceo/orders', ShoppingBag],
        ['Customer Chats', '/ceo/chats', MessageCircle],
        ['Customers', '/ceo/customers', Users],
        ['Products', '/ceo/products', Package],
        ['Announcements', '/ceo/announcements', Megaphone],
      ],
    },
    {
      title: 'Ecosystem',
      links: [
        ['Companies', '/ceo/companies', Building2],
        ['Platforms', '/ceo/platforms', Server],
        ['App Updates', '/ceo/app-updates', Globe],
        ['Analytics', '/ceo/analytics', BarChart3],
        ['Secrets', '/ceo/secrets', KeyRound],
        ['Infrastructure', '/ceo/infrastructure', Wrench],
      ],
    },
    {
      title: 'Content',
      links: [
        ['Website CMS', '/ceo/website', Globe],
        ['Donations', '/ceo/support', Megaphone],
        ['Contact', '/ceo/contact', ClipboardList],
        ['Settings', '/ceo/settings', Settings],
      ],
    },
  ]

  return (
    <aside className="hidden lg:block w-72 border-r border-line/40 bg-bg/40">
      <div className="px-4 py-5 sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
        {groups.map((g) => (
          <div key={g.title} className="mb-6">
            <div className="text-[10px] tracking-[0.25em] uppercase text-muted mb-2 px-2">{g.title}</div>
            <nav className="space-y-0.5">
              {g.links.map((entry) => {
                const label = entry[0] as string
                const href = entry[1] as string
                const Icon = entry[2] as any
                return (
                  <NavLink
                    key={label}
                    to={href as any}
                    end={href === '/ceo'}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                        isActive ? 'text-hi bg-white/5 border border-line/60' : 'text-muted hover:text-hi hover:bg-white/5',
                      )
                    }
                  >
                    {Icon ? <Icon size={15} className="opacity-80" /> : null}
                    <span>{label}</span>
                  </NavLink>
                )
              })}
            </nav>
          </div>
        ))}
        <div className="px-2 pt-4 border-t border-line/40 text-[11px] text-muted flex items-center gap-2">
          <StatusDot tone="ok" /> All systems normal
        </div>
      </div>
    </aside>
  )
}

export function CenterLoading() {
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="flex items-center gap-3 text-muted">
        <span className="w-3 h-3 rounded-full bg-primary animate-pulseSoft" />
        Loading…
      </div>
    </div>
  )
}

export function Forbidden() {
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="metal-card rounded-2xl p-8 max-w-md text-center">
        <div className="text-5xl mb-3">⛔</div>
        <h2 className="text-2xl font-semibold mb-2">Access denied</h2>
        <p className="text-muted text-sm">
          You do not have permission to view this area. The Universal Blocker recorded this attempt.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/" className="btn-ghost">Public site</Link>
          <Link to="/login" className="btn-primary">Sign in</Link>
        </div>
      </div>
    </div>
  )
}