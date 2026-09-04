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