import { useEffect } from 'react'
import { canonicalUrl, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME } from '@/config/seo'

type SeoProps = {
  title: string
  description: string
  path?: string
  type?: 'website' | 'article'
  noindex?: boolean
  nofollow?: boolean
  image?: string
  imageAlt?: string
  locale?: string
  author?: string
  publishedTime?: string
  modifiedTime?: string
  keywords?: string[]
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.appendChild(tag)
  }
  tag.content = content
}

function upsertLink(rel: string, href: string) {
  let tag = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!tag) {
    tag = document.createElement('link')
    tag.rel = rel
    document.head.appendChild(tag)
  }
  tag.href = href
}

export function Seo({ title, description = DEFAULT_DESCRIPTION, path = '/', type = 'website', noindex = false, nofollow = false, image = DEFAULT_OG_IMAGE, imageAlt = `${SITE_NAME} social preview`, locale = 'en_US', author, publishedTime, modifiedTime, keywords, jsonLd }: SeoProps) {
  useEffect(() => {
    const canonical = canonicalUrl(path)
    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', `${noindex ? 'noindex' : 'index'},${nofollow ? 'nofollow' : 'follow'}`)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', canonical)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:site_name', 'MAI Corp')
    upsertMeta('property', 'og:image', image)
    upsertMeta('property', 'og:image:alt', imageAlt)
    upsertMeta('property', 'og:locale', locale)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', image)
    if (author) upsertMeta('name', 'author', author)
    if (publishedTime) upsertMeta('property', 'article:published_time', publishedTime)
    if (modifiedTime) upsertMeta('property', 'article:modified_time', modifiedTime)
    if (keywords?.length) upsertMeta('name', 'keywords', keywords.join(', '))
    upsertLink('canonical', canonical)

    document.querySelectorAll('script[data-mai-seo]').forEach((node) => node.remove())
    const graph = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : []
    if (graph.length) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.maiSeo = 'true'
      script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
      document.head.appendChild(script)
    }
  }, [author, description, image, imageAlt, jsonLd, keywords, locale, modifiedTime, nofollow, noindex, path, publishedTime, title, type])
  return null
}


