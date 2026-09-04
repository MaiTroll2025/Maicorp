-- 003 Time / schedules / timesheets
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  break_minutes int not null default 0,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED','CORRECTED')),
  source text default 'web',
  notes text
);
create index if not exists time_entries_emp_idx on public.time_entries (employee_id, clock_in_at desc);

alter table public.time_entries enable row level security;
drop policy if exists time_entries_self on public.time_entries;
create policy time_entries_self on public.time_entries for all
  using (employee_id in (select id from public.employees where user_id = auth.uid()))
  with check (employee_id in (select id from public.employees where user_id = auth.uid()));
drop policy if exists time_entries_hr on public.time_entries;
create policy time_entries_hr on public.time_entries for all
  using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));

create table if not exists public.break_entries (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  kind text not null default 'BREAK'
);
alter table public.break_entries enable row level security;
drop policy if exists break_entries_self on public.break_entries;
create policy break_entries_self on public.break_entries for all
  using (time_entry_id in (select id from public.time_entries where employee_id in (select id from public.employees where user_id = auth.uid())))
  with check (time_entry_id in (select id from public.time_entries where employee_id in (select id from public.employees where user_id = auth.uid())));
drop policy if exists break_entries_hr on public.break_entries;
create policy break_entries_hr on public.break_entries for all
  using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));

create table if not exists public.time_entry_corrections (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  correction jsonb not null,
  reason text,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  created_at timestamptz not null default now()
);
alter table public.time_entry_corrections enable row level security;
drop policy if exists time_entry_corrections_self on public.time_entry_corrections;
create policy time_entry_corrections_self on public.time_entry_corrections for insert
  with check (requested_by = auth.uid());
drop policy if exists time_entry_corrections_hr on public.time_entry_corrections;
create policy time_entry_corrections_hr on public.time_entry_corrections for all
  using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','APPROVED','REJECTED','LOCKED')),
  submitted_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.timesheets enable row level security;
drop policy if exists timesheets_self on public.timesheets;
create policy timesheets_self on public.timesheets for select
  using (employee_id in (select id from public.employees where user_id = auth.uid()));
drop policy if exists timesheets_self_write on public.timesheets;
create policy timesheets_self_write on public.timesheets for update
  using (employee_id in (select id from public.employees where user_id = auth.uid()) and status in ('DRAFT','REJECTED'))
  with check (employee_id in (select id from public.employees where user_id = auth.uid()) and status in ('DRAFT','SUBMITTED','REJECTED'));
drop policy if exists timesheets_hr on public.timesheets;
create policy timesheets_hr on public.timesheets for all
  using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));

create table if not exists public.timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid not null references public.timesheets(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  regular_minutes int not null default 0,
  overtime_minutes int not null default 0,
  pto_minutes int not null default 0
);
alter table public.timesheet_entries enable row level security;
drop policy if exists timesheet_entries_self on public.timesheet_entries;
create policy timesheet_entries_self on public.timesheet_entries for select
  using (timesheet_id in (select id from public.timesheets where employee_id in (select id from public.employees where user_id = auth.uid())));
drop policy if exists timesheet_entries_hr on public.timesheet_entries;
create policy timesheet_entries_hr on public.timesheet_entries for all
  using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  break_minutes int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.schedules enable row level security;
drop policy if exists schedules_self on public.schedules;
create policy schedules_self on public.schedules for select
  using (employee_id in (select id from public.employees where user_id = auth.uid()));
drop policy if exists schedules_hr on public.schedules;
create policy schedules_hr on public.schedules for all
  using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));