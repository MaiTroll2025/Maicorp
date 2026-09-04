import { Routes, Route, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { SiteHeader, SiteFooter } from './components/Site'
import { CeoShell, HrShell, EmployeeShell, CenterLoading } from './components/Shells'
import { useAuth } from './lib/auth'
import { initBugCatcher } from './lib/bugCatcher'
import { Seo } from './components/Seo'
import { organizationSchema, websiteSchema } from './config/seo'

import { HomePage } from './pages/public/HomePage'
import { AboutPage } from './pages/public/AboutPage'
import { CompaniesPage } from './pages/public/CompaniesPage'
import { CompanyDetailPage } from './pages/public/CompanyDetailPage'
import { FuturePage } from './pages/public/FuturePage'
import { StudioPage } from './pages/public/StudioPage'
import { StoreIndexPage } from './pages/public/StoreIndexPage'
import { StoreCategoryPage } from './pages/public/StoreCategoryPage'
import { ProductDetailPage } from './pages/public/ProductDetailPage'
import { CartPage } from './pages/public/CartPage'
import { CheckoutPage } from './pages/public/CheckoutPage'
import { AppUpdatesPage } from './pages/public/AppUpdatesPage'
import { SupportPage } from './pages/public/SupportPage'
import { ContactPage } from './pages/public/ContactPage'

import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'

import { AccountPage } from './pages/account/AccountPage'
import { AccountOrdersPage } from './pages/account/AccountOrdersPage'
import { AccountOrderDetailPage } from './pages/account/AccountOrderDetailPage'
import { AccountInfrastructurePage } from './pages/account/AccountInfrastructurePage'
import { AccountProfilePage } from './pages/account/AccountProfilePage'

import { CeoDashboard } from './pages/ceo/CeoDashboard'
import { CeoOrders } from './pages/ceo/CeoOrders'
import { CeoOrderDetail } from './pages/ceo/CeoOrderDetail'
import { CeoCustomers } from './pages/ceo/CeoCustomers'
import { CeoCompanies } from './pages/ceo/CeoCompanies'
import { CeoProducts } from './pages/ceo/CeoProducts'
import { CeoWebsite } from './pages/ceo/CeoWebsite'
import { CeoAnnouncements } from './pages/ceo/CeoAnnouncements'
import { CeoAnalytics } from './pages/ceo/CeoAnalytics'
import { CeoBugCatcher } from './pages/ceo/CeoBugCatcher'
import { CeoPlatforms } from './pages/ceo/CeoPlatforms'
import { CeoAppUpdates } from './pages/ceo/CeoAppUpdates'
import { CeoInfrastructure } from './pages/ceo/CeoInfrastructure'
import { CeoSecrets } from './pages/ceo/CeoSecrets'
import { CeoAuditLog } from './pages/ceo/CeoAuditLog'
import { CeoSettings } from './pages/ceo/CeoSettings'
import { CeoHr } from './pages/ceo/CeoHr'
import { CeoEmployees } from './pages/ceo/CeoEmployees'
import { CeoEmployeeDetail } from './pages/ceo/CeoEmployeeDetail'
import { CeoDepartments } from './pages/ceo/CeoDepartments'
import { CeoPositions } from './pages/ceo/CeoPositions'
import { CeoHrDocuments } from './pages/ceo/CeoHrDocuments'
import { CeoPayroll } from './pages/ceo/CeoPayroll'
import { CeoBlocker } from './pages/ceo/CeoBlocker'
import { CeoSystem } from './pages/ceo/CeoSystem'
import { CeoContactInbox } from './pages/ceo/CeoContactInbox'
import { CeoDonations } from './pages/ceo/CeoDonations'
import { CeoChats } from './pages/ceo/CeoChats'

import { HrDashboard } from './pages/hr/HrDashboard'
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard'
import { EmployeeProfile } from './pages/employee/EmployeeProfile'
import { EmployeeEmployment } from './pages/employee/EmployeeEmployment'
import { EmployeeDocuments } from './pages/employee/EmployeeDocuments'
import { EmployeeRequests } from './pages/employee/EmployeeRequests'
import { EmployeeTimesheets } from './pages/employee/EmployeeTimesheets'
import { EmployeeCalendarPage } from './pages/employee/EmployeeCalendarPage'
import { EmployeePay } from './pages/employee/EmployeePay'

function PublicLayout() {
  const location = useLocation()
  const pageSeo: Record<string, { title: string; description: string }> = {
    '/': { title: 'MAI Corp | Technology Built With AI by Humans', description: 'MAI Corp builds social, automotive, driver, marketplace, and digital business platforms with human-led development.' },
    '/about': { title: 'About MAI Corp | Human-Led Technology', description: 'Learn about MAI Corp, its mission, public platforms, and the people who build and operate them.' },
    '/companies': { title: 'MAI Corp Companies | Public Platforms', description: 'Explore MaiTroll, Otach, Udryve, and MAI Dash, the public platforms built by MAI Corp.' },
    '/future': { title: 'MAI Corp Future Platforms', description: 'See the public products and platforms MAI Corp is developing next.' },
    '/studio': { title: 'MAI Corp Technology Studio', description: 'MAI Corp designs and builds websites, applications, ecommerce, and custom business platforms.' },
    '/store': { title: 'MAI Corp Store | Digital Products and Services', description: 'Browse MAI Corp website packages, applications, ecommerce builds, and managed digital services.' },
    '/app-updates': { title: 'MAI Corp App Updates | Product Updates', description: 'See the latest updates across all MAI Corp platforms — MaiTroll, Otach, Udryve, and MAI Dash.' },
    '/support': { title: 'Support MAI Corp', description: 'Support the human-led technology mission behind MAI Corp and its public platforms.' },
    '/contact': { title: 'Contact MAI Corp', description: 'Contact MAI Corp about platforms, technology services, partnerships, and support.' },
  }
  const seo = pageSeo[location.pathname] ?? { title: 'MAI Corp | Public Technology Platform', description: 'MAI Corp builds useful public technology platforms with human-led development.' }
  return (
    <div className="min-h-screen flex flex-col">
      <Seo title={seo.title} description={seo.description} path={location.pathname} jsonLd={location.pathname === '/' ? [organizationSchema(), websiteSchema()] : undefined} />
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

function AccountLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="metal-card rounded-2xl p-10 max-w-lg text-center">
        <div className="text-7xl chrome-text font-semibold">404</div>
        <p className="text-muted mt-3">We couldn't locate that page.</p>
        <a href="/" className="btn-primary mt-6">Return home</a>
      </div>
    </div>
  )
}

function RouteSync() {
  const loc = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])
  return null
}

function RouteSeoPolicy() {
  const location = useLocation()
  const isPublic =     ['/', '/about', '/companies', '/future', '/studio', '/store', '/app-updates', '/support', '/contact'].some((route) =>
    location.pathname === route || location.pathname.startsWith(`${route}/`),
  )
  if (isPublic) return null
  return <Seo title="MAI Corp Private Area" description="This MAI Corp area is private." path={location.pathname} noindex nofollow />
}

export default function App() {
  const { init } = useAuth()
  useEffect(() => {
    init()
    initBugCatcher()
  }, [init])
  const { initialized } = useAuth()
  return (
    <>
      <RouteSync />
      <RouteSeoPolicy />
      <Routes>
        {/* Public */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/companies/:slug" element={<CompanyDetailPage />} />
          <Route path="/future" element={<FuturePage />} />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/store" element={<StoreIndexPage />} />
          <Route path="/store/:category" element={<StoreCategoryPage />} />
          <Route path="/store/product/:slug" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout/:orderId" element={<CheckoutPage />} />
          <Route path="/app-updates" element={<AppUpdatesPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>

        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Customer */}
        <Route element={<AccountLayout />}>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/profile" element={<AccountProfilePage />} />
          <Route path="/account/orders" element={<AccountOrdersPage />} />
          <Route path="/account/orders/:id" element={<AccountOrderDetailPage />} />
          <Route path="/account/infrastructure" element={<AccountInfrastructurePage />} />
        </Route>

        {/* HR */}
        <Route element={<HrShell />}>
          <Route path="/hr" element={<HrDashboard />} />
        </Route>

        {/* Employee */}
        <Route element={<EmployeeShell />}>
          <Route path="/employee" element={<EmployeeDashboard />} />
          <Route path="/employee/profile" element={<EmployeeProfile />} />
          <Route path="/employee/employment" element={<EmployeeEmployment />} />
          <Route path="/employee/documents" element={<EmployeeDocuments />} />
          <Route path="/employee/requests" element={<EmployeeRequests />} />
          <Route path="/employee/timesheets" element={<EmployeeTimesheets />} />
          <Route path="/employee/calendar" element={<EmployeeCalendarPage />} />
          <Route path="/employee/pay" element={<EmployeePay />} />
        </Route>

        {/* CEO */}
        <Route element={<CeoShell />}>
          <Route path="/ceo" element={<CeoDashboard />} />
          <Route path="/ceo/orders" element={<CeoOrders />} />
          <Route path="/ceo/chats" element={<CeoChats />} />
          <Route path="/ceo/orders/:id" element={<CeoOrderDetail />} />
          <Route path="/ceo/customers" element={<CeoCustomers />} />
          <Route path="/ceo/companies" element={<CeoCompanies />} />
          <Route path="/ceo/products" element={<CeoProducts />} />
          <Route path="/ceo/website" element={<CeoWebsite />} />
          <Route path="/ceo/announcements" element={<CeoAnnouncements />} />
          <Route path="/ceo/analytics" element={<CeoAnalytics />} />
          <Route path="/ceo/bug-catcher" element={<CeoBugCatcher />} />
          <Route path="/ceo/platforms" element={<CeoPlatforms />} />
          <Route path="/ceo/app-updates" element={<CeoAppUpdates />} />
          <Route path="/ceo/infrastructure" element={<CeoInfrastructure />} />
          <Route path="/ceo/secrets" element={<CeoSecrets />} />
          <Route path="/ceo/audit-log" element={<CeoAuditLog />} />
          <Route path="/ceo/settings" element={<CeoSettings />} />
          <Route path="/ceo/hr" element={<CeoHr />} />
          <Route path="/ceo/hr/employees" element={<CeoEmployees />} />
          <Route path="/ceo/hr/employees/:id" element={<CeoEmployeeDetail />} />
          <Route path="/ceo/hr/departments" element={<CeoDepartments />} />
          <Route path="/ceo/hr/positions" element={<CeoPositions />} />
          <Route path="/ceo/hr/documents" element={<CeoHrDocuments />} />
          <Route path="/ceo/payroll" element={<CeoPayroll />} />
          <Route path="/ceo/blocker" element={<CeoBlocker />} />
          <Route path="/ceo/system" element={<CeoSystem />} />
          <Route path="/ceo/contact" element={<CeoContactInbox />} />
          <Route path="/ceo/support" element={<CeoDonations />} />
        </Route>

        <Route path="*" element={initialized ? <NotFound /> : <CenterLoading />} />
      </Routes>
    </>
  )
}