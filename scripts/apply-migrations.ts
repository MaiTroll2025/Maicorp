/* eslint-disable no-console */
import { Client } from 'pg'
import fs from 'node:fs'
import path from 'node:path'

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'jkavykrzaygeiwjjmlma'
const HOST = `db.${PROJECT_REF}.supabase.co`
const candidates = [
  process.env.SUPABASE_DB_PASSWORD,
  process.env.PGPASSWORD,
].filter(Boolean) as string[]

const MIGRATIONS_DIR = path.resolve('supabase/migrations')
const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()

async function tryConnect(password: string) {
  const c = new Client({
    host: HOST,
    port: 5432,
    user: 'postgres',
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  })
  await c.connect()
  return c
}

async function main() {
  let client: any = null
  for (const p of candidates) {
    try {
      console.log('Trying password…')
      client = await tryConnect(p)
      console.log('Connected.')
      break
    } catch (e: any) {
      console.log('Failed:', e.message.split('\n')[0])
    }
  }
  if (!client) {
    console.error('Unable to connect with supplied credentials.')
    process.exit(1)
  }
  for (const f of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')
    process.stdout.write(`→ ${f} ... `)
    try {
      await client.query(sql)
      console.log('OK')
    } catch (e: any) {
      console.log('FAIL:', e.message)
    }
  }
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})