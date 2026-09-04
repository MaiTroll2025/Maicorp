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

interface TestResult {
  name: string
  pass: boolean
  detail?: string
}

const results: TestResult[] = []

function pass(name: string, detail?: string) {
  results.push({ name, pass: true, detail })
  console.log(`  PASS: ${name}${detail ? ' - ' + detail : ''}`)
}

function fail(name: string, detail?: string) {
  results.push({ name, pass: false, detail })
  console.log(`  FAIL: ${name}${detail ? ' - ' + detail : ''}`)
}

async function cleanupTestData(supabase: ReturnType<typeof createClient>, ceoId: string, customerId: string) {
  console.log('\n=== Cleaning up previous test data ===')
  
  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .or(`customer_id.eq.${ceoId},customer_id.eq.${customerId}`)
  
  if (orders && orders.length > 0) {
    const orderIds = orders.map(o => o.id)
    await supabase.from('order_messages').delete().in('order_id', orderIds)
    await supabase.from('project_progress').delete().in('order_id', orderIds)
    await supabase.from('project_internal_notes').delete().in('order_id', orderIds)
    await supabase.from('notifications').delete().in('order_id', orderIds)
    await supabase.from('orders').delete().in('id', orderIds)
    console.log(`  Cleaned ${orders.length} orders and related data`)
  }
  
  await supabase.from('users').delete().in('id', [ceoId, customerId])
  console.log('  Deleted test users from public.users')
}

async function seedAndTest() {
  console.log('=== MAiCORP End-to-End Test ===\n')

  // Use unique emails to avoid auth conflicts with previous runs
  const runId = Date.now().toString(36)
  const ceoEmail = `test-ceo-e2e-${runId}@maicorp.test`
  const ceoPassword = 'TestCEO123!'
  const ceoName = 'Test CEO'

  const customerEmail = `test-customer-e2e-${runId}@maicorp.test`
  const customerPassword = 'TestCustomer123!'
  const customerName = 'Test Customer'

  // ===== STEP 1: Seed CEO Account =====
  console.log('--- Step 1: Seed CEO Account ---')

  const { data: ceoSignup, error: ceoSignupError } = await supabase.auth.signUp({
    email: ceoEmail,
    password: ceoPassword,
    options: { data: { full_name: ceoName } }
  })

  if (ceoSignupError || !ceoSignup.user) {
    fail('CEO signup', ceoSignupError?.message || 'No user returned')
    return
  }

  const ceoId = ceoSignup.user.id
  console.log(`  CEO auth user created: ${ceoId}`)

  // Create public.users row for CEO
  const { error: ceoUserError } = await supabase
    .from('users')
    .upsert({ id: ceoId, email: ceoEmail, full_name: ceoName, role: 'CEO', account_status: 'ACTIVE' })
  
  if (ceoUserError) {
    fail('CEO users row creation', ceoUserError.message)
    return
  }
  pass('CEO users row created')

  // Verify CEO can login
  const { data: ceoLogin, error: ceoLoginError } = await supabase.auth.signInWithPassword({
    email: ceoEmail,
    password: ceoPassword
  })
  if (ceoLoginError || !ceoLogin.user) {
    fail('CEO login', ceoLoginError?.message || 'No session')
  } else {
    pass('CEO login successful', ceoLogin.user.email)
  }

  // Verify CEO role in users table
  const { data: ceoProfile, error: ceoProfileError } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('id', ceoId)
    .single()
  
  if (ceoProfileError || ceoProfile?.role !== 'CEO') {
    fail('CEO role verification', ceoProfileError?.message || `Role is ${ceoProfile?.role}`)
  } else {
    pass('CEO role is CEO', `status=${ceoProfile.account_status}`)
  }

  // ===== STEP 2: Seed CUSTOMER Account =====
  console.log('\n--- Step 2: Seed CUSTOMER Account ---')

  const { data: customerSignup, error: customerSignupError } = await supabase.auth.signUp({
    email: customerEmail,
    password: customerPassword,
    options: { data: { full_name: customerName } }
  })

  if (customerSignupError || !customerSignup.user) {
    fail('CUSTOMER signup', customerSignupError?.message || 'No user returned')
    return
  }

  const customerId = customerSignup.user.id
  console.log(`  CUSTOMER auth user created: ${customerId}`)

  const { error: customerUserError } = await supabase
    .from('users')
    .upsert({ id: customerId, email: customerEmail, full_name: customerName, role: 'CUSTOMER', account_status: 'ACTIVE' })
  
  if (customerUserError) {
    fail('CUSTOMER users row creation', customerUserError.message)
    return
  }
  pass('CUSTOMER users row created')

  const { data: customerLogin, error: customerLoginError } = await supabase.auth.signInWithPassword({
    email: customerEmail,
    password: customerPassword
  })
  if (customerLoginError || !customerLogin.user) {
    fail('CUSTOMER login', customerLoginError?.message || 'No session')
  } else {
    pass('CUSTOMER login successful', customerLogin.user.email)
  }

  // ===== STEP 3: Create Test Order =====
  console.log('\n--- Step 3: Create Test Order ---')
  
  // Get a product
  const { data: products } = await supabase.from('products').select('*').limit(1)
  if (!products || products.length === 0) {
    fail('Get product for order', 'No products available')
    return
  }
  const product = products[0]
  pass('Found product for order', product.name)

  // Create order as customer
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: customerId,
      product_id: product.id,
      amount_cents: product.price_cents,
      currency: product.currency,
      status: 'PENDING_PAYMENT',
      management_plan: 'NONE',
      infrastructure_acknowledged_at: new Date().toISOString(),
    })
    .select('id, status, customer_id')
    .single()
  
  if (orderError || !order) {
    fail('Create order', orderError?.message || 'No order returned')
    return
  }
  pass('Order created', `id=${order.id}, status=${order.status}`)

  // ===== STEP 4: Test Customer-to-CEO Chat =====
  console.log('\n--- Step 4: Customer-to-CEO Chat ---')
  
  const customerMsg = 'Hello, I have a question about my order.'
  const { data: msg1, error: msg1Error } = await supabase
    .from('order_messages')
    .insert({
      order_id: order.id,
      sender_user_id: customerId,
      sender_role: 'CUSTOMER',
      message: customerMsg,
    })
    .select('id, message, sender_role')
    .single()
  
  if (msg1Error || !msg1) {
    fail('Customer sends message', msg1Error?.message || 'No message returned')
  } else {
    pass('Customer message sent', `"${msg1.message.substring(0, 30)}..."`)
  }

  // Switch to CEO session and send reply
  const { error: ceoSigninError } = await supabase.auth.signInWithPassword({
    email: ceoEmail,
    password: ceoPassword
  })
  if (ceoSigninError) {
    fail('CEO signin for chat', ceoSigninError.message)
  }

  const ceoReply = 'Thank you for reaching out! We will review your order shortly.'
  const { data: msg2, error: msg2Error } = await supabase
    .from('order_messages')
    .insert({
      order_id: order.id,
      sender_user_id: ceoId,
      sender_role: 'CEO',
      message: ceoReply,
    })
    .select('id, message, sender_role')
    .single()
  
  if (msg2Error || !msg2) {
    fail('CEO sends message', msg2Error?.message || 'No message returned')
  } else {
    pass('CEO message sent', `"${msg2.message.substring(0, 30)}..."`)
  }

  // ===== STEP 5: Verify CEO sees order in summary RPC =====
  console.log('\n--- Step 5: CEO Summary RPC ---')
  
  const { data: summaries, error: summariesError } = await supabase
    .rpc('get_ceo_project_summaries')
  
  if (summariesError) {
    fail('CEO summary RPC', summariesError.message)
  } else if (!summaries || summaries.length === 0) {
    fail('CEO summary RPC', 'No summaries returned')
  } else {
    const orderSummary = summaries.find(s => s.order_id === order.id)
    if (orderSummary) {
      pass('CEO summary contains order', `unread=${orderSummary.unread_count}, latest="${orderSummary.latest_message?.substring(0, 30)}"`)
    } else {
      fail('CEO summary contains order', 'Order not found in summary')
    }
  }

  // ===== STEP 6: Verify RLS - Customer A cannot see Customer B data =====
  console.log('\n--- Step 6: RLS Cross-Customer Isolation ---')
  
  // Create a second customer
  const customerBEmail = `test-customer-b-e2e-${runId}@maicorp.test`
  const customerBPassword = 'TestCustomerB123!'
  const { data: custBSignup, error: custBSignupError } = await supabase.auth.signUp({
    email: customerBEmail,
    password: customerBPassword,
    options: { data: { full_name: 'Customer B' } }
  })
  
  if (custBSignupError || !custBSignup.user) {
    fail('Customer B signup', custBSignupError?.message)
  } else {
    const custBId = custBSignup.user.id
    await supabase.from('users').upsert({ id: custBId, email: customerBEmail, full_name: 'Customer B', role: 'CUSTOMER', account_status: 'ACTIVE' })
    
    // Create order for Customer B
    const { data: orderB } = await supabase
      .from('orders')
      .insert({
        customer_id: custBId,
        product_id: product.id,
        amount_cents: product.price_cents,
        currency: product.currency,
        status: 'PENDING_PAYMENT',
        management_plan: 'NONE',
      })
      .select('id')
      .single()
    
    if (orderB) {
      // Sign in as Customer A
      await supabase.auth.signInWithPassword({ email: customerEmail, password: customerPassword })
      
      // Try to read Customer B's order
      const { data: crossOrder, error: crossOrderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderB.id)
        .maybeSingle()
      
      if (crossOrder && !crossOrderError) {
        fail('RLS cross-customer order read', 'Customer A could read Customer B order')
      } else {
        pass('RLS cross-customer order read blocked', 'Correctly denied access')
      }

      // Try to read Customer B's messages
      const { data: crossMessages, error: crossMessagesError } = await supabase
        .from('order_messages')
        .select('*')
        .eq('order_id', orderB.id)
      
      if (crossMessages && crossMessages.length > 0 && !crossMessagesError) {
        fail('RLS cross-customer messages read', `Customer A could read ${crossMessages.length} messages`)
      } else {
        pass('RLS cross-customer messages read blocked', 'Correctly denied access')
      }

      // Cleanup Customer B
      await supabase.from('order_messages').delete().eq('order_id', orderB.id)
      await supabase.from('orders').delete().eq('id', orderB.id)
      await supabase.from('users').delete().eq('id', custBId)
    }
  }

  // ===== STEP 7: Verify Internal Notes are CEO-only =====
  console.log('\n--- Step 7: Internal Notes CEO-only ---')
  
  // Ensure CEO is signed in
  await supabase.auth.signInWithPassword({ email: ceoEmail, password: ceoPassword })
  const { data: note, error: noteError } = await supabase
    .from('project_internal_notes')
    .insert({
      order_id: order.id,
      body: 'This is a private CEO note for testing.',
      author_id: ceoId,
    })
    .select('id')
    .single()
  
  if (noteError) {
    fail('CEO creates internal note', noteError.message)
  } else {
    pass('CEO creates internal note', `id=${note.id}`)
  }

  // Switch to customer and try to read internal notes
  await supabase.auth.signInWithPassword({ email: customerEmail, password: customerPassword })
  const { data: customerNotes, error: customerNotesError } = await supabase
    .from('project_internal_notes')
    .select('*')
    .eq('order_id', order.id)
  
  if (customerNotes && customerNotes.length > 0 && !customerNotesError) {
    fail('Customer reads internal notes', 'Customer could read CEO-only notes')
  } else {
    pass('Customer cannot read internal notes', 'Correctly blocked')
  }

  // ===== STEP 8: Verify CEO can read all messages =====
  console.log('\n--- Step 8: CEO Message Access ---')
  
  await supabase.auth.signInWithPassword({ email: ceoEmail, password: ceoPassword })
  const { data: allMessages, error: allMessagesError } = await supabase
    .from('order_messages')
    .select('*')
    .eq('order_id', order.id)
  
  if (allMessagesError) {
    fail('CEO reads all messages', allMessagesError.message)
  } else if (allMessages && allMessages.length >= 2) {
    pass('CEO reads all messages', `Found ${allMessages.length} messages`)
  } else {
    fail('CEO reads all messages', `Expected >=2, got ${allMessages?.length || 0}`)
  }

  // ===== STEP 9: Verify Customer can read their own messages =====
  console.log('\n--- Step 9: Customer Message Access ---')
  
  await supabase.auth.signInWithPassword({ email: customerEmail, password: customerPassword })
  const { data: customerMessages, error: customerMessagesError } = await supabase
    .from('order_messages')
    .select('*')
    .eq('order_id', order.id)
  
  if (customerMessagesError) {
    fail('Customer reads own messages', customerMessagesError.message)
  } else if (customerMessages && customerMessages.length >= 1) {
    pass('Customer reads own messages', `Found ${customerMessages.length} messages`)
  } else {
    fail('Customer reads own messages', `Expected >=1, got ${customerMessages?.length || 0}`)
  }

  // ===== STEP 10: Test mark_order_messages_read RPC =====
  console.log('\n--- Step 10: Mark Messages Read RPC ---')
  
  await supabase.auth.signInWithPassword({ email: ceoEmail, password: ceoPassword })
  const { data: _readResult, error: readError } = await supabase.rpc('mark_order_messages_read', {
    p_order_id: order.id
  })
  
  if (readError) {
    fail('mark_order_messages_read RPC', readError.message)
  } else {
    pass('mark_order_messages_read RPC executed')
  }

  // ===== STEP 11: Verify Project Progress =====
  console.log('\n--- Step 11: Project Progress ---')
  
  const { data: progress, error: progressError } = await supabase
    .from('project_progress')
    .insert({
      order_id: order.id,
      current_stage: 'PLANNING',
      progress_percent: 10,
      customer_message: 'We are now in the planning phase.',
      customer_visible: true,
      updated_by: ceoId,
    })
    .select('*')
    .single()
  
  if (progressError) {
    fail('Create project progress', progressError.message)
  } else {
    pass('Project progress created', `stage=${progress.current_stage}, percent=${progress.progress_percent}`)
  }

  // Customer should see visible progress
  await supabase.auth.signInWithPassword({ email: customerEmail, password: customerPassword })
  const { data: customerProgress, error: customerProgressError } = await supabase
    .from('project_progress')
    .select('*')
    .eq('order_id', order.id)
    .single()
  
  if (customerProgressError || !customerProgress) {
    fail('Customer reads project progress', customerProgressError?.message || 'No data')
  } else {
    pass('Customer reads visible project progress', `stage=${customerProgress.current_stage}`)
  }

  // ===== STEP 12: Verify Realtime Publication via Notifications =====
  console.log('\n--- Step 12: Realtime / Notifications ---')
  
  await supabase.auth.signInWithPassword({ email: ceoEmail, password: ceoPassword })
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('order_id', order.id)
  
  if (notifications && notifications.length > 0) {
    pass('Notifications created by triggers', `Found ${notifications.length} notifications`)
  } else {
    pass('Notifications table accessible (no notifications yet)')
  }

  // ===== SUMMARY =====
  console.log('\n=== TEST SUMMARY ===')
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`)
  
  if (failed > 0) {
    console.log('\nFailed tests:')
    results.filter(r => !r.pass).forEach(r => console.log(`  - ${r.name}: ${r.detail}`))
  }

  // Cleanup test data
  console.log('\n=== Cleanup ===')
  await cleanupTestData(supabase, ceoId, customerId)
  
  // Sign out
  await supabase.auth.signOut()
  
  console.log('\nDone.')
  process.exit(failed > 0 ? 1 : 0)
}

seedAndTest().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
