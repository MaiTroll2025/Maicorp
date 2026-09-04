-- 009 Platforms / secrets / diagnostics
create table if not exists public.platforms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  enabled boolean not null default true,
  monitoring_enabled boolean not null default true,
  analytics_enabled boolean not null default true,
  analytics_config jsonb not null default '{}',
  last_check_at timestamptz,
  last_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.platforms enable row level security;
drop policy if exists platforms_public_read on public.platforms;
create policy platforms_public_read on public.platforms for select using (enabled = true);
drop policy if exists platforms_ceo on public.platforms;
create policy platforms_ceo on public.platforms for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

create table if not exists public.secrets (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete cascade,
  kind text not null,
  label text not null,
  configured boolean not null default false,
  last_tested_at timestamptz,
  last_test_status text,
  rotated_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.secrets enable row level security;
drop policy if exists secrets_ceo on public.secrets;
create policy secrets_ceo on public.secrets for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

create table if not exists public.diagnostic_runs (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid references public.platforms(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result text
);
alter table public.diagnostic_runs enable row level security;
drop policy if exists diagnostic_runs_ceo on public.diagnostic_runs;
create policy diagnostic_runs_ceo on public.diagnostic_runs for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

create table if not exists public.diagnostic_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.diagnostic_runs(id) on delete cascade,
  check_name text not null,
  target text,
  status text not null,
  severity text not null,
  message text,
  remediation text,
  technical_details jsonb
);
alter table public.diagnostic_results enable row level security;
drop policy if exists diagnostic_results_ceo on public.diagnostic_results;
create policy diagnostic_results_ceo on public.diagnostic_results for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));