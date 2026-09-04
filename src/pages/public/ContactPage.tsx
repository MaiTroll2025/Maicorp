import { useState } from 'react'
import { Container, H1, H2, Card, Eyebrow } from '@/components/ui'
import { supabase } from '@/lib/supabase'

const CATEGORIES = [
  ['General Inquiries', 'GENERAL'],
  ['Business & Partnerships', 'BUSINESS'],
  ['Media', 'MEDIA'],
  ['Careers / Contractors', 'CAREERS'],
] as const

export function ContactPage() {
  const [cat, setCat] = useState<typeof CATEGORIES[number][1]>('GENERAL')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('contact_submissions').insert({
      name, email, subject, body, category: cat,
    })
    if (!error) setSent(true)
  }

  return (
    <>
      <section><Container className="pt-20 pb-10">
        <Eyebrow>Contact</Eyebrow>
        <H1 className="mt-3 chrome-text">Reach MAI Corp.</H1>
        <p className="mt-4 max-w-2xl text-muted">General inquiries, partnerships, media, and careers. All submissions are stored server-side and reviewed by the team.</p>
      </Container></section>

      <section className="border-t border-line/30">
        <Container className="py-12 grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7">
            <Card>
              {sent ? (
                <div className="text-hi/85">Thank you — your message has been sent. The team will be in touch.</div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label className="label">Category</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {CATEGORIES.map(([label, value]) => (
                        <button key={value} type="button" onClick={() => setCat(value)} className={`metal-card rounded-lg py-2.5 text-xs ${cat === value ? 'ring-1 ring-primary text-hi' : 'text-muted'}`}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
                    <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                  </div>
                  <div><label className="label">Subject</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required /></div>
                  <div><label className="label">Message</label><textarea className="input" rows={6} value={body} onChange={(e) => setBody(e.target.value)} required /></div>
                  <button className="btn-primary" type="submit">Send message</button>
                </form>
              )}
            </Card>
          </div>
          <div className="lg:col-span-5 space-y-4">
            <Card><H2>General</H2><p className="mt-2 text-sm text-muted">For product, billing, and account questions.</p></Card>
            <Card><H2>Business</H2><p className="mt-2 text-sm text-muted">For partnerships, integrations, and enterprise inquiries.</p></Card>
            <Card><H2>Media</H2><p className="mt-2 text-sm text-muted">For press, interviews, and announcements.</p></Card>
            <Card><H2>Careers</H2><p className="mt-2 text-sm text-muted">For contractor and career opportunities across the MAI Corp ecosystem.</p></Card>
          </div>
        </Container>
      </section>
    </>
  )
}