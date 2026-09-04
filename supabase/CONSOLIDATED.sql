-- =====================================================================
-- MAI CORP - Consolidated bootstrap migration (part 1: helpers + identity)
-- Version: 2026.09.03.001
--
-- Note: the public.users table is created BEFORE the helper functions
-- so SECURITY DEFINER lookups can be validated at creation time.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- identity (created first so helpers can resolve it)
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'CUSTOMER' check (role in ('CEO','HR_MANAGER','EMPLOYEE','CUSTOMER')),
  employment_status text not null default 'ACTIVE' check (employment_status in ('ACTIVE','ON_LEAVE','SUSPENDED','TERMINATED','INACTIVE')),
  account_status text not null default 'ACTIVE' check (account_status in ('ACTIVE','DISABLED','PENDING','TERMINATED')),
  access_version int not null default 1,
  employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.users enable row level security;

-- ---------------------------------------------------------------------
-- helpers (depend on public.users existing)
-- ---------------------------------------------------------------------
create or replace function public.is_ceo(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users
    where id = uid and role = 'CEO' and account_status = 'ACTIVE'
  );
$$;

create or replace function public.is_hr(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users
    where id = uid and role in ('CEO','HR_MANAGER') and account_status = 'ACTIVE'
  );
$$;

create or replace function public.is_employee_active(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users
    where id = uid and account_status = 'ACTIVE' and employment_status = 'ACTIVE'
  );
$$;

create or replace function public.public_ceo_signup_allowed()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (select 1 from public.users where role = 'CEO' and account_status = 'ACTIVE');
$$;

drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users for select
  using (id = auth.uid() or public.is_ceo(auth.uid()));

drop policy if exists users_ceo_write on public.users;
create policy users_ceo_write on public.users for all
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));
-- 002 HR core (departments, positions, employees, employment history)
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department_id uuid references public.departments(id) on delete set null,
  description text,
  employment_type text not null default 'FULL_TIME',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users(id) on delete set null,
  employee_number text unique,
  first_name text not null,
  last_name text not null,
  preferred_name text,
  email text not null,
  phone text,
  address text,
  emergency_contact text,
  department_id uuid references public.departments(id) on delete set null,
  position_id uuid references public.positions(id) on delete set null,
  manager_id uuid references public.employees(id) on delete set null,
  employment_type text not null default 'FULL_TIME',
  start_date date,
  employment_status text not null default 'PENDING' check (employment_status in ('PENDING','ACTIVE','ON_LEAVE','SUSPENDED','TERMINATED','INACTIVE')),
  account_status text not null default 'PENDING' check (account_status in ('ACTIVE','DISABLED','PENDING','TERMINATED')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists employees_status_idx on public.employees (employment_status);
create index if not exists employees_dept_idx on public.employees (department_id);

alter table public.employees enable row level security;
drop policy if exists employees_self_read on public.employees;
create policy employees_self_read on public.employees for select
  using (user_id = auth.uid() or public.is_hr(auth.uid()));
drop policy if exists employees_hr_write on public.employees;
create policy employees_hr_write on public.employees for all
  using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));

create table if not exists public.employment_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  position_id uuid references public.positions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  manager_id uuid references public.employees(id) on delete set null,
  effective_from date not null default current_date,
  effective_to date,
  change_type text not null,
  reason text,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.employment_records enable row level security;
drop policy if exists employment_records_hr_all on public.employment_records;
create policy employment_records_hr_all on public.employment_records for all
  using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));
drop policy if exists employment_records_self_read on public.employment_records;
create policy employment_records_self_read on public.employment_records for select
  using (exists (select 1 from public.employees e where e.id = employment_records.employee_id and e.user_id = auth.uid()));

create table if not exists public.employee_status_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  status text not null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  changed_by uuid references public.users(id) on delete set null,
  reason text
);
alter table public.employee_status_history enable row level security;
drop policy if exists employee_status_history_hr_all on public.employee_status_history;
create policy employee_status_history_hr_all on public.employee_status_history for all
  using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));

alter table public.departments enable row level security;
drop policy if exists departments_read_all on public.departments;
create policy departments_read_all on public.departments for select using (true);
drop policy if exists departments_hr_write on public.departments;
create policy departments_hr_write on public.departments for all
  using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));

alter table public.positions enable row level security;
drop policy if exists positions_read_all on public.positions;
create policy positions_read_all on public.positions for select using (true);
drop policy if exists positions_hr_write on public.positions;
create policy positions_hr_write on public.positions for all
  using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));
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
-- 004 PTO
create table if not exists public.pto_policies (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  annual_hours int not null default 0,
  accrual text not null default 'MONTHLY',
  created_at timestamptz not null default now()
);
create table if not exists public.pto_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  policy_id uuid references public.pto_policies(id) on delete set null,
  balance_hours numeric not null default 0
);
create table if not exists public.pto_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  policy_id uuid references public.pto_policies(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  hours numeric not null default 0,
  reason text,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.pto_policies enable row level security;
drop policy if exists pto_policies_read on public.pto_policies;
create policy pto_policies_read on public.pto_policies for select using (true);
drop policy if exists pto_policies_hr on public.pto_policies;
create policy pto_policies_hr on public.pto_policies for all using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));
alter table public.pto_balances enable row level security;
drop policy if exists pto_balances_self on public.pto_balances;
create policy pto_balances_self on public.pto_balances for select
  using (employee_id in (select id from public.employees where user_id = auth.uid()));
drop policy if exists pto_balances_hr on public.pto_balances;
create policy pto_balances_hr on public.pto_balances for all using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));
alter table public.pto_requests enable row level security;
drop policy if exists pto_requests_self on public.pto_requests;
create policy pto_requests_self on public.pto_requests for all
  using (employee_id in (select id from public.employees where user_id = auth.uid()))
  with check (employee_id in (select id from public.employees where user_id = auth.uid()));
drop policy if exists pto_requests_hr on public.pto_requests;
create policy pto_requests_hr on public.pto_requests for all
  using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));
-- 005 Payroll
create table if not exists public.pay_rates (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  pay_type text not null check (pay_type in ('HOURLY','SALARY','CONTRACTOR')),
  rate numeric not null default 0,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now()
);
alter table public.pay_rates enable row level security;
drop policy if exists pay_rates_hr on public.pay_rates;
create policy pay_rates_hr on public.pay_rates for all using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));
drop policy if exists pay_rates_self_read on public.pay_rates;
create policy pay_rates_self_read on public.pay_rates for select
  using (employee_id in (select id from public.employees where user_id = auth.uid()));

create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  starts_at date not null,
  ends_at date not null,
  status text not null default 'OPEN' check (status in ('OPEN','TIMESHEET_REVIEW','APPROVED','PROCESSING','PROCESSED','LOCKED')),
  created_at timestamptz not null default now()
);
alter table public.payroll_periods enable row level security;
drop policy if exists payroll_periods_hr on public.payroll_periods;
create policy payroll_periods_hr on public.payroll_periods for all using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));
drop policy if exists payroll_periods_self_read on public.payroll_periods;
create policy payroll_periods_self_read on public.payroll_periods for select using (true);

create table if not exists public.payroll_records (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.payroll_periods(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  gross numeric not null default 0,
  net numeric not null default 0,
  regular_minutes int not null default 0,
  overtime_minutes int not null default 0,
  other_earnings numeric not null default 0,
  deductions_total numeric not null default 0,
  status text not null default 'CALCULATED' check (status in ('CALCULATED','APPROVED','PAID','LOCKED','REVERSED')),
  created_at timestamptz not null default now()
);
alter table public.payroll_records enable row level security;
drop policy if exists payroll_records_hr on public.payroll_records;
create policy payroll_records_hr on public.payroll_records for all using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));
drop policy if exists payroll_records_self_read on public.payroll_records;
create policy payroll_records_self_read on public.payroll_records for select
  using (employee_id in (select id from public.employees where user_id = auth.uid()) and status in ('APPROVED','PAID','LOCKED'));

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.payroll_records(id) on delete cascade,
  kind text not null,
  description text,
  amount numeric not null default 0
);
alter table public.payroll_items enable row level security;
drop policy if exists payroll_items_hr on public.payroll_items;
create policy payroll_items_hr on public.payroll_items for all using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));

create table if not exists public.payroll_deductions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.payroll_records(id) on delete cascade,
  kind text not null,
  description text,
  amount numeric not null default 0
);
alter table public.payroll_deductions enable row level security;
drop policy if exists payroll_deductions_hr on public.payroll_deductions;
create policy payroll_deductions_hr on public.payroll_deductions for all using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));

create table if not exists public.pay_stubs (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.payroll_records(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  snapshot jsonb not null,
  generated_at timestamptz not null default now()
);
alter table public.pay_stubs enable row level security;
drop policy if exists pay_stubs_self on public.pay_stubs;
create policy pay_stubs_self on public.pay_stubs for select
  using (employee_id in (select id from public.employees where user_id = auth.uid()));
drop policy if exists pay_stubs_hr on public.pay_stubs;
create policy pay_stubs_hr on public.pay_stubs for all using (public.is_hr(auth.uid())) with check (public.is_hr(auth.uid()));
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
-- 008 Public marketing schema
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  tagline text,
  description text,
  logo_url text,
  hero_url text,
  website text,
  play_url text,
  store_url text,
  status text not null default 'COMING_SOON' check (status in ('LIVE','COMING_SOON','IN_DEVELOPMENT','PAUSED','RETIRED')),
  featured boolean not null default false,
  sort_order int not null default 100,
  category text,
  launch_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.companies enable row level security;
drop policy if exists companies_public_read on public.companies;
create policy companies_public_read on public.companies for select using (true);
drop policy if exists companies_ceo_write on public.companies;
create policy companies_ceo_write on public.companies for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null,
  description text,
  price_cents int not null default 0,
  currency text not null default 'USD',
  features jsonb not null default '[]',
  image_url text,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','DRAFT','RETIRED')),
  featured boolean not null default false,
  sort_order int not null default 100,
  estimated_delivery text,
  management_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (status = 'AVAILABLE');
drop policy if exists products_ceo_write on public.products;
create policy products_ceo_write on public.products for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  amount_cents int not null,
  currency text not null default 'USD',
  status text not null default 'DRAFT' check (status in ('DRAFT','PENDING_PAYMENT','PAID','IN_PROGRESS','WAITING_FOR_CUSTOMER','DEVELOPMENT','REVIEW','DEPLOYMENT','COMPLETED','CANCELLED','REFUNDED')),
  paypal_order_id text,
  paypal_capture_id text,
  infrastructure_acknowledged_at timestamptz,
  management_plan text check (management_plan in ('NONE','ESSENTIAL','BUSINESS','PREMIUM')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);
alter table public.orders enable row level security;
drop policy if exists orders_self_read on public.orders;
create policy orders_self_read on public.orders for select using (customer_id = auth.uid());
drop policy if exists orders_self_create on public.orders;
create policy orders_self_create on public.orders for insert with check (customer_id = auth.uid());
drop policy if exists orders_ceo_all on public.orders;
create policy orders_ceo_all on public.orders for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

create table if not exists public.project_intakes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payload jsonb not null,
  submitted_at timestamptz not null default now()
);
alter table public.project_intakes enable row level security;
drop policy if exists intakes_self on public.project_intakes;
create policy intakes_self on public.project_intakes for select
  using (order_id in (select id from public.orders where customer_id = auth.uid()));
drop policy if exists intakes_self_write on public.project_intakes;
create policy intakes_self_write on public.project_intakes for insert
  with check (order_id in (select id from public.orders where customer_id = auth.uid()));
drop policy if exists intakes_ceo on public.project_intakes;
create policy intakes_ceo on public.project_intakes for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

create table if not exists public.order_timeline (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.order_timeline enable row level security;
drop policy if exists timeline_self_read on public.order_timeline;
create policy timeline_self_read on public.order_timeline for select
  using (order_id in (select id from public.orders where customer_id = auth.uid()));
drop policy if exists timeline_ceo on public.order_timeline;
create policy timeline_ceo on public.order_timeline for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

create table if not exists public.customer_infrastructure (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique not null references public.orders(id) on delete cascade,
  domain text,
  hosting text,
  database_info text,
  email text,
  storage text,
  other text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_infrastructure enable row level security;
drop policy if exists infra_ceo on public.customer_infrastructure;
create policy infra_ceo on public.customer_infrastructure for all
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));
drop policy if exists infra_self_metadata on public.customer_infrastructure;
create policy infra_self_metadata on public.customer_infrastructure for select
  using (order_id in (select id from public.orders where customer_id = auth.uid()));

create table if not exists public.page_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);
alter table public.page_content enable row level security;
drop policy if exists page_content_read on public.page_content;
create policy page_content_read on public.page_content for select using (true);
drop policy if exists page_content_ceo_write on public.page_content;
create policy page_content_ceo_write on public.page_content for all
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  image_url text,
  company_id uuid references public.companies(id) on delete set null,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  publish_at timestamptz,
  expire_at timestamptz,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists announcements_public_read on public.announcements;
create policy announcements_public_read on public.announcements for select using (status = 'PUBLISHED' and (publish_at is null or publish_at <= now()) and (expire_at is null or expire_at > now()));
drop policy if exists announcements_ceo on public.announcements;
create policy announcements_ceo on public.announcements for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  subject text,
  body text,
  category text not null default 'GENERAL',
  ip text,
  created_at timestamptz not null default now()
);
alter table public.contact_submissions enable row level security;
drop policy if exists contact_insert on public.contact_submissions;
create policy contact_insert on public.contact_submissions for insert with check (true);
drop policy if exists contact_ceo on public.contact_submissions;
create policy contact_ceo on public.contact_submissions for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

create table if not exists public.support_donations (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  amount_cents int not null default 0,
  currency text not null default 'USD',
  message text,
  paypal_order_id text,
  status text not null default 'PENDING' check (status in ('PENDING','COMPLETED','FAILED','REFUNDED')),
  created_at timestamptz not null default now()
);
alter table public.support_donations enable row level security;
drop policy if exists donations_insert on public.support_donations;
create policy donations_insert on public.support_donations for insert with check (true);
drop policy if exists donations_ceo on public.support_donations;
create policy donations_ceo on public.support_donations for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));
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
  maiupdate_url text,
  last_sync_at timestamptz,
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
-- 010 RPCs (hiring, terminating, status changes, audit)
create or replace function public.audit_log(p_action text, p_target text, p_result text, p_reason text default null, p_metadata jsonb default null)
  returns void
  language sql
  security definer
  set search_path = public
  as $$
    insert into public.audit_logs(actor_id, action, target, result, reason, metadata)
    values (auth.uid(), p_action, p_target, p_result, p_reason, p_metadata);
  $$;

create or replace function public.bump_access_version(p_user_id uuid)
  returns void
  language sql
  security definer
  set search_path = public
  as $$
    update public.users set access_version = access_version + 1, updated_at = now() where id = p_user_id;
  $$;

create or replace function public.revoke_user_sessions(p_user_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
    begin
      -- Best effort: refresh_tokens rotated by bumping access_version;
      -- Supabase sessions are also invalidated by clearing metadata.
      update auth.users
        set banned_until = now() + interval '100 years',
            updated_at = now()
        where id = p_user_id and (banned_until is null or banned_until < now());
    exception when others then
      -- never break revocation flow
      null;
    end;
  $$;

create or replace function public.hire_employee(
  p_employee_id uuid,
  p_position_id uuid,
  p_department_id uuid,
  p_manager_id uuid,
  p_start_date date
)
  returns void
  language plpgsql
  security definer
  set search_path = public
  as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  update public.employees set
    position_id = p_position_id,
    department_id = p_department_id,
    manager_id = p_manager_id,
    start_date = coalesce(p_start_date, current_date),
    employment_status = 'ACTIVE',
    account_status = 'ACTIVE',
    updated_at = now()
  where id = p_employee_id;
  insert into public.employment_records(employee_id, position_id, department_id, manager_id, effective_from, change_type, changed_by)
    values (p_employee_id, p_position_id, p_department_id, p_manager_id, coalesce(p_start_date, current_date), 'HIRE', v_uid);
  insert into public.employee_status_history(employee_id, status, changed_by, reason) values (p_employee_id, 'ACTIVE', v_uid, 'Hired');
  perform public.audit_log('EMPLOYEE_HIRED', p_employee_id::text, 'OK');
end;
$$;

create or replace function public.terminate_employee(p_employee_id uuid, p_reason text)
  returns void
  language plpgsql
  security definer
  set search_path = public, auth
  as $$
declare
  v_uid uuid := auth.uid();
  v_user_id uuid;
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select user_id into v_user_id from public.employees where id = p_employee_id;
  if v_user_id is null then raise exception 'Employee not linked to user'; end if;

  update public.employees set employment_status = 'TERMINATED', account_status = 'TERMINATED', updated_at = now() where id = p_employee_id;
  update public.users set employment_status = 'TERMINATED', account_status = 'TERMINATED', access_version = access_version + 1, updated_at = now() where id = v_user_id;
  insert into public.employee_status_history(employee_id, status, changed_by, reason) values (p_employee_id, 'TERMINATED', v_uid, p_reason);

  -- best-effort session invalidation
  perform public.revoke_user_sessions(v_user_id);

  perform public.audit_log('EMPLOYEE_TERMINATED', p_employee_id::text, 'OK', p_reason);
end;
$$;

create or replace function public.suspend_employee(p_employee_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid(); v_user_id uuid;
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select user_id into v_user_id from public.employees where id = p_employee_id;
  if v_user_id is null then raise exception 'Employee not linked to user'; end if;
  update public.employees set employment_status = 'SUSPENDED', account_status = 'DISABLED', updated_at = now() where id = p_employee_id;
  update public.users set employment_status = 'SUSPENDED', account_status = 'DISABLED', access_version = access_version + 1, updated_at = now() where id = v_user_id;
  insert into public.employee_status_history(employee_id, status, changed_by, reason) values (p_employee_id, 'SUSPENDED', v_uid, p_reason);
  perform public.revoke_user_sessions(v_user_id);
  perform public.audit_log('EMPLOYEE_SUSPENDED', p_employee_id::text, 'OK', p_reason);
end;
$$;

create or replace function public.reactivate_employee(p_employee_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_user_id uuid;
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select user_id into v_user_id from public.employees where id = p_employee_id;
  if v_user_id is null then raise exception 'Employee not linked to user'; end if;
  update public.employees set employment_status = 'ACTIVE', account_status = 'ACTIVE', updated_at = now() where id = p_employee_id;
  update public.users set employment_status = 'ACTIVE', account_status = 'ACTIVE', access_version = access_version + 1, updated_at = now() where id = v_user_id;
  insert into public.employee_status_history(employee_id, status, changed_by, reason) values (p_employee_id, 'ACTIVE', v_uid, p_reason);
  perform public.audit_log('EMPLOYEE_REACTIVATED', p_employee_id::text, 'OK', p_reason);
end;
$$;

create or replace function public.promote_employee(p_employee_id uuid, p_position_id uuid, p_department_id uuid, p_manager_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  -- Preserve previous employment record
  insert into public.employment_records(employee_id, position_id, department_id, manager_id, effective_from, change_type, changed_by, reason)
    select employee_id, position_id, department_id, manager_id, current_date, 'PROMOTION', v_uid, p_reason
    from public.employees where id = p_employee_id;
  update public.employees set
    position_id = coalesce(p_position_id, position_id),
    department_id = coalesce(p_department_id, department_id),
    manager_id = coalesce(p_manager_id, manager_id),
    updated_at = now()
  where id = p_employee_id;
  perform public.audit_log('EMPLOYEE_PROMOTED', p_employee_id::text, 'OK', p_reason);
end;
$$;

create or replace function public.transfer_employee(p_employee_id uuid, p_department_id uuid, p_manager_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  insert into public.employment_records(employee_id, position_id, department_id, manager_id, effective_from, change_type, changed_by, reason)
    select employee_id, position_id, department_id, manager_id, current_date, 'TRANSFER', v_uid, p_reason
    from public.employees where id = p_employee_id;
  update public.employees set
    department_id = coalesce(p_department_id, department_id),
    manager_id = coalesce(p_manager_id, manager_id),
    updated_at = now()
  where id = p_employee_id;
  perform public.audit_log('EMPLOYEE_TRANSFERRED', p_employee_id::text, 'OK', p_reason);
end;
$$;

create or replace function public.place_on_leave(p_employee_id uuid, p_expected_return date, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_user_id uuid;
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select user_id into v_user_id from public.employees where id = p_employee_id;
  update public.employees set employment_status = 'ON_LEAVE', updated_at = now() where id = p_employee_id;
  if v_user_id is not null then
    update public.users set employment_status = 'ON_LEAVE', updated_at = now() where id = v_user_id;
  end if;
  insert into public.employee_status_history(employee_id, status, changed_by, reason) values (p_employee_id, 'ON_LEAVE', v_uid, coalesce(p_reason,'') || case when p_expected_return is not null then ' [expected return ' || p_expected_return::text || ']' else '' end);
  perform public.audit_log('EMPLOYEE_ON_LEAVE', p_employee_id::text, 'OK', p_reason);
end;
$$;

create or replace function public.return_from_leave(p_employee_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_user_id uuid;
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select user_id into v_user_id from public.employees where id = p_employee_id;
  update public.employees set employment_status = 'ACTIVE', updated_at = now() where id = p_employee_id;
  if v_user_id is not null then
    update public.users set employment_status = 'ACTIVE', updated_at = now() where id = v_user_id;
  end if;
  insert into public.employee_status_history(employee_id, status, changed_by, reason) values (p_employee_id, 'ACTIVE', v_uid, 'Returned from leave');
  perform public.audit_log('EMPLOYEE_RETURNED', p_employee_id::text, 'OK', p_reason);
end;
$$;
-- 011 RPCs (time clock, breaks, timesheets)
create or replace function public.clock_in(p_employee_id uuid)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
  as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_id uuid;
begin
  select user_id into v_owner from public.employees where id = p_employee_id;
  if v_owner is null then raise exception 'Employee not found'; end if;
  if v_owner <> v_uid and not public.is_hr(v_uid) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if exists (select 1 from public.time_entries where employee_id = p_employee_id and status = 'OPEN') then
    raise exception 'Already clocked in';
  end if;

  insert into public.time_entries(employee_id, clock_in_at, status, source)
  values (p_employee_id, now(), 'OPEN', 'web')
  returning id into v_id;

  perform public.audit_log('CLOCK_IN', p_employee_id::text, 'OK');
  return v_id;
end;
$$;

create or replace function public.clock_out(p_employee_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
  as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  select user_id into v_owner from public.employees where id = p_employee_id;
  if v_owner is null then raise exception 'Employee not found'; end if;
  if v_owner <> v_uid and not public.is_hr(v_uid) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  update public.time_entries
    set clock_out_at = now(),
        status = 'CLOSED'
  where employee_id = p_employee_id and status = 'OPEN';
  if not found then raise exception 'No open clock-in'; end if;

  perform public.audit_log('CLOCK_OUT', p_employee_id::text, 'OK');
end;
$$;

create or replace function public.start_break(p_employee_id uuid)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
  as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_time_entry uuid; v_break uuid;
begin
  select user_id into v_owner from public.employees where id = p_employee_id;
  if v_owner is null then raise exception 'Employee not found'; end if;
  if v_owner <> v_uid and not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;

  select id into v_time_entry from public.time_entries where employee_id = p_employee_id and status = 'OPEN' order by clock_in_at desc limit 1;
  if v_time_entry is null then raise exception 'No open clock-in'; end if;
  if exists (select 1 from public.break_entries where time_entry_id = v_time_entry and ended_at is null) then
    raise exception 'Break already active';
  end if;
  insert into public.break_entries(time_entry_id) values (v_time_entry) returning id into v_break;
  perform public.audit_log('BREAK_START', p_employee_id::text, 'OK');
  return v_break;
end;
$$;

create or replace function public.end_break(p_employee_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
  as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_time_entry uuid; v_break record;
begin
  select user_id into v_owner from public.employees where id = p_employee_id;
  if v_owner is null then raise exception 'Employee not found'; end if;
  if v_owner <> v_uid and not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;

  select te.id into v_time_entry from public.time_entries te where te.employee_id = p_employee_id and te.status = 'OPEN' order by te.clock_in_at desc limit 1;
  if v_time_entry is null then raise exception 'No open clock-in'; end if;

  select * into v_break from public.break_entries where time_entry_id = v_time_entry and ended_at is null order by started_at desc limit 1;
  if v_break.id is null then raise exception 'No active break'; end if;

  update public.break_entries set ended_at = now() where id = v_break.id;
  update public.time_entries
    set break_minutes = break_minutes + extract(epoch from (now() - v_break.started_at))/60.0
  where id = v_time_entry;

  perform public.audit_log('BREAK_END', p_employee_id::text, 'OK');
end;
$$;

create or replace function public.approve_timesheet(p_timesheet_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_emp uuid;
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select employee_id into v_emp from public.timesheets where id = p_timesheet_id;
  update public.timesheets set status = 'APPROVED', approved_by = v_uid, approved_at = now() where id = p_timesheet_id and status in ('SUBMITTED','REJECTED');
  perform public.audit_log('TIMESHEET_APPROVED', p_timesheet_id::text, 'OK');
end;
$$;

create or replace function public.reject_timesheet(p_timesheet_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  update public.timesheets set status = 'REJECTED', approved_by = v_uid, approved_at = now(), notes = coalesce(notes,'') || ' | rejected: ' || coalesce(p_reason,'') where id = p_timesheet_id;
  perform public.audit_log('TIMESHEET_REJECTED', p_timesheet_id::text, 'OK', p_reason);
end;
$$;

create or replace function public.submit_timesheet(p_timesheet_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_emp uuid; v_owner uuid;
begin
  select employee_id into v_emp from public.timesheets where id = p_timesheet_id;
  select user_id into v_owner from public.employees where id = v_emp;
  if v_owner <> v_uid then raise exception 'Forbidden' using errcode = '42501'; end if;
  update public.timesheets set status = 'SUBMITTED', submitted_at = now() where id = p_timesheet_id and status in ('DRAFT','REJECTED');
  perform public.audit_log('TIMESHEET_SUBMITTED', p_timesheet_id::text, 'OK');
end;
$$;
-- 012 RPCs (Payroll)
create or replace function public.calculate_payroll(p_period_id uuid)
  returns int
  language plpgsql
  security definer
  set search_path = public
  as $$
declare
  v_uid uuid := auth.uid();
  v_period record;
  v_count int := 0;
  v_emp record;
  v_rate numeric;
  v_total_minutes int;
  v_overtime_minutes int;
  v_gross numeric;
  v_net numeric;
  v_rec record;
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into v_period from public.payroll_periods where id = p_period_id;
  if v_period.id is null then raise exception 'Payroll period not found'; end if;
  if v_period.status not in ('OPEN','TIMESHEET_REVIEW') then
    raise exception 'Payroll period not open for calculation';
  end if;

  for v_emp in
    select e.id as employee_id
      from public.employees e
      where e.employment_status = 'ACTIVE'
  loop
    select coalesce(sum(extract(epoch from (coalesce(te.clock_out_at, now()) - te.clock_in_at)) / 60.0), 0)
      into v_total_minutes
      from public.time_entries te
      where te.employee_id = v_emp.employee_id
        and te.status in ('CLOSED','CORRECTED')
        and te.clock_in_at >= v_period.starts_at
        and te.clock_in_at < v_period.ends_at + interval '1 day';

    v_total_minutes := v_total_minutes - coalesce((select sum(break_minutes) from public.time_entries where employee_id = v_emp.employee_id and clock_in_at >= v_period.starts_at and clock_in_at < v_period.ends_at + interval '1 day'), 0);
    v_total_minutes := greatest(v_total_minutes, 0);

    -- overtime beyond 40h/week standard (configurable, here per period)
    if v_total_minutes > 2400 then
      v_overtime_minutes := v_total_minutes - 2400;
      v_total_minutes := 2400;
    else
      v_overtime_minutes := 0;
    end if;

    select rate into v_rate from public.pay_rates where employee_id = v_emp.employee_id and effective_from <= v_period.ends_at order by effective_from desc limit 1;
    if v_rate is null then v_rate := 0; end if;

    v_gross := round((v_total_minutes / 60.0) * v_rate + (v_overtime_minutes / 60.0) * v_rate * 1.5, 2);
    -- placeholder deductions; configurable later
    v_net := v_gross;

    insert into public.payroll_records(period_id, employee_id, gross, net, regular_minutes, overtime_minutes, deductions_total, status)
      values (p_period_id, v_emp.employee_id, v_gross, v_net, v_total_minutes, v_overtime_minutes, 0, 'CALCULATED')
      on conflict (period_id, employee_id) do update set
        gross = excluded.gross,
        net = excluded.net,
        regular_minutes = excluded.regular_minutes,
        overtime_minutes = excluded.overtime_minutes
      returning id into v_rec;

    insert into public.payroll_items(record_id, kind, description, amount) values
      (v_rec.id, 'REGULAR', 'Regular hours', round((v_total_minutes/60.0)*v_rate, 2)),
      (v_rec.id, 'OVERTIME', 'Overtime hours', round((v_overtime_minutes/60.0)*v_rate*1.5, 2));

    v_count := v_count + 1;
  end loop;

  update public.payroll_periods set status = 'APPROVED' where id = p_period_id;
  perform public.audit_log('PAYROLL_CALCULATED', p_period_id::text, 'OK', null, jsonb_build_object('records', v_count));
  return v_count;
end;
$$;

create or replace function public.approve_payroll(p_period_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  update public.payroll_records set status = 'APPROVED' where period_id = p_period_id;
  update public.payroll_periods set status = 'PROCESSED' where id = p_period_id;
  perform public.audit_log('PAYROLL_APPROVED', p_period_id::text, 'OK');
end;
$$;

create or replace function public.close_payroll(p_period_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_hr(v_uid) then raise exception 'Forbidden' using errcode = '42501'; end if;
  update public.payroll_periods set status = 'LOCKED' where id = p_period_id;
  update public.payroll_records set status = 'LOCKED' where period_id = p_period_id;
  perform public.audit_log('PAYROLL_LOCKED', p_period_id::text, 'OK');
end;
$$;
-- 013 Seed: companies, products, departments, page content, default PTO policy
insert into public.departments(name, description) values
  ('Executive', 'Executive leadership'),
  ('Technology', 'Platform engineering'),
  ('Engineering', 'Product engineering'),
  ('Operations', 'Operations and reliability'),
  ('Marketing', 'Brand, growth, and communications'),
  ('Customer Support', 'Customer-facing support'),
  ('Finance', 'Finance and accounting'),
  ('Human Resources', 'HR and people operations'),
  ('Sales', 'Sales and partnerships'),
  ('Research & Development', 'Research and innovation')
on conflict (name) do nothing;

insert into public.companies(slug, name, tagline, description, status, featured, sort_order, category, launch_date, website, play_url, store_url) values
  ('maitroll', 'MaiTroll', 'LIVE. INTERACT. TROLL.',
   'MaiTroll is a social / live entertainment platform designed around interaction, community, creators, broadcasting, and entertainment.',
   'LIVE', true, 10, 'ENTERTAINMENT', null, null, null, null),
  ('otach', 'Otach', 'Understand your vehicle. Save money. Drive smarter.',
   'Otach is positioned as a step-by-step OBD-II diagnostic and education companion designed to help drivers understand what is happening with their vehicle, learn how repairs work, save money where possible, and avoid being taken advantage of by dishonest or unnecessarily expensive mechanics and dealerships.',
   'IN_DEVELOPMENT', true, 20, 'AUTOMOTIVE', null, null, null, null),
  ('udryve', 'Udryve', 'The next generation driver platform.',
   'Udryve allows drivers to complete deliveries while earning through the MAI Corp ecosystem, with a roadmap exploring partnerships with insurance and roadside-assistance providers and a future MAI Corp-operated roadside service.',
   'IN_DEVELOPMENT', true, 30, 'LOGISTICS', null, null, null, null),
  ('mai-dash', 'MAI Dash', 'Connect. Service. Get it done.',
   'MAI Dash is a marketplace for everyday service needs - mechanics, plumbers, construction, electricians, contractors, home services, automotive services, and local professionals.',
   'COMING_SOON', true, 40, 'MARKETPLACE', null, null, null, null)
on conflict (slug) do nothing;

insert into public.products(slug, name, category, description, price_cents, currency, features, status, featured, sort_order, estimated_delivery, management_available) values
  ('starter-website', 'Starter Website', 'WEBSITES',
   'A premium starter website for small businesses and personal brands.',
   99900, 'USD',
   '["5-7 pages","Mobile responsive","Contact form","Basic SEO","Deployment","2 revisions"]'::jsonb,
   'AVAILABLE', true, 10, '5-7 business days', true),
  ('business-website', 'Business Website', 'WEBSITES',
   'A polished website for growing businesses with richer content and integrations.',
   249900, 'USD',
   '["8-12 pages","Custom design","SEO","Forms","Integrations","Analytics","3 revisions"]'::jsonb,
   'AVAILABLE', true, 20, '2-3 weeks', true),
  ('professional-website', 'Professional Website', 'WEBSITES',
   'A high-end corporate website with refined animations, integrations and content modeling.',
   499900, 'USD',
   '["Premium custom design","Animations","Advanced integrations","CMS / content management","Advanced SEO","Unlimited revisions during build"]'::jsonb,
   'AVAILABLE', true, 30, '3-5 weeks', true),
  ('ecommerce-website', 'E-Commerce Website', 'ECOMMERCE',
   'A complete storefront with full products, cart, checkout, orders, customer accounts, payments, and admin management.',
   699900, 'USD',
   '["Full storefront","Products","Cart","Checkout","Orders","Customer accounts","Payment integration","Admin management","Inventory","Tax handling"]'::jsonb,
   'AVAILABLE', true, 10, '4-6 weeks', true),
  ('custom-platform', 'Custom Platform', 'CUSTOM',
   'A custom web platform built around your business workflows. Starting at $9,999.',
   999900, 'USD',
   '["Bespoke architecture","Tailored UX","API integrations","Custom dashboards","Security review","Discovery + architecture + implementation"]'::jsonb,
   'AVAILABLE', true, 10, 'Quoted per scope', true),
  ('custom-application', 'Custom Application', 'CUSTOM',
   'A custom web application built end-to-end. Starting at $4,999.',
   499900, 'USD',
   '["Frontend","Backend","Database","Auth","Deployment","Maintenance guidance"]'::jsonb,
   'AVAILABLE', false, 20, 'Quoted per scope', true),
  ('custom-project', 'Custom Project', 'CUSTOM',
   'A custom technology project of any shape or size.',
   0, 'USD',
   '["Discovery","Architecture","Implementation","QA","Launch","Handoff"]'::jsonb,
   'AVAILABLE', false, 30, 'Quoted per scope', true)
on conflict (slug) do nothing;

insert into public.pto_policies(name, annual_hours, accrual)
values ('Standard PTO', 80, 'MONTHLY')
on conflict (name) do nothing;

insert into public.page_content(key, value) values
  ('hero.headline', jsonb_build_object('lines', jsonb_build_array('BUILDING','TECHNOLOGY','WITH PURPOSE.'))),
  ('hero.subhead', jsonb_build_object('text', 'With the help of AI, I was able to create and develop apps designed to bring people joy, create opportunities, and help people earn money from home.')),
  ('hero.cta_primary', jsonb_build_object('label', 'Explore Our Companies', 'href', '/companies')),
  ('hero.cta_secondary', jsonb_build_object('label', 'Meet MAI Corp', 'href', '/about')),
  ('mission.title', jsonb_build_object('text', 'THE MAI CORP MISSION')),
  ('mission.body', jsonb_build_array(
    'MAI Corp was built on a simple idea: people deserve better.',
    'Whether you''re a customer, user, driver, contractor, broadcaster, creator, or employee, your time and effort have value.',
    'We believe technology should create opportunity - not simply take from the people using it.',
    'From day one, customer service has been at the heart of MAI Corp. As CEO, I strive to build platforms where people can enjoy themselves, earn, connect, and become something better than they were yesterday.',
    'Our goal isn''t just to build apps. It''s to build opportunities.'
  )),
  ('mission.attribution', jsonb_build_object('name', 'Joshua Tucker', 'title', 'CEO, MAI Corp')),
  ('infrastructure.disclaimer', jsonb_build_object('text', 'MAI Corp management fees cover the management and maintenance services provided by MAI Corp. Customers are responsible for third-party infrastructure and service costs required to operate their website or application, including hosting, domains, databases, email services, storage, payment processing, APIs, and other applicable services.')),
  ('support.headline', jsonb_build_object('text', 'HELP US BUILD WHAT''S NEXT')),
  ('support.body', jsonb_build_object('text', 'MAI Corp is building technology designed around people, opportunity, entertainment, and connection. If you believe in what we''re building and want to help us create the next generation of apps and platforms, you can support the mission.'))
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.schema_migrations(name, checksum, version, status)
values ('bootstrap-2026-09-03-001', md5('bootstrap-2026-09-03-001'), '2026.09.03.001', 'APPLIED')
on conflict (name) do nothing;
-- 014 CEO bootstrap exception
-- The very first CEO account must be creatable through the public
-- signup flow. Once a CEO exists, this exception closes and only
-- existing CEOs may insert into public.users with role='CEO'.

create or replace function public.is_first_ceo_bootstrap()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (select 1 from public.users where role = 'CEO');
$$;

drop policy if exists users_ceo_write on public.users;
create policy users_ceo_write on public.users for all
  using (public.is_ceo(auth.uid()))
  with check (public.is_ceo(auth.uid()) or public.is_first_ceo_bootstrap());

-- Allow a freshly signed-up CEO to create their own row before
-- the role check fires (auth.uid() matches the row id).
drop policy if exists users_self_insert on public.users;
create policy users_self_insert on public.users for insert
  with check (id = auth.uid());

-- And let them read their own row even before is_ceo resolves true.
drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users for select
  using (id = auth.uid() or public.is_ceo(auth.uid()));

-- Allow the authenticated user to update their own profile (name only);
-- do NOT permit self-elevation to CEO/HR_MANAGER - that path goes
-- through the CEO-only RLS gate above.
drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.users where id = auth.uid())
    and employment_status = (select employment_status from public.users where id = auth.uid())
    and account_status = (select account_status from public.users where id = auth.uid())
  );
-- 015 Store verticals: 10+ industry-specific app categories
-- Pricing tiers per CEO directive:
--   Starter vertical apps: $99
--   Mid-tier verticals: $199-$299
--   Pro / heavy verticals: $399-$499
--   Broadcast platform: $499
--   Broadcast app + platform: $599 (highest)
insert into public.products(slug, name, category, description, price_cents, currency, features, status, featured, sort_order, estimated_delivery, management_available) values
  -- $99 starter tier
  ('barbershop-starter', 'Barbershop App - Starter', 'INDUSTRY_VERTICALS',
   'A complete barbershop booking platform: online appointments, barber schedules, walk-in queue, and SMS reminders.',
   9900, 'USD',
   '["Online booking","Barber schedules","Walk-in queue","SMS reminders","Customer profiles"]'::jsonb,
   'AVAILABLE', true, 10, '3-4 weeks', true),

  ('tutoring-starter', 'Tutoring & Coaching App - Starter', 'INDUSTRY_VERTICALS',
   '1:1 and group bookings, course content, progress tracking, and recurring revenue.',
   9900, 'USD',
   '["1:1 booking","Group sessions","Course content","Progress tracking","Subscriptions"]'::jsonb,
   'AVAILABLE', false, 15, '3-4 weeks', true),

  ('church-nonprofit-starter', 'Church & Nonprofit App - Starter', 'INDUSTRY_VERTICALS',
   'Events, content, groups, giving, and volunteer scheduling.',
   9900, 'USD',
   '["Events","Sermons / content","Groups","Giving","Volunteer scheduling"]'::jsonb,
   'AVAILABLE', false, 18, '3-4 weeks', true),

  -- $199 tier
  ('restaurant-pro', 'Restaurant App - Pro', 'INDUSTRY_VERTICALS',
   'Online ordering, reservations, table management, kitchen display, QR ordering, and loyalty.',
   19900, 'USD',
   '["Online ordering","Reservations","Table management","Kitchen display","QR ordering","Loyalty","Tip prompts"]'::jsonb,
   'AVAILABLE', true, 30, '3-4 weeks', true),

  ('salon-spa-pro', 'Salon & Spa App - Pro', 'INDUSTRY_VERTICALS',
   'Booking, service menus, stylist profiles, retail, memberships, and gift cards.',
   19900, 'USD',
   '["Service menus","Stylist profiles","Booking","Retail","Memberships","Gift cards"]'::jsonb,
   'AVAILABLE', false, 35, '3-4 weeks', true),

  ('gym-fitness-pro', 'Gym & Fitness App - Pro', 'INDUSTRY_VERTICALS',
   'Class scheduling, memberships, trainer bookings, body metrics, and workout library.',
   19900, 'USD',
   '["Class scheduling","Memberships","Trainer bookings","Body metrics","Workout library","Billing"]'::jsonb,
   'AVAILABLE', false, 38, '3-4 weeks', true),

  ('event-booking-pro', 'Event Booking App - Pro', 'INDUSTRY_VERTICALS',
   'Ticketing, RSVPs, capacity management, attendee check-in, and event-branded pages.',
   19900, 'USD',
   '["Ticketing","RSVPs","Capacity","Check-in","Branded pages","Discount codes","Refunds"]'::jsonb,
   'AVAILABLE', false, 42, '3-4 weeks', true),

  -- $299 tier
  ('auto-repair-pro', 'Auto Repair Shop App - Pro', 'INDUSTRY_VERTICALS',
   'Vehicle intake, repair-order tracking, parts & labor estimates, technician assignments, and customer approvals.',
   29900, 'USD',
   '["Repair order tracking","VIN-driven vehicle profiles","Estimate approvals","Technician assignments","Parts & labor","Customer notifications"]'::jsonb,
   'AVAILABLE', true, 20, '4-5 weeks', true),

  ('contractor-pro', 'Contractor Services App - Pro', 'INDUSTRY_VERTICALS',
   'Job estimates, scheduling, crews, materials, invoicing, and customer updates for general and specialty contractors.',
   29900, 'USD',
   '["Job estimates","Crew scheduling","Materials tracking","Invoicing","Customer updates","Photo logs","Change orders"]'::jsonb,
   'AVAILABLE', false, 70, '3-5 weeks', true),

  -- $399 tier
  ('real-estate-pro', 'Real Estate App - Pro', 'INDUSTRY_VERTICALS',
   'MLS-ready listings, agent profiles, scheduling, lead capture, and CRM workflows.',
   39900, 'USD',
   '["Listings","Agent profiles","Scheduling","Lead capture","CRM","Saved searches","Map search","Virtual tours"]'::jsonb,
   'AVAILABLE', false, 60, '4-6 weeks', true),

  -- $499 - broadcast platform
  ('broadcast-platform', 'Broadcast Platform', 'INDUSTRY_VERTICALS',
   'A premium live-broadcast platform with multi-stream ingest, viewer analytics, real-time chat, presence, and creator monetization. Built on the MaiTroll-grade architecture.',
   49900, 'USD',
   '["Multi-stream ingest","Viewer analytics","Real-time chat","Presence","Creator monetization","Recording library","RTMP / WebRTC support","Tipping & gifts","Moderation","Branded overlays"]'::jsonb,
   'AVAILABLE', true, 5, '6-8 weeks', true),

  -- $599 - broadcast app + platform (highest tier)
  ('broadcast-app-and-platform', 'Broadcast App + Platform', 'INDUSTRY_VERTICALS',
   'The flagship offering: a complete custom broadcast ecosystem - branded mobile app, web app, and platform backend with creator accounts, subscriptions, payouts, and end-to-end monetization.',
   59900, 'USD',
   '["Branded mobile app","Branded web app","Creator accounts","Subscriptions","Payouts","Live broadcasts","Replays","Push notifications","In-app chat","Gifting & tipping","End-to-end monetization","Premium analytics","Priority support"]'::jsonb,
   'AVAILABLE', true, 1, '8-12 weeks', true)
on conflict (slug) do nothing;
-- 016 PayPal event idempotency + secret references
create table if not exists public.paypal_events (
  event_id text primary key,
  event_type text,
  processed_at timestamptz not null default now()
);
alter table public.paypal_events enable row level security;
drop policy if exists paypal_events_ceo on public.paypal_events;
create policy paypal_events_ceo on public.paypal_events for all
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

-- Seed config placeholders for the new industry-vertical categories
insert into public.page_content(key, value) values
  ('store.verticals.intro', jsonb_build_object(
    'title', 'Industry-specific apps, built for the people who use them.',
    'body', 'From barbershops to broadcast platforms - MAI Corp builds the technology your business depends on. Pick a starter, a pro tier, or the flagship broadcast package. Every plan includes optional monthly management.'
  ))
on conflict (key) do update set value = excluded.value, updated_at = now();
-- 017 Re-price website products (CEO pricing update)
update public.products set
  description = 'A premium starter website for small businesses and personal brands.',
  price_cents = 99900,
  features = '["5-7 pages","Mobile responsive","Contact form","Basic SEO","Deployment","2 revisions"]'::jsonb,
  estimated_delivery = '5-7 business days'
where slug = 'starter-website';

update public.products set
  description = 'A polished website for growing businesses with richer content and integrations.',
  price_cents = 249900,
  features = '["8-12 pages","Custom design","SEO","Forms","Integrations","Analytics","3 revisions"]'::jsonb,
  estimated_delivery = '2-3 weeks'
where slug = 'business-website';

update public.products set
  description = 'A high-end corporate website with refined animations, integrations and content modeling.',
  price_cents = 499900,
  features = '["Premium custom design","Animations","Advanced integrations","CMS / content management","Advanced SEO","Unlimited revisions during build"]'::jsonb,
  estimated_delivery = '3-5 weeks'
where slug = 'professional-website';

update public.products set
  description = 'A complete storefront with full products, cart, checkout, orders, customer accounts, payments, and admin management.',
  price_cents = 699900,
  features = '["Full storefront","Products","Cart","Checkout","Orders","Customer accounts","Payment integration","Admin management","Inventory","Tax handling"]'::jsonb,
  estimated_delivery = '4-6 weeks'
where slug = 'ecommerce-website';

update public.products set
  description = 'A custom web platform built around your business workflows. Starting at $9,999.',
  price_cents = 999900,
  features = '["Bespoke architecture","Tailored UX","API integrations","Custom dashboards","Security review","Discovery + architecture + implementation"]'::jsonb
where slug = 'custom-platform';

update public.products set
  description = 'A custom web application built end-to-end. Starting at $4,999.',
  price_cents = 499900,
  features = '["Frontend","Backend","Database","Auth","Deployment","Maintenance guidance"]'::jsonb
where slug = 'custom-application';

update public.products set
  description = 'A custom technology project of any shape or size. Quoted per scope.',
  price_cents = 0,
  features = '["Discovery","Architecture","Implementation","QA","Launch","Handoff"]'::jsonb
where slug = 'custom-project';
-- 018 Add revision_rounds column to products
alter table public.products add column if not exists revision_rounds int not null default 0;

-- Replace existing vertical products with the canonical CEO pricing + revision rounds.
-- Using on conflict do update so re-running is safe.
insert into public.products(slug, name, category, description, price_cents, currency, features, status, featured, sort_order, estimated_delivery, management_available, revision_rounds) values
  ('mechanic-auto-shop',          'Mechanic & Auto Shop',          'INDUSTRY_VERTICALS',
   'A complete mechanic & auto-shop platform: online booking, repair order tracking, VIN-driven vehicle profiles, parts & labor, technician assignments, customer estimates & approvals, and review collection.',
   129900, 'USD',
   '["Online booking","Repair order tracking","VIN-driven vehicle profiles","Parts & labor estimates","Customer estimate approvals","Technician assignments","Photo updates","Customer notifications","Reviews","Insurance-ready export"]'::jsonb,
   'AVAILABLE', true, 10, '4-5 weeks', true, 10),

  ('barber-beauty',               'Barber & Beauty',               'INDUSTRY_VERTICALS',
   'A premium barber & beauty booking platform: services, stylist profiles, walk-in queue, retail POS, memberships, gift cards, and tipping.',
   149900, 'USD',
   '["Service menu","Stylist profiles","Online booking","Walk-in queue","Retail POS","Memberships","Gift cards","Loyalty rewards","Reviews","Tipping"]'::jsonb,
   'AVAILABLE', true, 20, '3-4 weeks', true, 10),

  ('restaurant-food',             'Restaurant & Food',             'INDUSTRY_VERTICALS',
   'Online ordering, reservations, kitchen display, table management, QR ordering, loyalty, and allergen flags for cafÃƒÂ©s, food trucks, and full-service restaurants.',
   199900, 'USD',
   '["Online ordering","Reservations","Table management","Kitchen display","QR ordering","Loyalty","Delivery zones","Allergen flags","Tip prompts","Reports"]'::jsonb,
   'AVAILABLE', true, 30, '3-5 weeks', true, 12),

  ('creator-social',              'Creator & Social',              'INDUSTRY_VERTICALS',
   'Subscriptions, exclusive posts, livestream scheduling, direct messaging, and merchandise for creators, artists, and personalities.',
   249900, 'USD',
   '["Subscriptions","Exclusive posts","Livestream schedule","Direct messaging","Tipping","Merch","Fan tiers","Analytics","Push notifications"]'::jsonb,
   'AVAILABLE', true, 40, '4-5 weeks', true, 15),

  ('broadcasting-streaming',      'Broadcasting & Streaming',      'INDUSTRY_VERTICALS',
   'Multi-stream ingest, viewer analytics, real-time chat, presence, creator monetization, recording library, and premium moderation - built on MaiTroll-grade architecture.',
   349900, 'USD',
   '["Multi-stream ingest","Viewer analytics","Real-time chat","Presence","Creator monetization","Recording library","RTMP / WebRTC","Tipping & gifts","Moderation","Branded overlays"]'::jsonb,
   'AVAILABLE', true, 50, '6-8 weeks', true, 15),

  ('real-estate-pro',             'Real Estate',                   'INDUSTRY_VERTICALS',
   'MLS-ready listings, agent profiles, scheduling, lead capture, and CRM workflows for agencies and independent agents.',
   249900, 'USD',
   '["Listings","Agent profiles","Scheduling","Lead capture","CRM","Saved searches","Map search","Virtual tours","Document signing"]'::jsonb,
   'AVAILABLE', true, 60, '4-6 weeks', true, 12),

  ('fitness-personal-training',   'Fitness & Personal Training',   'INDUSTRY_VERTICALS',
   'Class scheduling, memberships, trainer bookings, body metrics, workout library, and retention reporting for gyms and trainers.',
   179900, 'USD',
   '["Class scheduling","Memberships","Trainer bookings","Body metrics","Workout library","Nutrition logs","Check-in","Billing","Retention reports"]'::jsonb,
   'AVAILABLE', true, 70, '4-5 weeks', true, 12),

  ('professional-services',       'Professional Services',         'INDUSTRY_VERTICALS',
   'Job estimates, scheduling, crews, materials, invoicing, and customer updates for contractors, plumbers, electricians, and specialty trades.',
   179900, 'USD',
   '["Job estimates","Crew scheduling","Materials tracking","Invoicing","Customer updates","Photo logs","Change orders","Payments"]'::jsonb,
   'AVAILABLE', true, 80, '3-5 weeks', true, 12),

  ('online-store',                'Online Store',                  'INDUSTRY_VERTICALS',
   'A complete online-store platform with storefront, products, cart, checkout, orders, customer accounts, payment integration, and admin management.',
   499900, 'USD',
   '["Storefront","Products","Cart","Checkout","Orders","Customer accounts","Payment integration","Admin management","Inventory","Tax handling","Discounts","Shipping zones","Reviews"]'::jsonb,
   'AVAILABLE', true, 90, '4-6 weeks', true, 15),

  ('custom-business-platform',    'Custom Business Platform',      'INDUSTRY_VERTICALS',
   'A bespoke end-to-end business platform built around your workflows. Starts at $12,999 and scales with discovery, architecture, integration, and ongoing operation.',
   1299900, 'USD',
   '["Bespoke architecture","Tailored UX","API integrations","Custom dashboards","Workflow automation","Security review","Discovery + architecture + implementation + QA","Multi-region rollout","Onboarding","Operations playbooks"]'::jsonb,
   'AVAILABLE', true, 100, 'Quoted per scope', true, 20)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  features = excluded.features,
  estimated_delivery = excluded.estimated_delivery,
  revision_rounds = excluded.revision_rounds,
  status = 'AVAILABLE',
  featured = excluded.featured,
  sort_order = excluded.sort_order,
  management_available = excluded.management_available,
  category = excluded.category;

-- Disable the older per-tier vertical duplicates that were inserted by
-- migration 015 to avoid confusing the storefront. Keep the canonical
-- version (e.g. 'mechanic-auto-shop') and hide the legacy variants.
update public.products set status = 'RETIRED'
where slug in (
  'barbershop-starter',
  'tutoring-starter',
  'church-nonprofit-starter',
  'restaurant-pro',
  'salon-spa-pro',
  'gym-fitness-pro',
  'event-booking-pro',
  'auto-repair-pro',
  'contractor-pro',
  'broadcast-platform'
);
-- Reset CEO bootstrap gate for the new Supabase project
select id, email, role, account_status, employment_status from public.users where role = 'CEO';
select id, email from auth.users;
-- 099 Reset CEO bootstrap gate for fresh projects.
-- Run ONLY on a new project where you intend to bootstrap the first CEO.
-- Removes any stray CEO rows from auth.users / public.users so
-- public_ceo_signup_allowed() returns true again.

delete from public.users where role = 'CEO';
-- (Optional) clear any auth.users you no longer need; comment out if unsure:
-- delete from auth.users where email not in (select email from public.users);
-- 019 App Updates: MAIUPDATE-driven platform apps + app updates
alter table public.platforms add column if not exists maiupdate_url text;
alter table public.platforms add column if not exists last_sync_at timestamptz;

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
  name = excluded.name, description = excluded.description, enabled = excluded.enabled,
  monitoring_enabled = excluded.monitoring_enabled, analytics_enabled = excluded.analytics_enabled,
  maiupdate_url = excluded.maiupdate_url;

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
create policy platform_apps_ceo on public.platform_apps for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));
drop policy if exists platform_apps_public_read on public.platform_apps;
create policy platform_apps_public_read on public.platform_apps for select using (app_status in ('CURRENT','BETA') and is_latest);
create index if not exists platform_apps_platform_idx on public.platform_apps (platform_id);
create index if not exists platform_apps_version_idx on public.platform_apps (platform_id, version);
create index if not exists platform_apps_latest_idx on public.platform_apps (platform_id, is_latest) where is_latest;

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
create policy app_updates_ceo on public.app_updates for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));
drop policy if exists app_updates_public_read on public.app_updates;
create policy app_updates_public_read on public.app_updates for select using (status = 'PUBLISHED' and (published_at is null or published_at <= now()));
create index if not exists app_updates_platform_idx on public.app_updates (platform_id);
create index if not exists app_updates_release_idx on public.app_updates (release_time desc);
create index if not exists app_updates_status_idx on public.app_updates (status, published_at desc);
create index if not exists app_updates_featured_idx on public.app_updates (is_featured) where is_featured;
create index if not exists app_updates_type_idx on public.app_updates (update_type);

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

create or replace function public.app_updates_count()
  returns bigint language sql stable security definer set search_path = public as $$
    select count(*) from public.app_updates where status = 'PUBLISHED' and (published_at is null or published_at <= now());
  $$;

create or replace function public.upsert_app_update(
  p_platform_slug text, p_version text, p_title text,
  p_description text default null, p_release_notes text default null,
  p_release_time timestamptz default now(), p_download_url text default null,
  p_icon_url text default null, p_update_type text default 'feature',
  p_is_featured boolean default false, p_status text default 'PUBLISHED'
) returns uuid language plpgsql security definer set search_path = public as $$
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
    case when p_status = 'PUBLISHED' then now() else null end, true, now(), now()
  ) on conflict (platform_id, version, title) do update set
    description = excluded.description, release_notes = excluded.release_notes,
    release_time = excluded.release_time, download_url = excluded.download_url,
    icon_url = excluded.icon_url, update_type = excluded.update_type,
    is_featured = excluded.is_featured, status = excluded.status,
    published_at = excluded.published_at, synced_from_maiupdate = true,
    updated_at = now()
  returning id into v_id;
  update public.platforms set last_sync_at = now() where id = v_platform;
  return v_id;
end;
$$;
