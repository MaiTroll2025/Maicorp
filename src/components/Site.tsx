import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, ShoppingCart } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useCart } from '@/lib/cart'
import { Container } from './ui'
import clsx from 'clsx'
import { NotificationCenter } from './NotificationCenter'

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/companies', label: 'Companies' },
  { to: '/studio', label: 'Technology Studio' },
  { to: '/store', label: 'Store' },
  { to: '/app-updates', label: 'App Updates' },
  { to: '/future', label: 'Future' },
  { to: '/support', label: 'Support' },
  { to: '/contact', label: 'Contact' },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { user, initialized, signOut } = useAuth()
  const cartCount = useCart((s) => s.count())
  const navigate = useNavigate()
  const loc = useLocation()
  const isCeo = user?.role === 'CEO' && user.email.toLowerCase() === 'ceo@maitroll.com'

  useEffect(() => {
    setOpen(false)
  }, [loc.pathname])

  const portalHref =
    !initialized ? '/login'
    : isCeo ? '/ceo'
    : user?.role === 'HR_MANAGER' ? '/hr'
    : user?.role === 'EMPLOYEE' ? '/employee'
    : user?.role === 'CUSTOMER' ? '/account'
    : '/login'

  const portalLabel =
    !initialized ? 'Sign in'
    : isCeo ? 'CEO Command Center'
    : user?.role === 'HR_MANAGER' ? 'HR Dashboard'
    : user?.role === 'EMPLOYEE' ? 'Employee Portal'
    : user?.role === 'CUSTOMER' ? 'Client Portal'
    : 'Sign in'

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-bg/60 border-b border-line/50">
      <Container className="flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <Logo />
          <div className="leading-none">
            <div className="text-[15px] font-semibold tracking-widest chrome-text">MAI CORP</div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-muted">Headquarters</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'px-3 py-2 text-sm rounded-md transition-colors',
                  isActive ? 'text-hi bg-white/5' : 'text-muted hover:text-hi hover:bg-white/5',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          <NotificationCenter />
          <Link to="/cart" className="relative btn-ghost text-sm" aria-label="Cart">
            <ShoppingCart size={16} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] grid place-items-center font-semibold">
                {cartCount}
              </span>
            )}
          </Link>
          <Link to={portalHref} className="btn-ghost text-sm">
            {portalLabel}
          </Link>
          {user && (
            <button
              type="button"
              onClick={() => signOut()}
              className="btn-ghost text-xs px-3 py-1.5"
              aria-label="Sign out"
            >
              Sign out
            </button>
          )}
          {isCeo && (
            <button
              type="button"
              onClick={() => navigate('/ceo')}
              className="btn-primary text-sm"
              aria-label="Open CEO Command Center"
            >
              CEO Command Center
            </button>
          )}
        </div>

        <button
          className="lg:hidden p-2 rounded-md focus-ring text-hi"
          onClick={() => setOpen((s) => !s)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </Container>

      {open && (
        <div className="lg:hidden border-t border-line/50 bg-bg/95">
          <div className="px-5 py-4 flex flex-col gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'px-3 py-2.5 text-sm rounded-md transition-colors',
                    isActive ? 'text-hi bg-white/5' : 'text-muted hover:text-hi hover:bg-white/5',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
            <div className="divider my-2" />
            <Link to="/cart" className="btn-ghost text-sm w-full justify-center">
              <ShoppingCart size={14} className="inline mr-1" /> Cart{cartCount > 0 ? ` (${cartCount})` : ''}
            </Link>
            <Link to={portalHref} className="btn-ghost text-sm w-full justify-center">
              {portalLabel}
            </Link>
            {user && (
              <button
                type="button"
                onClick={() => signOut()}
                className="btn-ghost text-xs px-3 py-1.5 w-full justify-center"
                aria-label="Sign out"
              >
                Sign out
              </button>
            )}
            {isCeo && (
              <Link to="/ceo" className="btn-primary text-sm w-full justify-center">
                CEO Command Center
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export function SiteFooter() {
  const { user } = useAuth()
  const isCeo = user?.role === 'CEO' && user.email.toLowerCase() === 'ceo@maitroll.com'

  return (
    <footer className="border-t border-line/40 mt-20">
      <Container className="py-12 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Logo />
            <span className="text-sm font-semibold tracking-widest chrome-text">MAI CORP</span>
          </div>
          <p className="text-muted leading-relaxed">
            A premium technology corporation building platforms designed to empower people.
          </p>
        </div>
        <div>
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted mb-3">Company</div>
          <FooterLinks links={[
              ['About', '/about'],
              ['Companies', '/companies'],
              ['Future', '/future'],
              ['Contact', '/contact'],
            ]} />
        </div>
        <div>
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted mb-3">Products</div>
          <FooterLinks links={[
              ['Store', '/store'],
              ['Technology Studio', '/studio'],
              ['App Updates', '/app-updates'],
              ['Support', '/support'],
            ]} />
        </div>
        <div>
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted mb-3">Account</div>
          <FooterLinks links={isCeo
            ? [['Client Portal', '/login'], ['CEO Command Center', '/ceo']]
            : [['Client Portal', '/login']]} />
        </div>
      </Container>
      <div className="border-t border-line/40">
        <Container className="py-5 text-xs text-muted flex flex-col md:flex-row items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} MAI Corp. All rights reserved.</div>
          <div>Built with purpose. Built to last.</div>
        </Container>
      </div>
    </footer>
  )
}

function FooterLinks({ links }: { links: [string, string][] }) {
  return (
    <ul className="space-y-2">
      {links.map(([label, href]) => (
        <li key={href}>
          <Link to={href} className="text-muted hover:text-hi transition-colors">
            {label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={clsx('h-7 w-7', className)} aria-hidden>
      <defs>
        <linearGradient id="maitop" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#00BFFF" />
          <stop offset=".5" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#BF00FF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#05070D" stroke="rgba(0,191,255,.25)" />
      <path d="M14 48 L32 14 L50 48 L42 48 L32 30 L22 48 Z" fill="url(#maitop)" />
    </svg>
  )
}