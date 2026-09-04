import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Container, H1, H2, Eyebrow, Card, Chip } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { cleanText } from '@/lib/cleanText'

interface Company { id: string; slug: string; name: string; tagline: string | null; description: string | null; status: string; featured: boolean; category: string | null }

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('companies').select('id,slug,name,tagline,description,status,featured,category').order('sort_order')
      .then(({ data, error }) => { if (!error) setCompanies(data ?? []); setLoading(false) })
  }, [])

  return (
    <>
      <section><Container className="pt-20 pb-12">
        <Eyebrow>Companies</Eyebrow>
        <H1 className="mt-3 chrome-text">The MAI Corp ecosystem.</H1>
        <p className="mt-4 max-w-2xl text-muted">A growing family of products designed around the people who use them.</p>
      </Container></section>

      <section className="border-t border-line/30">
        <Container className="py-16">
          {loading ? <div className="text-muted">Loading…</div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companies.map((c) => (
                <Link key={c.id} to={`/companies/${c.slug}`} className="block">
                  <Card className="hover:translate-y-[-2px] transition-transform h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <H2 className="text-2xl">{c.name}</H2>
                        <div className="text-sm text-muted mt-1">{cleanText(c.tagline)}</div>
                        <p className="mt-3 text-sm text-hi/70 leading-relaxed line-clamp-3">{cleanText(c.description)}</p>
                      </div>
                      <Chip tone={c.status === 'LIVE' ? 'ok' : c.status === 'IN_DEVELOPMENT' ? 'info' : 'warn'}>{c.status.replace('_',' ')}</Chip>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </Container>
      </section>
    </>
  )
}