import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { Container, H1, H3, Card, Chip, Eyebrow } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { ExternalLink } from 'lucide-react'
import { cleanText } from '@/lib/cleanText'
import { Seo } from '@/components/Seo'
import { SITE_URL } from '@/config/seo'

interface Company { id: string; slug: string; name: string; tagline: string | null; description: string | null; status: string; website: string | null; play_url: string | null; store_url: string | null; category?: string | null }

const MAITROLL_WEBSITE = 'https://www.maitroll.com'
const MAITROLL_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.maitroll.app&hl=en_US'

const COPY: Record<string, { headline: string; body: string[]; bullets?: string[] }> = {
  maitroll: {
    headline: 'LIVE. INTERACT. TROLL.',
    body: [
      'MaiTroll is a social / live entertainment platform designed around interaction, community, creators, broadcasting, and entertainment.',
      'Built for the next generation of creators, broadcasters, and communities.',
    ],
    bullets: ['Live broadcasting', 'Creator economy', 'Community & interaction', 'Entertainment-first UX'],
  },
  otach: {
    headline: 'Understand your vehicle. Save money. Drive smarter.',
    body: [
      'Otach is positioned as an OBD-II diagnostic and education companion designed to help drivers understand what is happening with their vehicle, learn how repairs work, save money where possible, and avoid being taken advantage of by dishonest or unnecessarily expensive mechanics and dealerships.',
      'The goal is education plus diagnostics plus empowerment.',
    ],
    bullets: ['Step-by-step repair education', 'OBD-II diagnostics', 'Cost transparency', 'Driver empowerment'],
  },
  udryve: {
    headline: 'The next generation driver platform.',
    body: [
      'Udryve allows drivers to complete deliveries while earning through the MAI Corp ecosystem.',
      'A future-facing driver platform with a roadmap exploring partnerships with insurance and roadside-assistance providers — and a possible future MAI Corp-operated roadside assistance service.',
    ],
    bullets: ['Delivery earnings', 'Ecosystem integration', 'Driver-first design', 'Roadmap: insurance partnerships', 'Roadmap: roadside assistance'],
  },
  'mai-dash': {
    headline: 'Connect. Service. Get it done.',
    body: [
      'MAI Dash is a marketplace for everyday service needs.',
      'People need services. Professionals need customers. MAI Dash connects them.',
    ],
    bullets: ['Mechanics', 'Plumbers', 'Construction', 'Electricians', 'Contractors', 'Home services', 'Automotive services', 'Local professionals'],
  },
}

export function CompanyDetailPage() {
  const { slug } = useParams()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!slug) return
    supabase.from('companies').select('*').eq('slug', slug).maybeSingle()
      .then(({ data }) => { setCompany(data); setLoading(false) })
  }, [slug])

  if (loading) return <Container className="py-20 text-muted">Loading…</Container>
  if (!company) return <Navigate to="/companies" replace />
  const copy = COPY[company.slug] ?? { headline: cleanText(company.tagline) ?? company.name, body: [cleanText(company.description) ?? ''] }
  const website = company.slug === 'maitroll' ? (company.website ?? MAITROLL_WEBSITE) : company.website
  const playUrl = company.slug === 'maitroll' ? (company.play_url ?? MAITROLL_PLAY_URL) : company.play_url
  const description = cleanText(company.description) ?? `${company.name} is a public MAI Corp platform.`
  const isApp = ['maitroll', 'otach', 'udryve', 'mai-dash'].includes(company.slug)

  return (
    <>
      <Seo
        title={`${company.name} | ${company.tagline ?? 'MAI Corp Platform'}`}
        description={description}
        path={`/companies/${company.slug}`}
        jsonLd={[
          {
            '@type': isApp ? 'SoftwareApplication' : 'Organization',
            name: company.name,
            description,
            url: `${SITE_URL}/companies/${company.slug}`,
            publisher: { '@type': 'Organization', name: 'MAI Corp' },
            ...(isApp ? { applicationCategory: company.category ?? 'BusinessApplication', operatingSystem: 'Web, Android, iOS' } : {}),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
              { '@type': 'ListItem', position: 2, name: 'Companies', item: `${SITE_URL}/companies` },
              { '@type': 'ListItem', position: 3, name: company.name, item: `${SITE_URL}/companies/${company.slug}` },
            ],
          },
        ]}
      />
      <section>
        <Container className="pt-20 pb-10">
          <Eyebrow>{company.category || 'Company'}</Eyebrow>
          <div className="flex items-start justify-between gap-4 mt-2 flex-wrap">
            <H1 className="chrome-text max-w-3xl">{copy.headline}</H1>
            <Chip tone={company.status === 'LIVE' ? 'ok' : company.status === 'IN_DEVELOPMENT' ? 'info' : 'warn'}>{company.status.replace('_',' ')}</Chip>
          </div>
        </Container>
      </section>

      <section className="border-t border-line/30">
        <Container className="py-14 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-4 text-lg leading-relaxed text-hi/90">
            {copy.body.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <div className="lg:col-span-4 space-y-3">
            <Card>
              <H3>Visit</H3>
              <div className="mt-4 flex flex-col gap-2">
                {website ? (
                  <a href={website} target="_blank" rel="noreferrer" className="btn-primary justify-between">
                    Open {company.name} <ExternalLink size={14} />
                  </a>
                ) : (
                  <button className="btn-primary justify-between" disabled>
                    Open {company.name}
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <a href={playUrl ?? '#'} target="_blank" rel="noreferrer" className="btn-ghost text-xs justify-center">Google Play</a>
                  <a href={company.store_url ?? '#'} target="_blank" rel="noreferrer" className="btn-ghost text-xs justify-center">App Store</a>
                </div>
              </div>
            </Card>
          </div>
        </Container>
      </section>

      {copy.bullets && (
        <section className="border-t border-line/30">
          <Container className="py-14">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {copy.bullets.map((b) => (
                <div key={b} className="metal-card rounded-xl p-4 text-sm text-hi/90">{b}</div>
              ))}
            </div>
          </Container>
        </section>
      )}

      <section className="border-t border-line/30">
        <Container className="py-12 text-center">
          <Link to="/companies" className="text-muted hover:text-hi">← All companies</Link>
        </Container>
      </section>
    </>
  )
}