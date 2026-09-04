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