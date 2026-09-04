// Supabase Edge Function: sync-maiupdate
// Fetches the MAIUPDATE.json file from each platform's configured
// maiupdate_url and publishes the updates into the app_updates table.
//
// Triggered by:
//   - GitHub Actions on git push (webhook mode with x-webhook-secret)
//   - CEO dashboard manual sync (bearer JWT from an authenticated CEO)
//
// Required live secrets (set with `supabase secrets set`):
//   MAIUPDATE_WEBHOOK_SECRET  (shared secret for automated webhook calls)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injected automatically)
//
// deploy:
//   supabase functions deploy sync-maiupdate --no-verify-jwt

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface MaiUpdateFile {
  app: string
  slug: string
  status: string
  version: string
  last_updated: string
  links?: { website?: string; ios?: string; android?: string }
  updates: Array<{
    version: string
    date: string
    title: string
    description: string
    type: string
    featured?: boolean
    download_url?: string
    icon_url?: string
  }>
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function parseDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return new Date().toISOString()
    return d.toISOString()
  } catch {
    return new Date().toISOString()
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const WEBHOOK_SECRET = Deno.env.get('MAIUPDATE_WEBHOOK_SECRET') ?? ''
  const webhookHeader = req.headers.get('x-webhook-secret') ?? ''
  const isWebhook = WEBHOOK_SECRET && webhookHeader === WEBHOOK_SECRET

  let supabase: any
  let isCEO = false
  let userId: string | null = null

  if (isWebhook) {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    )
  } else {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return json({ error: 'missing authorization' }, 401)
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData } = await supabase.auth.getUser()
    userId = userData?.user?.id
    if (!userId) return json({ error: 'unauthenticated' }, 401)

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
    isCEO = profile?.role === 'CEO'
    if (!isCEO) {
      return json({ error: 'forbidden: CEO access required' }, 403)
    }
  }

  let body: { platform_slug?: string } = {}
  try {
    body = (await req.json().catch(() => ({}))) ?? {}
  } catch {
    body = {}
  }

  const slugs: string[] = body.platform_slug ? [body.platform_slug] : []

  const platformsToSync: Array<{ id: string; slug: string; name: string; maiupdate_url: string | null }> = []

  if (slugs.length === 0) {
    const { data: allPlatforms, error } = await supabase
      .from('platforms')
      .select('id,slug,name,maiupdate_url')
      .eq('enabled', true)
    if (error) return json({ error: error.message }, 500)
    platformsToSync.push(...(allPlatforms ?? []))
  } else {
    const { data: platformRows, error } = await supabase
      .from('platforms')
      .select('id,slug,name,maiupdate_url')
      .in('slug', slugs)
    if (error) return json({ error: error.message }, 500)
    platformsToSync.push(...(platformRows ?? []))
  }

  if (platformsToSync.length === 0) return json({ error: 'no platforms configured' }, 404)

  const results: Array<{ platform: string; ok: boolean; error?: string; updates: number }> = []

  for (const p of platformsToSync) {
    if (!p.maiupdate_url) {
      results.push({ platform: p.slug, ok: false, error: 'no maiupdate_url configured', updates: 0 })
      continue
    }
    try {
      const res = await fetch(p.maiupdate_url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const rawText = await res.text()
      const file: MaiUpdateFile = JSON.parse(rawText)

      if (!file.app || !file.version) {
        throw new Error('MAIUPDATE.json missing required "app" or "version"')
      }

      let count = 0

      // Map MAIUPDATE.json app status to platform_apps.app_status
      const appStatusMap: Record<string, string> = {
        LIVE: 'CURRENT',
        CURRENT: 'CURRENT',
        BETA: 'BETA',
        IN_DEVELOPMENT: 'BETA',
        COMING_SOON: 'BETA',
        DEPRECATED: 'DEPRECATED',
      }
      const appStatus = appStatusMap[file.status] ?? 'CURRENT'

      // Upsert the platform_apps record (latest version)
      // Clear existing latest for this platform, then insert the new one.
      await supabase
        .from('platform_apps')
        .update({ is_latest: false, updated_at: new Date().toISOString() })
        .eq('platform_id', p.id)
        .eq('is_latest', true)

      await supabase.from('platform_apps').insert({
        platform_id: p.id,
        name: file.app,
        version: file.version,
        is_latest: true,
        app_status: appStatus,
        release_time: parseDate(file.last_updated ?? new Date().toISOString()),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      // Upsert each update entry
      const updates = Array.isArray(file.updates) ? file.updates : []
      for (const u of updates) {
        if (!u.version || !u.title) continue
        await supabase.rpc('upsert_app_update', {
          p_platform_slug: file.slug || p.slug,
          p_version: u.version,
          p_title: u.title,
          p_description: u.description ?? '',
          p_release_notes: u.release_notes ?? u.description ?? '',
          p_release_time: parseDate(u.date),
          p_download_url: u.download_url ?? null,
          p_icon_url: u.icon_url ?? null,
          p_update_type: u.type ?? 'feature',
          p_is_featured: u.featured ?? false,
          p_status: 'PUBLISHED',
        })
        count++
      }

      // Record the successful sync
      await supabase.from('platforms').update({
        last_sync_at: new Date().toISOString(),
      }).eq('id', p.id)

      results.push({ platform: p.slug, ok: true, updates: count })
    } catch (e: any) {
      results.push({ platform: p.slug, ok: false, error: e?.message ?? 'unknown', updates: 0 })
    }
  }

  // Audit
  try {
    await supabase.from('audit_logs').insert({
      actor_id: userId,
      action: 'MAIUPDATE_SYNC',
      target: JSON.stringify(results),
      result: 'OK',
      metadata: { webhook: isWebhook, platform_count: platformsToSync.length },
    })
  } catch {
    // non-fatal
  }

  return json({ ok: true, results }, 200)
})
