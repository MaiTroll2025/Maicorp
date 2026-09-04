// Supabase Edge Function: send-infrastructure-email
// Sends transactional emails about infrastructure billing events using
// the Resend HTTP API (https://resend.com). Required secret:
//   RESEND_API_KEY
// Optional:
//   MAIL_FROM (defaults to "MAI Corp <billing@mai-corp.com>")
//   PUBLIC_SITE_URL (used in email links)
//
// Required payload (POST JSON):
//   { kind, invoice_id }
//
// kind may be one of:
//   INVOICE_CREATED, PAYMENT_DUE, OVERDUE, SUSPENDED,
//   PAYMENT_RECEIVED, RESTORED, CANCELLED
//
// The function:
//   1. Loads the invoice + customer + order + coverage from Postgres
//   2. Looks up the user's email
//   3. Renders a themed MAI Corp email body
//   4. Calls the Resend API
//   5. Records the notification in public.infrastructure_notifications
//   6. Updates email_sent_at / *_email_sent_at on the invoice
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FROM_ADDRESS = Deno.env.get('MAIL_FROM') ?? 'MAI Corp <billing@mai-corp.com>'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SITE_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://mai-corp.com'

interface ReqBody { kind: string; invoice_id?: string; coverage_id?: string; order_id?: string }

function fmtUSD(cents: number) {
  return '$' + (cents / 100).toFixed(2)
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function emailShell(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0b1220;color:#e6edf7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#111a2c;border:1px solid #1f2a44;border-radius:14px;overflow:hidden">
        <tr><td style="background:linear-gradient(135deg,#1e40af,#06b6d4);padding:24px 28px;color:#fff">
          <div style="font-size:11px;letter-spacing:.25em;text-transform:uppercase;opacity:.85">MAI Corp</div>
          <div style="font-size:22px;font-weight:600;margin-top:4px">${title}</div>
        </td></tr>
        <tr><td style="padding:24px 28px;font-size:15px;line-height:1.55">${body}</td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #1f2a44;font-size:11px;color:#9aa6c2">
          MAI Corp · Infrastructure Billing · This is a transactional message.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

function renderBody(kind: string, ctx: any): { subject: string; html: string } {
  const invoiceLink = ctx.paypal_approval_url
    ? `<p style="margin:18px 0"><a href="${ctx.paypal_approval_url}" style="display:inline-block;background:#06b6d4;color:#001020;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">Pay invoice with PayPal</a></p>`
    : ''
  const dashboardLink = `<p style="margin:18px 0"><a href="${SITE_URL}/account/infrastructure" style="color:#06b6d4">View your infrastructure dashboard →</a></p>`

  switch (kind) {
    case 'INVOICE_CREATED':
      return {
        subject: `MAI Corp Infrastructure Invoice ${ctx.invoice_number}`,
        html: emailShell(
          `Invoice ${ctx.invoice_number} is ready`,
          `<p>Your MAI Corp infrastructure invoice for <strong>${ctx.project_name}</strong> is ready.</p>
           <table style="width:100%;margin-top:14px;border-collapse:collapse">
             <tr><td style="padding:8px 0;color:#9aa6c2">Infrastructure cost</td><td style="text-align:right;padding:8px 0">${fmtUSD(ctx.infrastructure_cost_cents)}</td></tr>
             <tr><td style="padding:8px 0;color:#9aa6c2">MAI Corp coverage fee</td><td style="text-align:right;padding:8px 0">${fmtUSD(ctx.coverage_fee_cents)}</td></tr>
             <tr><td style="padding:8px 0;border-top:1px solid #1f2a44"><strong>Total</strong></td><td style="text-align:right;padding:8px 0;border-top:1px solid #1f2a44"><strong>${fmtUSD(ctx.total_cents)}</strong></td></tr>
           </table>
           <p style="margin-top:14px;color:#9aa6c2">Due <strong style="color:#e6edf7">${fmtDate(ctx.due_date)}</strong></p>
           ${invoiceLink}
           ${dashboardLink}
           <p style="margin-top:14px;color:#fbbf24">Infrastructure payments are required by the invoice due date. If payment is not received by the due date, MAI Corp may immediately suspend infrastructure services. No grace period is provided.</p>`
        ),
      }
    case 'PAYMENT_DUE':
      return {
        subject: `Infrastructure payment due ${fmtDate(ctx.due_date)} — ${ctx.invoice_number}`,
        html: emailShell(
          'Infrastructure payment due',
          `<p>Your infrastructure invoice <strong>${ctx.invoice_number}</strong> for <strong>${ctx.project_name}</strong> is due on <strong>${fmtDate(ctx.due_date)}</strong>.</p>
           <p>Amount due: <strong>${fmtUSD(ctx.total_cents)}</strong></p>
           ${invoiceLink}
           ${dashboardLink}
           <p style="margin-top:14px;color:#fbbf24">Infrastructure payments are required by the invoice due date. If payment is not received by the due date, MAI Corp may immediately suspend infrastructure services. No grace period is provided.</p>`
        ),
      }
    case 'OVERDUE':
      return {
        subject: `Infrastructure payment required — ${ctx.invoice_number}`,
        html: emailShell(
          '🔴 Infrastructure payment required',
          `<p>Your MAI Corp infrastructure invoice <strong>${ctx.invoice_number}</strong> for <strong>${ctx.project_name}</strong> is overdue.</p>
           <p>Amount due: <strong>${fmtUSD(ctx.total_cents)}</strong></p>
           <p style="color:#f87171;font-weight:600">Infrastructure service is subject to immediate suspension under the infrastructure billing terms. No grace period applies.</p>
           ${invoiceLink}
           ${dashboardLink}`
        ),
      }
    case 'SUSPENDED':
      return {
        subject: `Infrastructure suspended — ${ctx.invoice_number}`,
        html: emailShell(
          '🔴 Infrastructure suspended',
          `<p>Infrastructure services for <strong>${ctx.project_name}</strong> have been suspended because invoice <strong>${ctx.invoice_number}</strong> was not paid by the due date.</p>
           <p>Amount due: <strong>${fmtUSD(ctx.total_cents)}</strong></p>
           <p>Pay the outstanding invoice to restore service.</p>
           ${invoiceLink}
           ${dashboardLink}`
        ),
      }
    case 'PAYMENT_RECEIVED':
      return {
        subject: `Infrastructure payment received — ${ctx.invoice_number}`,
        html: emailShell(
          '✅ Infrastructure payment received',
          `<p>Payment for invoice <strong>${ctx.invoice_number}</strong> has been confirmed. Thank you.</p>
           <p>Amount: <strong>${fmtUSD(ctx.total_cents)}</strong></p>
           ${dashboardLink}`
        ),
      }
    case 'RESTORED':
      return {
        subject: `Infrastructure restored — ${ctx.project_name}`,
        html: emailShell(
          '✅ Infrastructure restored',
          `<p>Infrastructure services for <strong>${ctx.project_name}</strong> have been restored.</p>
           ${dashboardLink}`
        ),
      }
    case 'CANCELLED':
      return {
        subject: `Infrastructure coverage cancelled`,
        html: emailShell(
          'Coverage cancelled',
          `<p>Your MAI Corp infrastructure coverage for <strong>${ctx.project_name}</strong> has been cancelled. Future recurring coverage invoices will not be generated.</p>
           <p>You are now responsible for infrastructure costs directly. Existing unpaid invoices remain due.</p>
           ${dashboardLink}`
        ),
      }
    default:
      return {
        subject: 'MAI Corp Infrastructure Update',
        html: emailShell('Update', '<p>An infrastructure update is available.</p>'),
      }
  }
}

async function sendViaResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
    }),
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
    const { kind } = body
    if (!kind) return json({ ok: false, error: 'missing kind' }, 400)

    // Load invoice + customer + coverage + order + project
    let inv: any = null
    if (body.invoice_id) {
      const { data } = await supabase.from('infrastructure_invoices').select('*').eq('id', body.invoice_id).maybeSingle()
      inv = data
    }
    let cov: any = null
    let order: any = null
    let user: any = null
    let product: any = null

    if (inv) {
      const [{ data: c }, { data: o }, { data: u }, { data: p }] = await Promise.all([
        inv.coverage_id ? supabase.from('infrastructure_coverage').select('*').eq('id', inv.coverage_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('orders').select('id,product_id,customer_id,management_plan').eq('id', inv.order_id).maybeSingle(),
        supabase.from('users').select('id,email,full_name').eq('id', inv.customer_id).maybeSingle(),
        // product name
        (async () => {
          const oid = inv.order_id
          const { data: ord } = await supabase.from('orders').select('product_id').eq('id', oid).maybeSingle()
          if (ord?.product_id) {
            const { data: pr } = await supabase.from('products').select('name').eq('id', ord.product_id).maybeSingle()
            return { data: pr }
          }
          return { data: null }
        })(),
      ])
      cov = c; order = o; user = u; product = p
    } else if (body.coverage_id) {
      const { data: c } = await supabase.from('infrastructure_coverage').select('*').eq('id', body.coverage_id).maybeSingle()
      cov = c
      if (cov) {
        const [{ data: o }, { data: u }] = await Promise.all([
          supabase.from('orders').select('id,product_id,customer_id,management_plan').eq('id', cov.order_id).maybeSingle(),
          supabase.from('users').select('id,email,full_name').eq('id', cov.customer_id).maybeSingle(),
        ])
        order = o; user = u
        if (order?.product_id) {
          const { data: pr } = await supabase.from('products').select('name').eq('id', order.product_id).maybeSingle()
          product = pr
        }
      }
    } else if (body.order_id) {
      const { data: o } = await supabase.from('orders').select('id,product_id,customer_id,management_plan').eq('id', body.order_id).maybeSingle()
      order = o
      if (order) {
        const { data: u } = await supabase.from('users').select('id,email,full_name').eq('id', order.customer_id).maybeSingle()
        user = u
        if (order.product_id) {
          const { data: pr } = await supabase.from('products').select('name').eq('id', order.product_id).maybeSingle()
          product = pr
        }
      }
    }

    if (!user?.email) return json({ ok: false, error: 'customer email not found' }, 404)

    const ctx = {
      invoice_number: inv?.invoice_number ?? '',
      due_date: inv?.due_date,
      infrastructure_cost_cents: inv?.infrastructure_cost_cents ?? 0,
      coverage_fee_cents: inv?.coverage_fee_cents ?? 0,
      total_cents: inv?.total_cents ?? 0,
      paypal_approval_url: inv?.paypal_approval_url,
      project_name: product?.name ?? 'your project',
    }
    const { subject, html } = renderBody(kind, ctx)

    const result = await sendViaResend(user.email, subject, html)

    // Log + stamp
    if (result.ok) {
      await supabase.from('infrastructure_notifications').insert({
        customer_id: user.id,
        invoice_id: inv?.id ?? null,
        coverage_id: cov?.id ?? null,
        order_id: order?.id ?? null,
        kind,
        title: subject,
        body: html.replace(/<[^>]+>/g, '').slice(0, 500),
      })
      if (inv) {
        const stampCol = (
          kind === 'INVOICE_CREATED' ? 'email_sent_at' :
          kind === 'PAYMENT_DUE' ? 'email_sent_at' :
          kind === 'OVERDUE' ? 'overdue_email_sent_at' :
          kind === 'SUSPENDED' ? 'suspended_email_sent_at' :
          kind === 'RESTORED' ? 'restored_email_sent_at' :
          'email_sent_at'
        )
        await supabase.from('infrastructure_invoices').update({
          [stampCol]: new Date().toISOString(),
          email_message_id: (result as any).id ?? null,
        }).eq('id', inv.id)
      }
      return json({ ok: true, message_id: (result as any).id }, 200)
    } else {
      if (inv) {
        await supabase.from('infrastructure_invoices').update({
          email_error: result.error,
        }).eq('id', inv.id)
      }
      return json({ ok: false, error: result.error }, 502)
    }
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
