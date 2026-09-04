const fromCharCode = globalThis.String.fromCharCode
const mojibakeEmDash = fromCharCode(0x00e2, 0x20ac, 0x201d)
const mojibakeEnDash = fromCharCode(0x00e2, 0x20ac, 0x201c)

export function cleanText(value: string | null | undefined) {
  return value?.replaceAll(mojibakeEmDash, '-').replaceAll(mojibakeEnDash, '-')
}

export function cleanCmsValue<T>(value: T): T {
  if (typeof value === 'string') return cleanText(value) as T
  if (Array.isArray(value)) return value.map(cleanCmsValue) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cleanCmsValue(item)])) as T
  }
  return value
}
