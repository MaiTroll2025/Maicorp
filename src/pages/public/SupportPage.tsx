import { useEffect, useState } from 'react'
import { Container, H1, H2, Card, Eyebrow } from '@/components/ui'
import { useCmsContent } from '@/lib/cms'
import { supabase } from '@/lib/supabase'
import { Heart } from 'lucide-react'

export function SupportPage() {
  const head = useCmsContent('support.headline', { text: "HELP US BUILD WHAT'S NEXT" })
  const body = useCmsContent('support.body', { text: 'MAI Corp is building technology designed around people. If you believe in what we are building, you can support the mission.' })
  const [amount, setAmount] = useState(25)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)

  const submit = async () => {
    const { error } = await supabase.from('support_donations').insert({
      name, email, amount_cents: amount * 100, currency: 'USD', message, status: 'PENDING',
    })
    if (!error) setDone(true)
  }

  return (
    <>
      <section><Container className="pt-20 pb-10 text-center">
        <Heart className="mx-auto text-accent" size={28} />
        <Eyebrow>Support</Eyebrow>
        <H1 className="mt-3 chrome-text">{head.value?.text ?? "HELP US BUILD WHAT'S NEXT"}</H1>
        <p className="mt-5 max-w-2xl mx-auto text-muted">{body.value?.text}</p>
      </Container></section>

      <section className="border-t border-line/30">
        <Container className="py-12 grid lg:grid-cols-12 gap-8 max-w-5xl mx-auto">
          <div className="lg:col-span-7">
            <Card>
              <H2>Support MAI Corp</H2>
              {done ? (
                <div className="mt-6 text-hi/85">Thank you — your support has been recorded. The team will reach out if you included contact details.</div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[10,25,50,100].map((a) => (
                      <button key={a} type="button" onClick={() => setAmount(a)} className={`metal-card rounded-lg py-3 text-sm ${amount === a ? 'ring-1 ring-primary text-hi' : 'text-muted'}`}>${a}</button>
                    ))}
                  </div>
                  <div>
                    <label className="label">Amount (USD)</label>
                    <input type="number" className="input" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label className="label">Name (optional)</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
                    <div><label className="label">Email (optional)</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  </div>
                  <div>
                    <label className="label">Message (optional)</label>
                    <textarea className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
                  </div>
                  <button className="btn-primary" onClick={submit}>Continue with PayPal</button>
                  <p className="text-xs text-muted">Final payment is processed securely via PayPal. Donation settings are configurable in the CEO Dashboard.</p>
                </div>
              )}
            </Card>
          </div>
          <div className="lg:col-span-5 space-y-4">
            <Card><H2>Why support</H2><p className="mt-2 text-sm text-muted">Every contribution helps fund development, infrastructure, and customer support for the MAI Corp ecosystem.</p></Card>
            <Card><H2>Where funds go</H2><ul className="mt-3 text-sm text-muted space-y-1"><li>Platform development</li><li>Customer support operations</li><li>Infrastructure and security</li><li>Community programs</li></ul></Card>
          </div>
        </Container>
      </section>
    </>
  )
}