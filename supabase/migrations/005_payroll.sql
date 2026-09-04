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