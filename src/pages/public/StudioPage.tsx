import { Link } from 'react-router-dom'
import { Container, H1, H2, H3, Card, Eyebrow } from '@/components/ui'
import { ArrowRight } from 'lucide-react'

const SERVICES = [
  ['Website Development', 'Premium marketing sites, brand sites, and high-converting landing experiences.'],
  ['Web Applications', 'Internal tools, customer portals, dashboards, booking, membership platforms.'],
  ['E-Commerce', 'End-to-end storefronts with cart, checkout, order management, and customer accounts.'],
  ['Customer Portals', 'Secure authenticated areas for customers, vendors, and members.'],
  ['Booking Platforms', 'Scheduling, reservations, calendar, and confirmation flows.'],
  ['Membership Platforms', 'Subscription, paywall, and gated content systems.'],
  ['Business Platforms', 'Operations platforms, inventory, CRM, and custom internal systems.'],
  ['Custom Applications', 'Anything else — greenfield builds shaped around your business.'],
  ['AI-Powered Solutions', 'AI-assisted UX, intelligent search, content tooling, agents.'],
  ['Database Systems', 'Schema design, RLS policies, migrations, integrations, observability.'],
  ['Admin Dashboards', 'Operations-grade admin panels, audit logs, and analytics.'],
  ['Payment Integrations', 'PayPal, Stripe, billing flows, refunds, webhooks.'],
  ['Ongoing Management', 'Optional monthly plans for hosting, monitoring, content, and updates.'],
]

export function StudioPage() {
  return (
    <>
      <section>
        <Container className="pt-20 pb-12 text-center">
          <Eyebrow>Technology Studio</Eyebrow>
          <H1 className="mt-3 chrome-text">Your idea. Our technology.</H1>
          <p className="mt-5 max-w-2xl mx-auto text-muted">MAI Corp Technology Studio designs, builds, and operates premium digital products — websites, applications, ecommerce, and custom platforms.</p>
        </Container>
      </section>

      <section className="border-t border-line/30">
        <Container className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICES.map(([title, body]) => (
              <Card key={title}>
                <H3>{title}</H3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-line/30">
        <Container className="py-20 text-center">
          <H2 className="chrome-text">Start your project.</H2>
          <p className="mt-3 text-muted">Tell us what you want to build. We'll respond with a clear plan.</p>
          <div className="mt-7 flex justify-center gap-3">
            <Link to="/contact" className="btn-primary">Contact the Studio <ArrowRight size={16} /></Link>
            <Link to="/store" className="btn-ghost">Browse packages</Link>
          </div>
        </Container>
      </section>
    </>
  )
}