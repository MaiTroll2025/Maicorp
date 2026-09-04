// Supabase Edge Function: run-infrastructure-billing-cron
// Daily driver. Runs:
//   1. process_overdue_invoices + mark_overdue_state
//   2. For each newly-OVERDUE invoice: send OVERDUE email + record notif
//   3. execute_suspension for each overdue invoice
//   4. For each newly-suspended: send SUSPENDED email
//   5. run_monthly_renewals
//   6. For each new invoice: send INVOICE_CREATED email
//
// Secured by a shared secret header (X-Cron-Secret) OR service role key.
// Invoke via Supabase scheduled function or external cron:
//   POST /functions/v1/run-infrastructure-billing-cron
//   Header: Authorization: Bearer <service_role_key>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  )
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

  // Authorization: must be service role or carry the cron secret
  const auth = req.headers.get('Authorization') ?? ''
  const providedSecret = req.headers.get('X-Cron-Secret') ?? ''
  const isServiceRole = auth.toLowerCase().startsWith('bearer ') && auth.length > 60
  const isCron = !!CRON_SECRET && providedSecret === CRON_SECRET
  if (!isServiceRole && !isCron) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  async function callEmail(kind: string, invoice_id?: string, coverage_id?: string, order_id?: string) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-infrastructure-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kind, invoice_id, coverage_id, order_id }),
    })
    return res.ok
  }

  try {
    // 1) Mark overdue state
    const { data: overdueCount } = await supabase.rpc('mark_overdue_state')

    // 2) Notify each newly overdue invoice
    const { data: overdueInvoices } = await supabase
      .from('infrastructure_invoices')
      .select('id,order_id,coverage_id,overdue_email_sent_at')
      .eq('status', 'OVERDUE')
    let overdueEmailed = 0
    for (const inv of (overdueInvoices ?? [])) {
      if (!inv.overdue_email_sent_at) {
        if (await callEmail('OVERDUE', inv.id)) overdueEmailed++
      }
    }

    // 3) Execute suspension for each OVERDUE invoice that is not yet SUSPENDED.
    const { data: toSuspend } = await supabase
      .from('infrastructure_invoices')
      .select('id,order_id,coverage_id')
      .eq('status', 'OVERDUE')
    let suspended = 0
    let suspendedEmailed = 0
    for (const inv of (toSuspend ?? [])) {
      const { data: r } = await supabase.rpc('execute_suspension', { p_invoice_id: inv.id })
      if (r) {
        suspended++
        // 4) Send SUSPENDED email
        const sentAlready = await supabase.from('infrastructure_invoices').select('suspended_email_sent_at').eq('id', inv.id).maybeSingle()
        if (!sentAlready.data?.suspended_email_sent_at) {
          if (await callEmail('SUSPENDED', inv.id)) suspendedEmailed++
        }
      }
    }

    // 5) Generate monthly renewals
    const { data: renewalCount } = await supabase.rpc('run_monthly_renewals')

    // 6) Email each new PENDING invoice that has not been emailed
    const { data: newInvoices } = await supabase
      .from('infrastructure_invoices')
      .select('id,order_id,coverage_id')
      .eq('status', 'PENDING')
      .is('email_sent_at', null)
    let newEmailed = 0
    for (const inv of (newInvoices ?? [])) {
      if (await callEmail('INVOICE_CREATED', inv.id)) newEmailed++
    }

    return json({
      ok: true,
      overdue_marked: overdueCount ?? 0,
      overdue_emailed: overdueEmailed,
      suspended,
      suspended_emailed: suspendedEmailed,
      renewals_generated: renewalCount ?? 0,
      new_invoices_emailed: newEmailed,
    }, 200)
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
