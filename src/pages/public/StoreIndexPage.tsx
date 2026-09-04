import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Container, H1, H2, Card, Chip, Eyebrow } from '@/components/ui'
import { supabase } from '@/lib/supabase'

interface Product { id: string; slug: string; name: string; category: string; description: string | null; price_cents: number; currency: string; features: string[]; estimated_delivery: string | null; management_available: boolean; status: string; featured: boolean; sort_order: number; revision_rounds: number }

export function StoreIndexPage() {
  const [products, setProducts] = useState<Product[]>([])
  useEffect(() => {
    supabase.from('products').select('*').eq('status', 'AVAILABLE').order('sort_order')
      .then(({ data }) => setProducts(data ?? []))
  }, [])

  const categories = ['WEBSITES','APPLICATIONS','ECOMMERCE','CUSTOM','MANAGEMENT'] as const

  return (
    <>
      <section><Container className="pt-20 pb-10">
        <Eyebrow>Store</Eyebrow>
        <H1 className="mt-3 chrome-text">Premium technology, priced honestly.</H1>
        <p className="mt-4 max-w-2xl text-muted">Website packages, ecommerce platforms, custom builds, and ongoing management plans. Pricing is set by MAI Corp and is server-authoritative.</p>
      </Container></section>

      <section className="border-t border-line/30">
        <Container className="py-12 grid grid-cols-2 md:grid-cols-5 gap-3">
          {categories.map((c) => (
            <Link key={c} to={`/store/${c.toLowerCase()}`} className="metal-card rounded-xl p-4 text-center hover:translate-y-[-2px] transition-transform">
              <div className="text-[11px] tracking-[0.25em] uppercase text-muted mb-1">Category</div>
              <div className="text-sm font-semibold chrome-text">{c.replace('_',' ')}</div>
            </Link>
          ))}
        </Container>
      </section>

      <section className="border-t border-line/30">
        <Container className="py-12">
          <H2>Featured</H2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.filter(p => p.featured).map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
          <div className="mt-12">
            <H2>All products</H2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}

export function ProductCard({ p }: { p: Product }) {
  return (
    <Link to={`/store/product/${p.slug}`} className="block">
      <Card className="hover:translate-y-[-2px] transition-transform h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted">{p.category.replace('_',' ')}</div>
          {p.featured && <Chip tone="purp">Featured</Chip>}
        </div>
        <div className="mt-2 text-lg font-semibold">{p.name}</div>
        <p className="mt-2 text-sm text-muted line-clamp-3">{p.description}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Chip>{p.estimated_delivery ?? 'Quoted'}</Chip>
          {p.revision_rounds > 0 && <Chip tone="info">{p.revision_rounds} revision rounds</Chip>}
          {p.management_available && <Chip tone="purp">Management available</Chip>}
        </div>
        <div className="mt-5 flex items-center justify-between">
          <div className="text-xl font-semibold chrome-text">{formatPrice(p.price_cents, p.currency)}</div>
        </div>
      </Card>
    </Link>
  )
}

export function formatPrice(cents: number, currency: string) {
  if (!cents) return 'Custom quote'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
}

export { formatPrice as fmtPrice }