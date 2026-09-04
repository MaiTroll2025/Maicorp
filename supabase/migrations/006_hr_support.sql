-- 006 HR docs / requests / notes / notifications / audit
create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  storage_path text not null,
  kind text not null default 'GENERAL',
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.employee_documents enable row level security;
drop policy if exists employee_documents_hr on public.employee_documents;
create policy employee_documents_hr on public.employee_documents for all using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));
drop policy if exists employee_documents_self on public.employee_documents;
create policy employee_documents_self on public.employee_documents for select
  using (employee_id in (select id from public.employees where user_id = auth.uid()));

create table if not exists public.hr_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  kind text not null,
  subject text,
  body text,
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','WAITING_FOR_EMPLOYEE','RESOLVED','CLOSED')),
  created_at timestamptz not null default now()
);
alter table public.hr_requests enable row level security;
drop policy if exists hr_requests_self on public.hr_requests;
create policy hr_requests_self on public.hr_requests for all
  using (employee_id in (select id from public.employees where user_id = auth.uid()))
  with check (employee_id in (select id from public.employees where user_id = auth.uid()));
drop policy if exists hr_requests_hr on public.hr_requests;
create policy hr_requests_hr on public.hr_requests for all using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));

create table if not exists public.hr_notes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.hr_notes enable row level security;
drop policy if exists hr_notes_hr on public.hr_notes;
create policy hr_notes_hr on public.hr_notes for all using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
drop policy if exists notifications_self on public.notifications;
create policy notifications_self on public.notifications for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  target text,
  result text,
  reason text,
  metadata jsonb,
  ip text,
  user_agent text,
  request_id text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action);

alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_ceo on public.audit_logs;
create policy audit_logs_ceo on public.audit_logs for all
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));