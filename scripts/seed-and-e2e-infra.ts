// E2E test for Infrastructure Coverage, Monthly Renewal, Immediate
// Suspension system. Verifies:
//   * CUSTOMER_DIRECT: no coverage fee, no invoice generated
//   * MAI_CORP_COVERED: $50 coverage fee, infrastructure cost added,
//     initial invoice generated with official MAI-INV number
//   * Payment marks invoice PAID, coverage stays ACTIVE, next invoice
//     is scheduled by the monthly renewal RPC
//   * Nonpayment: invoice OVERDUE -> coverage PAYMENT_OVERDUE -> infrastructure
//     SUSPENSION_REQUIRED -> SUSPENDED (no grace period)
//   * Restoration: overdue invoice paid -> RESTORATION_REQUIRED -> ACTIVE
//   * Security: Customer A cannot see Customer B's infrastructure / invoices
//   * Customer cannot alter invoice totals or mark invoices paid
//
// Run: npx tsx scripts/seed-and-e2e-infra.ts
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

function loadEnv() {
  const envPath = path.resolve('D:\\MAiCORP\\maicorp\\.env')
  const content = fs.readFileSync(envPath, 'utf8')
  const env: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq > 0) env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

const env = loadEnv()
const supabase = createClient(env.VITE_SUPABASE_URL!, env.VITE_SUPABASE_ANON_KEY!)

interface TestResult { name: string; pass: boolean; detail?: string }
const results: TestResult[] = []
function pass(name: string, detail?: string) { results.push({ name, pass: true, detail }); console.log(`  PASS: ${name}${detail ? ' - ' + detail : ''}`) }
function fail(name: string, detail?: string) { results.push({ name, pass: false, detail }); console.log(`  FAIL: ${name}${detail ? ' - ' + detail : ''}`) }

async function main() {
  const runId = Date.now().toString(36)
  const ceoEmail = `test-ceo-infra-${runId}@maicorp.test`
  const ceoPw = 'TestCEOInfra123!'
  const customerAEmail = `test-customer-a-infra-${runId}@maicorp.test`
  const customerAPw = 'TestCustomerAInfra123!'
  const customerBEmail = `test-customer-b-infra-${runId}@maicorp.test`
  const customerBPw = 'TestCustomerBInfra123!'

  console.log('=== MAI Corp Infrastructure Coverage E2E ===\n')

  // STEP 1: bootstrap CEO
  const { data: ceoSignup, error: ceoErr } = await supabase.auth.signUp({
    email: ceoEmail, password: ceoPw,
    options: { data: { full_name: 'Test CEO Infra' } },
  })
  if (ceoErr || !ceoSignup.user) { fail('CEO signup', ceoErr?.message); return }
  const ceoId = ceoSignup.user.id
  await supabase.from('users').upsert({ id: ceoId, email: ceoEmail, full_name: 'Test CEO Infra', role: 'CEO', account_status: 'ACTIVE' })
  pass('CEO bootstrapped')

  // STEP 2: bootstrap Customer A and Customer B
  const { data: aSignup } = await supabase.auth.signUp({ email: customerAEmail, password: customerAPw, options: { data: { full_name: 'Customer A Infra' } } })
  if (!aSignup.user) { fail('Customer A signup'); return }
  const aId = aSignup.user.id
  await supabase.from('users').upsert({ id: aId, email: customerAEmail, full_name: 'Customer A Infra', role: 'CUSTOMER', account_status: 'ACTIVE' })

  const { data: bSignup } = await supabase.auth.signUp({ email: customerBEmail, password: customerBPw, options: { data: { full_name: 'Customer B Infra' } } })
  if (!bSignup.user) { fail('Customer B signup'); return }
  const bId = bSignup.user.id
  await supabase.from('users').upsert({ id: bId, email: customerBEmail, full_name: 'Customer B Infra', role: 'CUSTOMER', account_status: 'ACTIVE' })
  pass('Customers A and B bootstrapped')

  // STEP 3: find a product to attach orders to
  const { data: products } = await supabase.from('products').select('id,price_cents,currency').limit(1)
  if (!products || products.length === 0) { fail('Find product'); return }
  const product = products[0]
  pass('Product found', product.id)

  // STEP 4: Customer A creates order with CUSTOMER_DIRECT
  const { data: orderA } = await supabase.from('orders').insert({
    customer_id: aId, product_id: product.id,
    amount_cents: product.price_cents, currency: product.currency,
    status: 'PAID',
    management_plan: 'BUSINESS',
    infrastructure_payment_responsibility: 'CUSTOMER_DIRECT',
    infrastructure_initial_cost_cents: 2500,
  }).select('id').single()
  if (!orderA) { fail('Create order A'); return }
  pass('Order A (CUSTOMER_DIRECT) created')

  // STEP 5: Initialize coverage on order A
  const { data: initA, error: initAErr } = await supabase.rpc('initialize_infrastructure_coverage', {
    p_order_id: orderA.id, p_infrastructure_cost_cents: 2500,
  })
  if (initAErr) { fail('Initialize coverage for CUSTOMER_DIRECT', initAErr.message); }
  else if (initA?.mode !== 'CUSTOMER_DIRECT') { fail('CUSTOMER_DIRECT mode', JSON.stringify(initA)); }
  else pass('CUSTOMER_DIRECT initializes without coverage/invoice')

  // Verify no invoice was generated for Customer A
  const { data: invA } = await supabase.from('infrastructure_invoices').select('id').eq('order_id', orderA.id)
  if (invA && invA.length > 0) fail('CUSTOMER_DIRECT created invoice', `count=${invA.length}`)
  else pass('No $50 coverage invoice for CUSTOMER_DIRECT')

  // STEP 6: Customer B creates order with MAI_CORP_COVERED
  const { data: orderB } = await supabase.from('orders').insert({
    customer_id: bId, product_id: product.id,
    amount_cents: product.price_cents, currency: product.currency,
    status: 'PAID',
    management_plan: 'PREMIUM',
    infrastructure_payment_responsibility: 'MAI_CORP_COVERED',
    infrastructure_initial_cost_cents: 2500,
  }).select('id').single()
  if (!orderB) { fail('Create order B'); return }
  pass('Order B (MAI_CORP_COVERED) created')

  const { data: initB, error: initBErr } = await supabase.rpc('initialize_infrastructure_coverage', {
    p_order_id: orderB.id, p_infrastructure_cost_cents: 2500,
  })
  if (initBErr) { fail('Initialize MAI_CORP_COVERED', initBErr.message); return }

  const invoiceId = initB.invoice_id as string
  pass('MAI_CORP_COVERED initializes coverage + invoice', initB.invoice_number)

  // STEP 7: Verify the invoice shape (number, totals, fee, infrastructure)
  const { data: invRow } = await supabase.from('infrastructure_invoices').select('*').eq('id', invoiceId).maybeSingle()
  if (!invRow) { fail('Fetch initial invoice'); }
  else {
    const ok =
      typeof invRow.invoice_number === 'string' && /^MAI-INV-\d{4}-\d{6}$/.test(invRow.invoice_number) &&
      invRow.coverage_fee_cents === 5000 &&
      invRow.infrastructure_cost_cents === 2500 &&
      invRow.total_cents === 7500 &&
      invRow.coverage_type === 'MAI_CORP_COVERED' &&
      invRow.management_plan === 'PREMIUM' &&
      invRow.currency === 'USD'
    if (!ok) fail('Invoice shape invalid', JSON.stringify(invRow))
    else pass('Invoice has official MAI-INV number, correct $50 fee + $25 infra + total $75')
  }

  // STEP 8: Customer B cannot mutate the invoice (RLS)
  await supabase.auth.signInWithPassword({ email: customerBEmail, password: customerBPw })
  const { data: tamper } = await supabase.from('infrastructure_invoices').update({ total_cents: 1 }).eq('id', invoiceId).select('id').maybeSingle()
  if (tamper) fail('Customer altered invoice total', 'RLS did not block UPDATE')
  else pass('Customer cannot alter invoice totals (RLS)')

  const { data: markPaidCustomerB } = await supabase.from('infrastructure_invoices').update({ status: 'PAID' }).eq('id', invoiceId).select('id').maybeSingle()
  if (markPaidCustomerB) fail('Customer marked invoice paid (RLS)', 'RLS did not block status update')
  else pass('Customer cannot mark invoice paid (RLS)')

  // STEP 9: Customer A cannot see Customer B infrastructure
  await supabase.auth.signInWithPassword({ email: customerAEmail, password: customerAPw })
  const { data: crossInfra } = await supabase.from('infrastructure_accounts').select('*').eq('customer_id', bId)
  if (crossInfra && crossInfra.length > 0) fail('Customer A sees Customer B infrastructure', `count=${crossInfra.length}`)
  else pass('Customer A cannot see Customer B infrastructure (RLS)')

  const { data: crossInv } = await supabase.from('infrastructure_invoices').select('*').eq('customer_id', bId)
  if (crossInv && crossInv.length > 0) fail('Customer A sees Customer B invoices', `count=${crossInv.length}`)
  else pass('Customer A cannot see Customer B invoices (RLS)')

  const { data: crossCov } = await supabase.from('infrastructure_coverage').select('*').eq('customer_id', bId)
  if (crossCov && crossCov.length > 0) fail('Customer A sees Customer B coverage', `count=${crossCov.length}`)
  else pass('Customer A cannot see Customer B coverage (RLS)')

  // STEP 10: Customer A cannot reassign coverage ownership
  const { data: ownCov } = await supabase.from('infrastructure_coverage').select('*').eq('order_id', orderB.id).maybeSingle()
  if (ownCov) {
    const { data: steal } = await supabase.from('infrastructure_coverage').update({ customer_id: aId }).eq('id', ownCov.id).select('id').maybeSingle()
    if (steal) fail('Customer reassigned coverage ownership', 'RLS did not block UPDATE')
    else pass('Customer cannot reassign coverage ownership')
  }

  // STEP 11: CEO pays the invoice (manual), then monthly renewal generates next invoice
  await supabase.auth.signInWithPassword({ email: ceoEmail, password: ceoPw })
  const { data: paid, error: paidErr } = await supabase.rpc('mark_invoice_paid', {
    p_invoice_id: invoiceId,
    p_paypal_capture_id: 'TEST-CAPTURE-1',
    p_payment_method: 'TEST',
  })
  if (paidErr) fail('CEO marks invoice paid', paidErr.message)
  else pass('CEO marked invoice paid via RPC', JSON.stringify(paid).slice(0, 120))

  const { data: invAfter } = await supabase.from('infrastructure_invoices').select('status').eq('id', invoiceId).maybeSingle()
  if (invAfter?.status === 'PAID') pass('Invoice status is PAID')
  else fail('Invoice not PAID after mark_invoice_paid', JSON.stringify(invAfter))

  const { data: covAfter } = await supabase.from('infrastructure_coverage').select('status,next_invoice_date').eq('order_id', orderB).maybeSingle()
  if (covAfter?.status === 'ACTIVE') pass('Coverage remains ACTIVE after payment')
  else fail('Coverage status wrong after payment', JSON.stringify(covAfter))

  // STEP 12: run_monthly_renewals should generate the NEXT invoice
  const { data: renewalCount, error: renErr } = await supabase.rpc('run_monthly_renewals')
  if (renErr) fail('run_monthly_renewals', renErr.message)
  else pass('run_monthly_renewals executed', `count=${renewalCount}`)

  const { data: allBInv } = await supabase.from('infrastructure_invoices').select('id,invoice_number,status').eq('order_id', orderB).order('created_at')
  if (allBInv && allBInv.length >= 2) pass('Next monthly invoice generated', `total=${allBInv.length}`)
  else fail('Next invoice not generated', `count=${allBInv?.length}`)

  // STEP 13: simulate nonpayment - create an invoice with due_date in the past
  const { data: oldCov } = await supabase.from('infrastructure_coverage').select('*').eq('order_id', orderB).maybeSingle()
  const { data: oldInv } = await supabase.from('infrastructure_invoices').insert({
    invoice_number: 'TEST-OVERDUE-000001',
    order_id: orderB, customer_id: bId,
    infrastructure_id: initB?.infrastructure_account_id ?? null,
    coverage_id: oldCov?.id ?? null,
    coverage_type: 'MAI_CORP_COVERED', management_plan: 'PREMIUM',
    billing_period_start: new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10),
    billing_period_end: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    issue_date: new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10),
    due_date: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10),
    infrastructure_cost_cents: 2500, coverage_fee_cents: 5000,
    total_cents: 7500, currency: 'USD', status: 'PENDING',
  }).select('id').single()
  if (!oldInv) { fail('Insert overdue invoice'); }
  else pass('Inserted overdue invoice (yesterday)')

  // mark_overdue_state should mark invoice OVERDUE, coverage PAYMENT_OVERDUE, infrastructure SUSPENSION_REQUIRED
  await supabase.rpc('mark_overdue_state')
  const { data: oldInvAfter } = await supabase.from('infrastructure_invoices').select('status').eq('id', oldInv.id).maybeSingle()
  if (oldInvAfter?.status === 'OVERDUE') pass('No grace period: overdue invoice marked OVERDUE immediately')
  else fail('Overdue invoice not marked', JSON.stringify(oldInvAfter))

  const { data: covOver } = await supabase.from('infrastructure_coverage').select('status').eq('order_id', orderB).maybeSingle()
  if (covOver?.status === 'PAYMENT_OVERDUE') pass('Coverage is PAYMENT_OVERDUE')
  else fail('Coverage not PAYMENT_OVERDUE', JSON.stringify(covOver))

  const { data: accOver } = await supabase.from('infrastructure_accounts').select('status').eq('order_id', orderB).maybeSingle()
  if (accOver?.status === 'SUSPENSION_REQUIRED') pass('Infrastructure is SUSPENSION_REQUIRED')
  else fail('Infrastructure not SUSPENSION_REQUIRED', JSON.stringify(accOver))

  // STEP 14: execute_suspension
  const { data: susp, error: suspErr } = await supabase.rpc('execute_suspension', { p_invoice_id: oldInv.id })
  if (suspErr) fail('execute_suspension', suspErr.message)
  else pass('execute_suspension', JSON.stringify(susp).slice(0, 120))

  const { data: invSusp } = await supabase.from('infrastructure_invoices').select('status').eq('id', oldInv.id).maybeSingle()
  if (invSusp?.status === 'SUSPENDED') pass('Invoice status = SUSPENDED')
  else fail('Invoice not SUSPENDED', JSON.stringify(invSusp))

  // STEP 15: restoration - mark the overdue invoice paid
  await supabase.rpc('mark_invoice_paid', { p_invoice_id: oldInv.id, p_paypal_capture_id: 'TEST-LATE', p_payment_method: 'TEST' })
  const { data: covRest } = await supabase.from('infrastructure_coverage').select('status').eq('order_id', orderB).maybeSingle()
  if (covRest?.status === 'ACTIVE' || covRest?.status === 'RESTORATION_REQUIRED') pass('Coverage returned to ACTIVE/RESTORATION_REQUIRED after late payment', covRest?.status)
  else fail('Coverage did not return to ACTIVE after late payment', JSON.stringify(covRest))

  await supabase.rpc('confirm_restoration', { p_invoice_id: oldInv.id })
  const { data: covFinal } = await supabase.from('infrastructure_coverage').select('status').eq('order_id', orderB).maybeSingle()
  if (covFinal?.status === 'ACTIVE') pass('CEO confirmed restoration: coverage is ACTIVE')
  else fail('Restoration did not bring coverage to ACTIVE', JSON.stringify(covFinal))

  // STEP 16: customer cancellation
  await supabase.auth.signInWithPassword({ email: customerBEmail, password: customerBPw })
  const { error: cancelErr } = await supabase.rpc('cancel_coverage', { p_coverage_id: oldCov?.id, p_reason: 'Customer test cancellation' })
  if (cancelErr) fail('cancel_coverage', cancelErr.message)
  else pass('Customer cancelled coverage')

  const { data: ordAfterCancel } = await supabase.from('orders').select('infrastructure_payment_responsibility').eq('id', orderB).maybeSingle()
  if (ordAfterCancel?.infrastructure_payment_responsibility === 'CUSTOMER_DIRECT') pass('Order reverts to CUSTOMER_DIRECT on cancellation')
  else fail('Order not reverted to CUSTOMER_DIRECT', JSON.stringify(ordAfterCancel))

  // Invoice history preserved?
  const { data: history } = await supabase.from('infrastructure_invoices').select('id').eq('order_id', orderB)
  if (history && history.length >= 2) pass('Invoice history preserved after cancellation', `count=${history.length}`)
  else fail('Invoice history not preserved', `count=${history?.length}`)

  // STEP 17: Cleanup
  await supabase.auth.signInWithPassword({ email: ceoEmail, password: ceoPw })
  const orderIds = [orderA.id, orderB.id].filter(Boolean) as string[]
  await supabase.from('infrastructure_notifications').delete().in('order_id', orderIds)
  await supabase.from('infrastructure_invoices').delete().in('order_id', orderIds)
  await supabase.from('infrastructure_coverage').delete().in('order_id', orderIds)
  await supabase.from('infrastructure_accounts').delete().in('order_id', orderIds)
  await supabase.from('orders').delete().in('id', orderIds)
  await supabase.from('users').delete().in('id', [ceoId, aId, bId])

  console.log('\n=== SUMMARY ===')
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`)
  if (failed > 0) {
    console.log('\nFailed:')
    results.filter(r => !r.pass).forEach(r => console.log(`  - ${r.name}: ${r.detail}`))
  }
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
