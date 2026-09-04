import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Container, H1, H2, Card, Eyebrow } from '@/components/ui'
import { ProductCard } from './StoreIndexPage'
import { supabase } from '@/lib/supabase'

interface Product { id: string; slug: string; name: string; category: string; description: string | null; price_cents: number; currency: string; features: string[]; estimated_delivery: string | null; management_available: boolean; status: string; featured: boolean; sort_order: number; revision_rounds: number }

const SLUG_TO_CATEGORY: Record<string, string> = {
  websites: 'WEBSITES',
  applications: 'APPLICATIONS',
  ecommerce: 'ECOMMERCE',
  custom: 'CUSTOM',
  management: 'MANAGEMENT',
}

export function StoreCategoryPage() {
  const { category } = useParams()
  const cat = category ? SLUG_TO_CATEGORY[category] : null
  const [products, setProducts] = useState<Product[]>([])
  useEffect(() => {
    if (!cat) return
    supabase.from('products').select('*').eq('category', cat).eq('status','AVAILABLE').order('sort_order')
      .then(({ data }) => setProducts(data ?? []))
  }, [cat])
  if (!cat) return <Container className="py-20">Unknown category.</Container>
  return (
    <>
      <section><Container className="pt-16 pb-10">
        <Eyebrow>Store · {cat.replace('_',' ')}</Eyebrow>
        <H1 className="mt-3 chrome-text">{cat.replace('_',' ')}</H1>
      </Container></section>
      <section className="border-t border-line/30">
        <Container className="py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.length === 0 ? (
            <Card><p className="text-muted">No products in this category yet.</p><Link to="/store" className="text-primary mt-3 inline-block">← Back to store</Link></Card>
          ) : products.map((p) => <ProductCard key={p.id} p={p} />)}
        </Container>
      </section>
    </>
  )
}