export const SITE_URL = 'https://maicorp.online'
export const SITE_NAME = 'MAI Corp'
export const DEFAULT_TITLE = 'MAI Corp | Technology Built With Purpose'
export const DEFAULT_DESCRIPTION = 'MAI Corp builds public technology platforms and digital products with human-led development.'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/mai.svg`
export const ORGANIZATION_ID = `${SITE_URL}/#organization`
export const WEBSITE_ID = `${SITE_URL}/#website`

export function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: SITE_URL,
    description: 'Technology company building public platforms and digital products with human-led development.',
  }
}

export function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { '@id': ORGANIZATION_ID },
  }
}

export function canonicalUrl(path = '/') {
  const pathname = path.split(/[?#]/, 1)[0] || '/'
  const normalized = `/${pathname.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/')}`
  return `${SITE_URL}${normalized === '/' ? '/' : normalized}`
}
