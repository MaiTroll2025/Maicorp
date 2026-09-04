-- 019 App Updates: MAIUPDATE-driven platform apps + app updates
-- Version: 2026.09.03.002
--
-- Each MAI Corp project carries a MAIUPDATE.json in its git repo.
-- On git push a webhook/GitHub Actions triggers sync-maiupdate which
-- fetches MAIUPDATE.json and publishes the updates below. The frontend
-- presentation is controlled by MAI Corp, not the individual files.

-- ---------------------------------------------------------------------
-- Extend platforms with the MAIUPDATE source URL + last sync timestamp
-- ---------------------------------------------------------------------
alter table public.platforms add column if not exists maiupdate_url text;
alter table public.platforms add column if not exists last_sync_at timestamptz;

-- ---------------------------------------------------------------------
-- Seed the five canonical platforms (4 products + MAI Corp itself)
-- so app updates can attach to them.
-- Idempotent: re-running will refresh descriptive fields + URL.
-- ---------------------------------------------------------------------
insert into public.platforms(slug, name, description, enabled, monitoring_enabled, analytics_enabled, maiupdate_url, created_at, updated_at) values
  ('maicorp', 'MAI Corp', 'The MAI Corp corporate headquarters platform.', true, true, true,
   'https://raw.githubusercontent.com/MaiTroll2025/MAI-Corp/main/MAIUPDATE.json', now(), now()),
  ('maitroll', 'MaiTroll', 'MaiTroll is a social / live entertainment platform designed around interaction, community, creators, broadcasting, and entertainment.', true, true, true,
   'https://raw.githubusercontent.com/MaiTroll2025/MaiTroll/main/MAIUPDATE.json', now(), now()),
  ('otach', 'Otach', 'Otach is an OBD-II diagnostic and education companion designed to help drivers understand and repair their vehicle.', true, true, true,
   'https://raw.githubusercontent.com/MaiTroll2025/Otach/main/MAIUPDATE.json', now(), now()),
  ('udryve', 'Udryve', 'Udryve is the next-generation driver platform for completing deliveries while earning through the MAI Corp ecosystem.', true, true, true,
   'https://raw.githubusercontent.com/MaiTroll2025/Udryve/main/MAIUPDATE.json', now(), now()),
  ('mai-dash', 'MAI Dash', 'MAI Dash is a marketplace for everyday service needs -- mechanics, plumbers, contractors, and local professionals.', true, true, true,
   'https://raw.githubusercontent.com/MaiTroll2025/Mai-Dash/main/MAIUPDATE.json', now(), now())
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  enabled = excluded.enabled,
  monitoring_enabled = excluded.monitoring_enabled,
  analytics_enabled = excluded.analytics_enabled,
  maiupdate_url = excluded.maiupdate_url;

-- ---------------------------------------------------------------------
-- platform_apps: current/latest app package metadata per platform.
-- Populated from MAIUPDATE.json "version" / "last_updated" fields,
-- but also editable by the CEO for manual uploads.
-- ---------------------------------------------------------------------
create table if not exists public.platform_apps (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete cascade,
  name text not null,
  version text not null,
  build_number text,
  download_url text,
  file_size bigint,
  icon_url text,
  description text,
  app_status text not null default 'CURRENT' check (app_status in ('CURRENT','BETA','DEPRECATED')),
  release_time timestamptz not null default now(),
  is_latest boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.platform_apps enable row level security;
drop policy if exists platform_apps_ceo on public.platform_apps;
create policy platform_apps_ceo on public.platform_apps
  for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));
drop policy if exists platform_apps_public_read on public.platform_apps;
create policy platform_apps_public_read on public.platform_apps
  for select using (app_status in ('CURRENT','BETA') and is_latest);
create index if not exists platform_apps_platform_idx on public.platform_apps (platform_id);
create index if not exists platform_apps_version_idx on public.platform_apps (platform_id, version);
create index if not exists platform_apps_latest_idx on public.platform_apps (platform_id, is_latest) where is_latest;

-- ---------------------------------------------------------------------
-- app_updates: individual update/release announcements per platform.
-- Each carries a version, title, friendly description, release_time
-- timestamp, and an update_type for UI categorization.
-- ---------------------------------------------------------------------
create table if not exists public.app_updates (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete cascade,
  app_id uuid references public.platform_apps(id) on delete set null,
  version text not null,
  title text not null,
  description text,
  release_notes text,
  release_time timestamptz not null default now(),
  download_url text,
  file_size bigint,
  icon_url text,
  is_featured boolean not null default false,
  update_type text not null default 'feature' check (update_type in ('major','feature','fix','security','announcement')),
  status text not null default 'PUBLISHED' check (status in ('DRAFT','PUBLISHED')),
  published_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  synced_from_maiupdate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_id, version, title)
);
alter table public.app_updates enable row level security;
drop policy if exists app_updates_ceo on public.app_updates;
create policy app_updates_ceo on public.app_updates
  for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));
drop policy if exists app_updates_public_read on public.app_updates;
create policy app_updates_public_read on public.app_updates
  for select using (status = 'PUBLISHED' and (published_at is null or published_at <= now()));
create index if not exists app_updates_platform_idx on public.app_updates (platform_id);
create index if not exists app_updates_release_idx on public.app_updates (release_time desc);
create index if not exists app_updates_status_idx on public.app_updates (status, published_at desc);
create index if not exists app_updates_featured_idx on public.app_updates (is_featured) where is_featured;
create index if not exists app_updates_type_idx on public.app_updates (update_type);

-- ---------------------------------------------------------------------
-- Seed: MAI Corp sample app + a welcome update
-- ---------------------------------------------------------------------
insert into public.platform_apps(platform_id, name, version, build_number, description, app_status, release_time, is_latest, created_at, updated_at)
select p.id, 'MAI Corp', '1.0.0', '20260903', 'MAI Corp corporate headquarters', 'CURRENT', now(), true, now(), now()
from (select id from public.platforms where slug = 'maicorp') p
where not exists (select 1 from public.platform_apps where platform_id = p.id and is_latest);

insert into public.app_updates(platform_id, version, title, description, release_time, is_featured, update_type, status, published_at, synced_from_maiupdate)
select p.id, '1.0.0', 'Updates Hub Launched',
  'The central PRODUCT UPDATES page is now live. Every MAI Corp project publishes a MAIUPDATE.json file on git push, and this page displays the latest changes across the entire ecosystem.',
  now(), true, 'announcement', 'PUBLISHED', now(), true
from (select id from public.platforms where slug = 'maicorp') p
on conflict (platform_id, version, title) do nothing;

-- ---------------------------------------------------------------------
-- Helper: count published app updates (used by CEO dashboard stats)
-- ---------------------------------------------------------------------
create or replace function public.app_updates_count()
  returns bigint
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select count(*) from public.app_updates
    where status = 'PUBLISHED' and (published_at is null or published_at <= now());
  $$;

-- ---------------------------------------------------------------------
-- Helper: upsert an app update (called by the sync edge function)
-- ---------------------------------------------------------------------
create or replace function public.upsert_app_update(
  p_platform_slug text,
  p_version text,
  p_title text,
  p_description text default null,
  p_release_notes text default null,
  p_release_time timestamptz default now(),
  p_download_url text default null,
  p_icon_url text default null,
  p_update_type text default 'feature',
  p_is_featured boolean default false,
  p_status text default 'PUBLISHED'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_platform uuid; v_id uuid;
begin
  select id into v_platform from public.platforms where slug = p_platform_slug;
  if v_platform is null then
    insert into public.platforms(slug, name, description, maiupdate_url)
      values (p_platform_slug, initcap(p_platform_slug), null, null)
      returning id into v_platform;
  end if;

  insert into public.app_updates(
    platform_id, version, title, description, release_notes, release_time,
    download_url, icon_url, update_type, is_featured, status, published_at,
    synced_from_maiupdate, created_at, updated_at
  ) values (
    v_platform, p_version, p_title, p_description, p_release_notes, p_release_time,
    p_download_url, p_icon_url, p_update_type, p_is_featured, p_status,
    case when p_status = 'PUBLISHED' then now() else null end,
    true, now(), now()
  )
  on conflict (platform_id, version, title) do update set
    description = excluded.description,
    release_notes = excluded.release_notes,
    release_time = excluded.release_time,
    download_url = excluded.download_url,
    icon_url = excluded.icon_url,
    update_type = excluded.update_type,
    is_featured = excluded.is_featured,
    status = excluded.status,
    published_at = excluded.published_at,
    synced_from_maiupdate = true,
    updated_at = now()
  returning id into v_id;

  update public.platforms set last_sync_at = now() where id = v_platform;
  return v_id;
end;
$$;
