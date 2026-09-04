// Supabase Edge Function: send-intake-email
// Sends a branded intake-form reminder to the customer after they pay.
// Also sends a confirmation copy to the customer once they submit the form.
// Required secret: RESEND_API_KEY
// Optional:        MAIL_FROM (defaults to "MAI Corp <billing@mai-corp.com>")
//                  PUBLIC_SITE_URL (used for the intake link)
//
// POST body:
//   { kind: 'REMINDER' | 'CONFIRMATION', order_id: string }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FROM_ADDRESS = Deno.env.get('MAIL_FROM') ?? 'MAI Corp <billing@mai-corp.com>'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SITE_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://maicorp.online'

interface ReqBody { kind: 'REMINDER' | 'CONFIRMATION'; order_id: string }

function shell(title: string, body: string, ctaText: string, ctaUrl: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0b1220;color:#e6edf7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#111a2c;border:1px solid #1f2a44;border-radius:14px;overflow:hidden">
        <tr><td style="background:linear-gradient(135deg,#1e40af,#06b6d4);padding:24px 28px;color:#fff">
          <div style="font-size:11px;letter-spacing:.25em;text-transform:uppercase;opacity:.85">MAI Corp</div>
          <div style="font-size:22px;font-weight:600;margin-top:4px">${title}</div>
        </td></tr>
        <tr><td style="padding:24px 28px;font-size:15px;line-height:1.55">${body}</td></tr>
        <tr><td style="padding:0 28px 24px 28px"><a href="${ctaUrl}" style="display:inline-block;background:#06b6d4;color:#001020;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">${ctaText}</a></td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #1f2a44;font-size:11px;color:#9aa6c2">
          MAI Corp · Project Onboarding · This is a transactional message.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

async function sendViaResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY not configured' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  })
  const text = await res.text()
  if (!res.ok) return { ok: false, error: text }
  try { return { ok: true, ...JSON.parse(text) } } catch { return { ok: true, raw: text } }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const body = (await req.json()) as ReqBody
    if (!body.order_id || !body.kind) return json({ ok: false, error: 'missing order_id or kind' }, 400)

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, customer_id, management_plan, infrastructure_payment_responsibility, status, intake_submitted_at')
      .eq('id', body.order_id)
      .maybeSingle()
    if (orderErr || !order) return json({ ok: false, error: 'order not found' }, 404)

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', order.customer_id)
      .maybeSingle()
    if (userErr || !user?.email) return json({ ok: false, error: 'customer email not found' }, 404)

    const { data: product } = await supabase
      .from('orders')
      .select('products(name)')
      .eq('id', body.order_id)
      .maybeSingle()

    const intakeUrl = `${SITE_URL}/account/orders/${body.order_id}`
    const projectName = (product as any)?.products?.name ?? 'your project'

    let subject = ''
    let html = ''
    if (body.kind === 'REMINDER') {
      subject = `Action needed: complete your ${projectName} intake form`
      html = shell(
        'Complete your project intake',
        `<p>Thanks for your order, ${user.full_name ?? 'there'}!</p>
         <p>To start your <strong>${projectName}</strong> project, please complete the project intake form. The CEO reviews every intake before kickoff so we can match your requirements to the right team.</p>
         <ul style="margin:14px 0;padding-left:18px">
           <li>Business name, contact info, and business type</li>
           <li>Domain (existing or desired)</li>
           <li>Website purpose and required pages / features</li>
           <li>Any special requirements or integrations</li>
         </ul>
         <p style="color:#fbbf24">Please complete this within <strong>48 hours</strong> so the CEO can begin planning.</p>`,
        'Open intake form',
        intakeUrl,
      )
    } else {
      subject = `Intake received — ${projectName}`
      html = shell(
        'Intake received',
        `<p>Thanks, ${user.full_name ?? 'there'}. Your project intake for <strong>${projectName}</strong> has been received.</p>
         <p>The CEO will review your details and reach out via the project chat. You can track progress any time from your order dashboard.</p>`,
        'View your order',
        intakeUrl,
      )
    }

    const result = await sendViaResend(user.email, subject, html)
    await supabase.from('intake_notifications').insert({
      order_id: body.order_id,
      customer_id: user.id,
      kind: body.kind,
      to_email: user.email,
      subject,
      resend_message_id: result.ok ? (result as any).id ?? null : null,
      error: result.ok ? null : result.error,
    })
    if (body.kind === 'REMINDER' && result.ok) {
      await supabase.from('orders').update({ intake_reminder_sent_at: new Date().toISOString() }).eq('id', body.order_id)
    }

    return json({ ok: result.ok, message_id: (result as any).id, error: result.ok ? undefined : result.error }, result.ok ? 200 : 502)
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message ?? e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
