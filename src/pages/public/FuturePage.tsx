import { useEffect, useState } from 'react'
import { Container, H1, H3, Card, Chip, Eyebrow } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { cleanText } from '@/lib/cleanText'

interface Company { id: string; slug: string; name: string; tagline: string | null; description: string | null; status: string; featured: boolean }

export function FuturePage() {
  const [companies, setCompanies] = useState<Company[]>([])
  useEffect(() => {
    supabase.from('companies').select('id,slug,name,tagline,description,status,featured').neq('status', 'LIVE').order('sort_order')
      .then(({ data }) => setCompanies(data ?? []))
  }, [])
  return (
    <>
      <section><Container className="pt-20 pb-12">
        <Eyebrow>Future</Eyebrow>
        <H1 className="mt-3 chrome-text">What's next from MAI Corp.</H1>
        <p className="mt-4 max-w-2xl text-muted">The pipeline of companies, products, and platforms we're building toward. Public statuses update as the portfolio evolves.</p>
      </Container></section>

      <section className="border-t border-line/30">
        <Container className="py-16">
          {companies.length === 0 ? (
            <Card><p className="text-muted">No upcoming initiatives publicly listed right now. Check back soon.</p></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companies.map((c) => (
                <Card key={c.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <H3>{c.name}</H3>
                      <div className="text-sm text-muted mt-1">{cleanText(c.tagline)}</div>
                      <p className="mt-3 text-sm text-hi/80 leading-relaxed">{cleanText(c.description)}</p>
                    </div>
                    <Chip tone={c.status === 'IN_DEVELOPMENT' ? 'info' : c.status === 'COMING_SOON' ? 'purp' : 'warn'}>{c.status.replace('_',' ')}</Chip>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Container>
      </section>
    </>
  )
}