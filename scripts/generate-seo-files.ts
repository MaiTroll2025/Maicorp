import fs from 'node:fs/promises'
import path from 'node:path'
import { SITE_URL } from '../src/config/seo.ts'

function loadEnvFile(file: string) {
  return fs.readFile(file, 'utf8').then((contents) => {
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  }).catch(() => undefined)
}

let supabaseUrl: string | undefined
let anonKey: string | undefined
const publicRoutes = ['/', '/about', '/companies', '/future', '/studio', '/store', '/app-updates', '/support', '/contact']
const sitemapLimit = 45000

type Entity = { slug: string; updated_at?: string | null; status?: string; featured?: boolean }
type SitemapEntry = { path: string; updatedAt?: string | null }

async function fetchPublic(table: string, query: string): Promise<Entity[]> {
  if (!supabaseUrl || !anonKey) return []
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    })
    if (!response.ok) throw new Error(`${response.status}`)
    return response.json() as Promise<Entity[]>
  } catch (error) {
    console.warn(`Could not load public ${table} for sitemap: ${error}`)
    return []
  }
}

function xmlEscape(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function urlSet(entries: SitemapEntry[]) {
  const urls = entries.map((entry) => {
    const lastmod = entry.updatedAt ? `<lastmod>${entry.updatedAt}</lastmod>` : ''
    return `  <url><loc>${xmlEscape(`${SITE_URL}${entry.path}`)}</loc>${lastmod}</url>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

function entriesFor(paths: string[]): SitemapEntry[] {
  return paths.map((path) => ({ path }))
}

function validateEntries(name: string, entries: SitemapEntry[]) {
  const seen = new Set<string>()
  for (const entry of entries) {
    const url = `${SITE_URL}${entry.path}`
    if (seen.has(url)) throw new Error(`Duplicate URL in ${name}: ${url}`)
    if (/[?#]/.test(entry.path)) throw new Error(`Query/hash URL in ${name}: ${entry.path}`)
    if (/\/\//.test(entry.path)) throw new Error(`Duplicate slash in ${name}: ${entry.path}`)
    if (/\/account|\/ceo|\/employee|\/hr|\/cart|\/checkout|\/login|\/signup|\/search/.test(entry.path)) throw new Error(`Private route in ${name}: ${entry.path}`)
    if (!url.startsWith(SITE_URL)) throw new Error(`Invalid domain in ${name}: ${url}`)
    seen.add(url)
  }
}

async function writeSitemapFiles(publicDir: string, name: string, entries: SitemapEntry[]) {
  validateEntries(name, entries)
  const chunks: SitemapEntry[][] = []
  for (let index = 0; index < entries.length; index += sitemapLimit) chunks.push(entries.slice(index, index + sitemapLimit))
  const files: string[] = []
  for (let index = 0; index < chunks.length; index += 1) {
    const filename = `${name}${chunks.length > 1 ? `-${index + 1}` : ''}.xml`
    await fs.writeFile(path.join(publicDir, 'sitemaps', filename), urlSet(chunks[index]))
    files.push(filename)
  }
  return files
}

async function main() {
  await loadEnvFile('.env')
  await loadEnvFile('.env.local')
  supabaseUrl = process.env.VITE_SUPABASE_URL
  anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const publicDir = path.resolve('public')
  await fs.mkdir(path.join(publicDir, 'sitemaps'), { recursive: true })
  for (const file of await fs.readdir(path.join(publicDir, 'sitemaps'))) {
    if (file.endsWith('.xml')) await fs.rm(path.join(publicDir, 'sitemaps', file), { force: true })
  }
  const companies = (await fetchPublic('companies', 'select=slug,updated_at,status&status=in.(LIVE,IN_DEVELOPMENT,COMING_SOON)&order=sort_order')).filter((row) => row.slug)
  const products = (await fetchPublic('products', 'select=slug,updated_at,status&status=eq.AVAILABLE&order=sort_order'))
    .filter((row) => row.slug && row.slug !== 'ceo-app')

  const pageFiles = await writeSitemapFiles(publicDir, 'pages', entriesFor(publicRoutes))
  const companyFiles = await writeSitemapFiles(publicDir, 'companies', companies.map((row) => ({ path: `/companies/${row.slug}`, updatedAt: row.updated_at })))
  const productFiles = await writeSitemapFiles(publicDir, 'products', products.map((row) => ({ path: `/store/product/${row.slug}`, updatedAt: row.updated_at })))
  const sitemapFiles = [...pageFiles, ...companyFiles, ...productFiles]
  await fs.writeFile(path.join(publicDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapFiles.map((file) => `  <sitemap><loc>${SITE_URL}/sitemaps/${file}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`)
  await fs.rm(path.join(publicDir, 'sitemap-index.xml'), { force: true })
  await fs.writeFile(path.join(publicDir, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /account\nDisallow: /ceo\nDisallow: /employee\nDisallow: /hr\nDisallow: /cart\nDisallow: /checkout\nDisallow: /login\nDisallow: /signup\nDisallow: /search\nSitemap: ${SITE_URL}/sitemap.xml\n`)
  console.log(`SEO generated: ${sitemapFiles.length} sitemap file(s), ${publicRoutes.length + companies.length + products.length} indexable URL(s)`)
}

main().catch((error) => { console.error(error); process.exit(1) })
