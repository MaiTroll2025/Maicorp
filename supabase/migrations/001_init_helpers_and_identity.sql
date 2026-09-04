-- =====================================================================
-- MAI CORP — Consolidated bootstrap migration (part 1: helpers + identity)
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