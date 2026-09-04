import { Container, H1, H2, H3, Card, Eyebrow } from '@/components/ui'
import { useCmsContent } from '@/lib/cms'

export function AboutPage() {
  const missionBody = useCmsContent('mission.body', [])
  const attribution = useCmsContent('mission.attribution', { name: 'Joshua Tucker', title: 'CEO, MAI Corp' })
  return (
    <>
      <section>
        <Container className="pt-20 pb-12">
          <Eyebrow>About</Eyebrow>
          <H1 className="mt-3 chrome-text">A premium technology corporation.</H1>
          <p className="mt-5 max-w-3xl text-lg text-muted leading-relaxed">
            MAI Corp is the parent organization operating a portfolio of products and platforms — including MaiTroll,
            Otach, Udryve, and MAI Dash. Each platform is built with the same conviction: technology should empower people,
            not extract from them.
          </p>
          <p className="mt-4 max-w-3xl text-sm text-hi/80">Built with AI by humans who work 12 hours a day. AI is a development and creative tool; people make the decisions, build the products, test the systems, and operate the company.</p>
        </Container>
      </section>

      <section className="border-t border-line/30">
        <Container className="py-20 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <Eyebrow>CEO</Eyebrow>
            <H2 className="mt-2 chrome-text">{attribution.value?.name}</H2>
            <div className="text-sm text-muted">{attribution.value?.title}</div>
          </div>
          <div className="lg:col-span-7 space-y-4 text-lg leading-relaxed text-hi/90">
            {(missionBody.value ?? []).map((p: string, i: number) => <p key={i}>{p}</p>)}
          </div>
        </Container>
      </section>

      <section className="border-t border-line/30">
        <Container className="py-20">
          <Eyebrow>How we operate</Eyebrow>
          <H2 className="mt-2 chrome-text">Quiet ambition. Real engineering.</H2>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><H3>Disciplined</H3><p className="mt-2 text-sm text-muted">Restraint over noise. We build what we can ship and operate.</p></Card>
            <Card><H3>Auditable</H3><p className="mt-2 text-sm text-muted">Every consequential action leaves a record. Decisions are reviewable.</p></Card>
            <Card><H3>Human-centered</H3><p className="mt-2 text-sm text-muted">Platforms are designed around the people who use them.</p></Card>
          </div>
        </Container>
      </section>
    </>
  )
}