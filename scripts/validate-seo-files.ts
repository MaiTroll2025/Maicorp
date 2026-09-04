import fs from 'node:fs/promises'
import path from 'node:path'
import { SITE_URL } from '../src/config/seo.ts'

const publicDir = path.resolve('public')
const privateRoute = /\/(account|ceo|employee|hr|cart|checkout|login|signup|search)(\/|$)/

async function main() {
  const sitemap = await fs.readFile(path.join(publicDir, 'sitemap.xml'), 'utf8')
  const robots = await fs.readFile(path.join(publicDir, 'robots.txt'), 'utf8')
  if (!sitemap.startsWith('<?xml') || !sitemap.includes('<sitemapindex')) throw new Error('sitemap.xml is not a sitemap index')
  if (!robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) throw new Error('robots.txt does not reference the canonical sitemap')

  const shardFiles = (await fs.readdir(path.join(publicDir, 'sitemaps'))).filter((file) => file.endsWith('.xml'))
  const urls: string[] = []
  for (const file of shardFiles) {
    const xml = await fs.readFile(path.join(publicDir, 'sitemaps', file), 'utf8')
    if (!xml.startsWith('<?xml') || !xml.includes('<urlset')) throw new Error(`${file} is not a valid URL set`)
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(match[1])
  }
  const unique = new Set(urls)
  if (unique.size !== urls.length) throw new Error('Duplicate sitemap URLs detected')
  for (const url of urls) {
    if (!url.startsWith(SITE_URL) || /maicorp\.com|localhost|127\.0\.0\.1/.test(url)) throw new Error(`Invalid sitemap domain: ${url}`)
    if (/[?#]/.test(url) || privateRoute.test(url)) throw new Error(`Non-indexable sitemap URL: ${url}`)
  }
  console.log(`SEO validation passed: ${urls.length} URLs across ${shardFiles.length} sitemap shard(s)`)
}

main().catch((error) => { console.error(error); process.exit(1) })
