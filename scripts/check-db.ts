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
    if (eq > 0) {
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
  }
  return env
}

const env = loadEnv()
const supabase = createClient(env.VITE_SUPABASE_URL!, env.VITE_SUPABASE_ANON_KEY!)

async function checkDb() {
  console.log('=== Checking Database State ===')
  
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('*')
    .limit(5)
  console.log('Products count:', prodError ? prodError.message : products?.length || 0)
  if (products && products.length > 0) {
    console.log('Sample product:', products[0].name, '-', products[0].price_cents, 'cents')
  }

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, full_name, role, account_status')
    .limit(10)
  console.log('Existing users count:', usersError ? usersError.message : users?.length || 0)
  if (users && users.length > 0) {
    console.log('Sample users:', users.map(u => `${u.email} (${u.role})`).join(', '))
  }

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, status, customer_id, product_id, amount_cents')
    .limit(5)
  console.log('Existing orders count:', ordersError ? ordersError.message : orders?.length || 0)
}

checkDb().catch(console.error)
