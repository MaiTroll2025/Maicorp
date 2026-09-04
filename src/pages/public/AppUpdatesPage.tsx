import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Container, H1, H2, H3, Card, Chip, Eyebrow, StatusDot } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { Search, ExternalLink } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

interface Platform {
  id: string
  slug: string
  name: string
  description: string | null
}

interface AppUpdate {
  id: string
  platform_id: string
  app_id: string | null
  version: string
  title: string
  description: string | null
  release_notes: string | null
  release_time: string
  download_url: string | null
  file_size: number | null
  icon_url: string | null
  is_featured: boolean
  update_type: string
  published_at: string | null
}

const ALL_PLATFORMS = 'all'
const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  major: { label: 'Major', color: '#DC2626' },
  feature: { label: 'Feature', color: '#00BFFF' },
  fix: { label: 'Fix', color: '#10B981' },
  security: { label: 'Security', color: '#F59E0B' },
  announcement: { label: 'Announcement', color: '#8B5CF6' },
}

export function AppUpdatesPage() {
  const [updates, setUpdates] = useState<AppUpdate[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>(ALL_PLATFORMS)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => {
    Promise.all([
      supabase
        .from('app_updates')
        .select('*')
        .eq('status', 'PUBLISHED')
        .order('release_time', { ascending: false }),
      supabase
        .from('platforms')
        .select('id,slug,name,description')
        .eq('enabled', true),
    ]).then(([u, p]) => {
      setUpdates((u.data ?? []) as any)
      setPlatforms((p.data ?? []) as any)
      setLoading(false)
    })
  }, [])

  const platformMap = useMemo(() => {
    const m = new Map<string, Platform>()
    for (const p of platforms) m.set(p.id, p)
    return m
  }, [platforms])

  const filtered = useMemo(() => {
    return updates.filter((u) => {
      const plat = platformMap.get(u.platform_id)
      const searchTerms = (search || '').toLowerCase().trim()
      if (searchTerms) {
        const haystack = `${plat?.name ?? ''} ${u.version} ${u.title} ${u.description ?? ''} ${u.release_notes ?? ''}`.toLowerCase()
        if (!haystack.includes(searchTerms)) return false
      }
      if (platformFilter !== ALL_PLATFORMS && plat?.slug !== platformFilter) return false
      if (typeFilter !== 'all' && u.update_type !== typeFilter) return false
      return true
    })
  }, [updates, platformMap, search, platformFilter, typeFilter])

  const featured = useMemo(() => filtered.filter((u) => u.is_featured), [filtered])
  const rest = useMemo(() => filtered.filter((u) => !u.is_featured), [filtered])

  const formatDate = (iso: string) => {
    try {
      return format(new Date(iso), 'PPPP')
    } catch {
      return iso
    }
  }

  const formatTimeAgo = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true })
    } catch {
      return ''
    }
  }

  const clearFilters = () => {
    setSearch('')
    setPlatformFilter(ALL_PLATFORMS)
    setTypeFilter('all')
  }

  const hasActiveFilters = search || platformFilter !== ALL_PLATFORMS || typeFilter !== 'all'

  return (
    <>
      <section>
        <Container className="pt-20 pb-12">
          <Eyebrow>PRODUCT UPDATES</Eyebrow>
          <H1 className="mt-3 chrome-text">MAI CORP Updates Hub</H1>
          <p className="mt-4 max-w-2xl text-muted">
            Every MAI Corp project publishes a <code className="text-primary">MAIUPDATE.json</code> file on git push.
            This page automatically displays the latest, user-friendly updates across the entire ecosystem.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                placeholder="Search apps, versions, or updates…"
                className="input pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {hasActiveFilters && (
              <button className="btn-ghost text-xs" onClick={clearFilters}>Clear filters</button>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <PlatformFilter
              label="ALL"
              active={platformFilter === ALL_PLATFORMS}
              onClick={() => setPlatformFilter(ALL_PLATFORMS)}
            />
            {platforms.map((p) => (
              <PlatformFilter
                key={p.id}
                label={p.name.toUpperCase().replace(' ', '-')}
                active={platformFilter === p.slug}
                onClick={() => setPlatformFilter(p.slug)}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(TYPE_LABELS).map(([type, info]) => (
              <TypeFilter
                key={type}
                label={info.label}
                color={info.color}
                active={typeFilter === type}
                onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
              />
            ))}
            {typeFilter !== 'all' && (
              <button className="btn-ghost text-xs" onClick={() => setTypeFilter('all')}>Clear type</button>
            )}
          </div>
        </Container>
      </section>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-6 bg-white/5 rounded mb-2"></div>
              <div className="h-4 bg-white/5 rounded w-4/5 mb-2"></div>
              <div className="h-4 bg-white/5 rounded w-3/4"></div>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {featured.length > 0 && (
            <section className="border-t border-line/30">
              <Container className="py-12">
                <H2 className="mb-6">Featured updates</H2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {featured.map((u) => (
                    <UpdateCard key={u.id} update={u} platform={platformMap.get(u.platform_id)} formatDate={formatDate} formatTimeAgo={formatTimeAgo} />
                  ))}
                </div>
              </Container>
            </section>
          )}

          <section className="border-t border-line/30">
            <Container className="py-12">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <H2>{filtered.length === 0 && !hasActiveFilters ? 'All updates' : `All updates (${filtered.length})`}</H2>
                {filtered.length === 0 && (
                  <p className="text-sm text-muted">No updates match your filters.</p>
                )}
              </div>

              {!rest.length && !featured.length ? (
                <p className="mt-8 text-muted">No published updates yet. Check back soon!</p>
              ) : (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rest.map((u) => (
                    <UpdateCard key={u.id} update={u} platform={platformMap.get(u.platform_id)} formatDate={formatDate} formatTimeAgo={formatTimeAgo} />
                  ))}
                </div>
              )}
            </Container>
          </section>
        </>
      )}
    </>
  )
}

function UpdateCard({
  update,
  platform,
  formatDate,
  formatTimeAgo,
}: {
  update: AppUpdate
  platform: Platform | undefined
  formatDate: (iso: string) => string
  formatTimeAgo: (iso: string) => string
}) {
  const typeInfo = TYPE_LABELS[update.update_type] ?? TYPE_LABELS.feature
  const typeTone: Record<string, 'ok' | 'warn' | 'err' | 'crit' | 'info' | 'purp'> = {
    major: 'crit',
    feature: 'info',
    fix: 'ok',
    security: 'warn',
    announcement: 'purp',
  }
  const statusText = platform?.slug === 'maicorp' ? 'CORPORATE' : 'LIVE'
  const statusTone: Record<string, 'ok' | 'warn' | 'err' | 'crit' | 'info' | 'purp' | 'default'> = {
    CORPORATE: 'purp',
    LIVE: 'ok',
  }
  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {platform ? (
            <>
              <StatusDot tone={typeTone[update.update_type] ?? 'info'} />
              <Chip tone="default">{platform.name}</Chip>
            </>
          ) : (
            <Chip tone="default">{update.version}</Chip>
          )}
          <Chip tone={statusTone[statusText] ?? 'default'}>{statusText}</Chip>
          <Chip tone={typeTone[update.update_type] ?? 'default'}>{typeInfo.label}</Chip>
        </div>
        {update.is_featured && <span className="text-xs text-muted">★ Featured</span>}
      </div>

      <div className="mt-3 space-y-2 flex-1 flex flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-widest text-muted">v{update.version}</span>
          <H3 className="text-lg">{update.title}</H3>
        </div>
        {update.description && <p className="text-sm text-hi/80 leading-relaxed line-clamp-3">{update.description}</p>}
        {update.release_notes && (
          <p className="text-xs text-muted mt-2 line-clamp-3">{update.release_notes}</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted">
        <time dateTime={update.release_time}>
          {formatDate(update.release_time)} <span className="text-muted/60">({formatTimeAgo(update.release_time)})</span>
        </time>
        {update.download_url && (
          <a href={update.download_url} target="_blank" rel="noreferrer" className="text-primary hover:text-hi flex items-center gap-1" aria-label={`Download ${update.title}`}>
            <ExternalLink size={12} /> Download
          </a>
        )}
      </div>
    </Card>
  )
}

function PlatformFilter({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'text-xs px-4 py-1.5 rounded-full transition-all',
        active
          ? 'bg-primary text-white'
          : 'text-muted hover:text-hi hover:bg-white/5 border border-line/30',
      )}
    >
      {label}
    </button>
  )
}

function TypeFilter({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'text-xs px-4 py-1.5 rounded-full transition-all',
        active
          ? 'text-white'
          : 'text-muted hover:text-hi hover:bg-white/5 border border-line/30',
      )}
      style={active ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {label}
    </button>
  )
}
