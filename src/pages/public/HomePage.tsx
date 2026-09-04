import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Container, H1, H2, H3, Card, GlassCard, Eyebrow, Chip } from '@/components/ui'
import { useCmsContent } from '@/lib/cms'
import { supabase } from '@/lib/supabase'
import { ArrowRight, Shield, Cpu, Users, Sparkles, LockKeyhole } from 'lucide-react'

const PLATFORM_INTENTS = [
  ['Automotive and auto repair', 'Otach', '/companies/otach'],
  ['Delivery and driver work', 'Udryve', '/companies/udryve'],
  ['Broadcasting and streaming', 'MaiTroll', '/companies/maitroll'],
  ['Social media and creators', 'MaiTroll', '/companies/maitroll'],
  ['Local services and contractors', 'MAI Dash', '/companies/mai-dash'],
] as const

const MAI_WAY_STEPS = [
  ['01', 'IDEA', 'We start with a problem worth solving.'],
  ['02', 'BUILD', 'We turn ideas into real products.'],
  ['03', 'HUMAN + AI', 'AI accelerates the work. Humans make the decisions.'],
  ['04', 'TEST', 'We break it, fix it, and make it better.'],
  ['05', 'LAUNCH', 'Real products belong in the real world.'],
  ['06', 'IMPROVE', 'We listen, learn, and keep building.'],
] as const

interface Company {
  id: string
  slug: string
  name: string
  tagline: string | null
  description: string | null
  status: string
  featured: boolean
  category: string | null
}

const COMPANY_SUMMARIES: Record<string, string> = {
  maitroll: 'Social entertainment platform for live interaction, creators, and community.',
  otach: 'Smarter vehicle ownership through diagnostics, education, and cost transparency.',
  udryve: 'Next-generation driver platform for earning through the MAI Corp ecosystem.',
  'mai-dash': 'Connect. Service. Get it done.',
}

export function HomePage() {
  const hero = useCmsContent('hero.headline', { lines: ['BUILDING', 'TECHNOLOGY', 'WITH PURPOSE.'] })
  const subhead = useCmsContent('hero.subhead', {
    text: 'With the help of AI, I was able to create and develop apps designed to bring people joy, create opportunities, and help people earn money from home.',
  })
  const ctaA = useCmsContent('hero.cta_primary', { label: 'Explore Our Companies', href: '/companies' })
  const ctaB = useCmsContent('hero.cta_secondary', { label: 'Meet MAI Corp', href: '/about' })

  const mission = useCmsContent('mission.title', { text: 'THE MAI CORP MISSION' })
  const missionBody = useCmsContent('mission.body', [
    'MAI Corp was built on a simple idea: people deserve better.',
    'Whether you are a customer, user, driver, contractor, broadcaster, creator, or employee, your time and effort have value.',
    'We believe technology should create opportunity — not simply take from the people using it.',
    'From day one, customer service has been at the heart of MAI Corp. As CEO, I strive to build platforms where people can enjoy themselves, earn, connect, and become something better than they were yesterday.',
    "Our goal isn't just to build apps. It's to build opportunities.",
  ])
  const attribution = useCmsContent('mission.attribution', { name: 'Joshua Tucker', title: 'CEO, MAI Corp' })

  const [companies, setCompanies] = useState<Company[]>([])
  useEffect(() => {
    supabase
      .from('companies')
      .select('id,slug,name,tagline,description,status,featured,category')
      .eq('featured', true)
      .order('sort_order')
      .then(({ data }) => setCompanies(data ?? []))
  }, [])

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 right-[-10%] w-[700px] h-[700px] rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(circle, #8B5CF6, transparent 60%)' }} />
          <div className="absolute -bottom-40 left-[-10%] w-[700px] h-[700px] rounded-full blur-3xl opacity-25" style={{ background: 'radial-gradient(circle, #00BFFF, transparent 60%)' }} />
        </div>
        <Container className="relative pt-20 pb-16 lg:pt-32 lg:pb-24">
          <Eyebrow>MAI CORP · Headquarters</Eyebrow>
          <p className="mt-5 text-lg font-medium text-hi/90">Welcome to MAI Corp. This is the MAI Way.</p>
          <H1 className="mt-4 max-w-5xl">
            <div className="chrome-text">{(hero.value?.lines ?? ['BUILDING','TECHNOLOGY','WITH PURPOSE.']).join(' ')}</div>
          </H1>
          <p className="mt-6 max-w-2xl text-lg text-muted leading-relaxed">
            {subhead.value?.text}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to={ctaA.value?.href ?? '/companies'} className="btn-primary">
              {ctaA.value?.label ?? 'Explore Our Companies'} <ArrowRight size={16} />
            </Link>
            <Link to={ctaB.value?.href ?? '/about'} className="btn-ghost">
              {ctaB.value?.label ?? 'Meet MAI Corp'}
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs tracking-[0.25em] uppercase">
            <div className="metal-card rounded-xl px-5 py-4 text-center">Built for People</div>
            <div className="metal-card rounded-xl px-5 py-4 text-center">Built to Empower</div>
            <div className="metal-card rounded-xl px-5 py-4 text-center">Built to Last</div>
          </div>
        </Container>
      </section>

      {/* THE MAI WAY */}
      <section className="border-t border-line/30">
        <Container className="py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5">
              <Eyebrow>THE MAI WAY</Eyebrow>
              <H2 className="mt-3 chrome-text">We don't just build apps. We build opportunities.</H2>
              <p className="mt-6 text-lg leading-relaxed text-hi/90">The MAI Way is how MAI Corp turns ideas into real technology — combining human creativity, relentless work, modern engineering, and AI-assisted development to build products designed for real people.</p>
              <p className="mt-4 text-sm font-medium text-primary">Built with AI by humans who work 12 hours a day.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-7 lg:grid-cols-3">
              {MAI_WAY_STEPS.map(([number, title, body]) => (
                <div key={number} className="metal-card rounded-xl p-5">
                  <div className="text-xs font-mono tracking-widest text-primary">{number}</div>
                  <h3 className="mt-5 text-base font-semibold tracking-wide">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* COMPANIES */}
      <section className="border-t border-line/30">
        <Container className="py-16 lg:py-20">
          <div className="flex items-end justify-between gap-6 mb-10">
            <div>
              <Eyebrow>Our Companies</Eyebrow>
              <H2 className="mt-2 chrome-text">A family of platforms</H2>
            </div>
            <Link to="/companies" className="hidden md:inline-flex text-sm text-muted hover:text-hi">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map((c) => (
              <Link key={c.id} to={`/companies/${c.slug}`} className="block">
                <Card className="hover:translate-y-[-2px] transition-transform h-full min-h-40">
                  <div className="flex h-full flex-col gap-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <H3>{c.name}</H3>
                        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{COMPANY_SUMMARIES[c.slug] ?? c.tagline ?? c.description}</p>
                      </div>
                      <Chip tone={c.status === 'LIVE' ? 'ok' : c.status === 'IN_DEVELOPMENT' ? 'info' : 'warn'}>{c.status.replace('_', ' ')}</Chip>
                    </div>
                    <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-primary">Explore {c.name} <ArrowRight size={15} /></span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* DISCOVERY */}
      <section className="border-t border-line/30">
        <Container className="py-14 lg:py-16">
          <Eyebrow>Explore By Need</Eyebrow>
          <H2 className="mt-2 chrome-text text-3xl sm:text-4xl">Platforms built for real use.</H2>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {PLATFORM_INTENTS.map(([intent, platform, href]) => (
              <Link key={intent} to={href} className="metal-card rounded-xl p-4 transition-transform hover:translate-y-[-2px]">
                <div className="text-xs uppercase tracking-wider text-muted">{intent}</div>
                <div className="mt-3 flex items-center justify-between gap-2 font-semibold text-hi">{platform}<ArrowRight size={15} className="text-primary" /></div>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* INTERNAL TOOL */}
      <section className="border-t border-line/30">
        <Container className="py-14 lg:py-16">
          <Link to="/ceo" className="group block">
            <div className="rounded-2xl border border-secondary/30 bg-secondary/[0.06] p-6 transition-colors group-hover:bg-secondary/[0.1] sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-secondary/30 bg-secondary/10 text-secondary">
                    <LockKeyhole size={20} />
                  </div>
                  <div>
                    <Eyebrow className="text-secondary">MAI Corp Internal</Eyebrow>
                    <H2 className="mt-2 text-2xl sm:text-3xl">CEO App</H2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">The operating system for running MAI Corp.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:shrink-0">
                  <Chip tone="purp">PRIVATE · CEO ACCESS</Chip>
                  <ArrowRight className="text-secondary transition-transform group-hover:translate-x-1" size={18} />
                </div>
              </div>
            </div>
          </Link>
        </Container>
      </section>

      {/* MISSION */}
      <section className="relative border-t border-line/30">
        <Container className="py-24">
          <div className="grid lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <Eyebrow>{mission.value?.text ?? 'THE MAI CORP MISSION'}</Eyebrow>
              <H2 className="mt-3 chrome-text">Why we build.</H2>
              <div className="mt-6 inline-flex items-center gap-3 metal-card rounded-2xl px-5 py-4">
                <div className="w-12 h-12 rounded-full bg-brand-grad grid place-items-center text-sm font-semibold">JT</div>
                <div>
                  <div className="text-sm font-semibold">{attribution.value?.name ?? 'Joshua Tucker'}</div>
                  <div className="text-xs text-muted">{attribution.value?.title ?? 'CEO, MAI Corp'}</div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-7">
              <GlassCard className="space-y-5 text-lg leading-relaxed text-hi/90">
                {(missionBody.value ?? []).map((p: string, i: number) => (
                  <p key={i}>{p}</p>
                ))}
              </GlassCard>
            </div>
          </div>
        </Container>
      </section>

      {/* PRINCIPLES */}
      <section className="border-t border-line/30">
        <Container className="py-20">
          <Eyebrow>What we build with</Eyebrow>
          <H2 className="mt-2 chrome-text">Principles, not slogans.</H2>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Principle icon={Shield} title="Security first" body="Server-side authorization, encrypted secrets, audit trails, and instant account revocation across the ecosystem." />
            <Principle icon={Cpu} title="Real architecture" body="Every claim is backed by an actual database, RLS policy, RPC, or diagnostic check — not a mockup." />
            <Principle icon={Users} title="People over profit" body="Customers, drivers, broadcasters, employees — the people using the technology are why it exists." />
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="border-t border-line/30">
        <Container className="py-20 text-center">
          <Sparkles className="mx-auto text-secondary" size={28} />
          <H2 className="mt-3 chrome-text">Start a project with the Studio.</H2>
          <p className="mt-3 text-muted max-w-2xl mx-auto">Websites, applications, ecommerce, customer portals, custom platforms. Built by the same team behind the MAI Corp ecosystem.</p>
          <div className="mt-7 flex justify-center gap-3">
            <Link to="/studio" className="btn-primary">Visit the Studio <ArrowRight size={16} /></Link>
            <Link to="/store" className="btn-ghost">Browse the Store</Link>
          </div>
        </Container>
      </section>
    </>
  )
}

function Principle({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <Card>
      <Icon className="text-primary" size={22} />
      <div className="mt-3 text-base font-semibold">{title}</div>
      <p className="mt-2 text-sm text-muted leading-relaxed">{body}</p>
    </Card>
  )
}