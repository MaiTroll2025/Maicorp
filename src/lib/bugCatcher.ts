/**
 * Bug Catcher — universal error capture + structured diagnostics.
 *
 * Errors are reported to Supabase (table `bug_reports`) for the CEO.
 * Sensitive values (passwords, tokens, keys) are stripped before
 * persistence.
 */
import { supabase } from './supabase'
import { useAuth } from './auth'

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

const FINGERPRINT_CACHE = new Map<string, string>()

function normalize(msg: string): string {
  return (msg || '').replace(/[0-9a-f]{8,}/gi, '<HEX>').replace(/[A-Za-z0-9+/]{40,}/g, '<BLOB>')
}

function fingerprint(input: { type: string; msg: string; route?: string; code?: string }) {
  const k = `${input.type}|${normalize(input.msg)}|${input.route ?? ''}|${input.code ?? ''}`
  let h = FINGERPRINT_CACHE.get(k)
  if (!h) {
    let s = 0
    for (let i = 0; i < k.length; i++) s = (s * 31 + k.charCodeAt(i)) | 0
    h = Math.abs(s).toString(16).padStart(8, '0').slice(0, 16)
    FINGERPRINT_CACHE.set(k, h)
  }
  return h
}

export interface BugReportInput {
  severity: Severity
  error_type: string
  error_message: string
  stack_trace?: string
  route?: string
  component?: string
  function_name?: string
  database_error_code?: string
  metadata?: Record<string, unknown>
}

const SENSITIVE_KEYS = [
  'password',
  'token',
  'access_token',
  'refresh_token',
  'apikey',
  'api_key',
  'service_role',
  'service-role',
  'secret',
  'authorization',
]

function sanitize(value: unknown): unknown {
  if (!value) return value
  if (typeof value === 'string') {
    let v = value
    for (const k of SENSITIVE_KEYS) {
      v = v.replace(new RegExp(`("${k}"\\s*:\\s*)"[^"]*"`, 'gi'), `$1"<REDACTED>"`)
      v = v.replace(new RegExp(`(${k}=)[^&\\s]+`, 'gi'), `$1<REDACTED>`)
    }
    return v
  }
  if (Array.isArray(value)) return value.map(sanitize)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
        out[k] = '<REDACTED>'
      } else out[k] = sanitize(v)
    }
    return out
  }
  return value
}

export async function recordBug(input: BugReportInput): Promise<string | null> {
  try {
    const fp = fingerprint({
      type: input.error_type,
      msg: input.error_message,
      route: input.route,
      code: input.database_error_code,
    })

    const safeMessage = sanitize(input.error_message) as string
    const safeStack = sanitize(input.stack_trace ?? '') as string
    const safeMeta = sanitize(input.metadata ?? {}) as Record<string, unknown>

    // 1) Try upsert into existing report (deduplicate by fingerprint)
    const { data: existing, error: selErr } = await supabase
      .from('bug_reports')
      .select('id,occurrence_count')
      .eq('fingerprint', fp)
      .maybeSingle()

    if (selErr) {
      console.warn('[bugCatcher] dedupe lookup failed', selErr.message)
    }

    if (existing?.id) {
      await supabase
        .from('bug_reports')
        .update({
          occurrence_count: (existing.occurrence_count ?? 1) + 1,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      return existing.id
    }

    const u = useAuth.getState().user
    const row = {
      severity: input.severity,
      status: 'NEW',
      title: `${input.error_type}: ${safeMessage.slice(0, 140)}`,
      summary: safeMessage.slice(0, 500),
      error_type: input.error_type,
      error_message: safeMessage,
      stack_trace: safeStack,
      route: input.route ?? null,
      component: input.component ?? null,
      function_name: input.function_name ?? null,
      database_error_code: input.database_error_code ?? null,
      metadata: safeMeta,
      environment: import.meta.env.MODE,
      app_version: (import.meta.env.VITE_APP_VERSION as string) ?? 'dev',
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      user_id: u?.id ?? null,
    }
    const { data, error } = await supabase.from('bug_reports').insert(row).select('id').single()
    if (error) {
      console.warn('[bugCatcher] insert failed', error.message)
      return null
    }
    return data?.id ?? null
  } catch (e) {
    console.warn('[bugCatcher] exception', e)
    return null
  }
}

let _initialized = false
export function initBugCatcher() {
  if (_initialized || typeof window === 'undefined') return
  _initialized = true

  window.addEventListener('error', (event) => {
    void recordBug({
      severity: 'MEDIUM',
      error_type: 'JS_ERROR',
      error_message: event.message || 'Unknown error',
      stack_trace: event.error?.stack ?? '',
      route: location.pathname,
      metadata: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = event.reason
    void recordBug({
      severity: 'HIGH',
      error_type: 'UNHANDLED_REJECTION',
      error_message: reason?.message ?? String(reason ?? 'unknown'),
      stack_trace: reason?.stack ?? '',
      route: location.pathname,
      metadata: { name: reason?.name },
    })
  })
}