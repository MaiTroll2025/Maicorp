-- 007 Bug Catcher / Blocker / Schema registry
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  severity text not null default 'MEDIUM' check (severity in ('CRITICAL','HIGH','MEDIUM','LOW','INFO')),
  status text not null default 'NEW' check (status in ('NEW','INVESTIGATING','AUTO_REPAIRING','FIXED','VERIFIED','WONT_FIX','DUPLICATE','BLOCKED','DELETED')),
  title text,
  summary text,
  error_type text,
  error_message text,
  stack_trace text,
  route text,
  component text,
  function_name text,
  database_error_code text,
  metadata jsonb,
  environment text,
  app_version text,
  build_version text,
  migration_version text,
  fingerprint text,
  occurrence_count int not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  resolution text,
  user_id uuid references public.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists bug_reports_fingerprint_uq on public.bug_reports (fingerprint);
alter table public.bug_reports enable row level security;
drop policy if exists bug_reports_ceo on public.bug_reports;
create policy bug_reports_ceo on public.bug_reports for all
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));
drop policy if exists bug_reports_insert_anon on public.bug_reports;
create policy bug_reports_insert_anon on public.bug_reports for insert with check (true);

create table if not exists public.bug_diagnoses (
  id uuid primary key default gen_random_uuid(),
  bug_id uuid not null references public.bug_reports(id) on delete cascade,
  diagnosis text,
  confidence numeric,
  affected_system text,
  recommended_action text,
  created_at timestamptz not null default now()
);
alter table public.bug_diagnoses enable row level security;
drop policy if exists bug_diagnoses_ceo on public.bug_diagnoses;
create policy bug_diagnoses_ceo on public.bug_diagnoses for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

create table if not exists public.universal_blocker_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  target text,
  reason text,
  code text,
  actor_id uuid references public.users(id) on delete set null,
  actor_email text,
  actor_role text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
alter table public.universal_blocker_events enable row level security;
drop policy if exists blocker_events_ceo on public.universal_blocker_events;
create policy blocker_events_ceo on public.universal_blocker_events for all
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));
drop policy if exists blocker_events_insert on public.universal_blocker_events;
create policy blocker_events_insert on public.universal_blocker_events for insert with check (true);

create table if not exists public.schema_migrations (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  checksum text not null,
  version text not null,
  status text not null default 'APPLIED' check (status in ('APPLIED','FAILED','REPAIRED')),
  applied_at timestamptz not null default now(),
  error text,
  repair_attempts int not null default 0
);
alter table public.schema_migrations enable row level security;
drop policy if exists schema_migrations_ceo on public.schema_migrations;
create policy schema_migrations_ceo on public.schema_migrations for all
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));