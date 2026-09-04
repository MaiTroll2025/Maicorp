-- 024 Separate app-store publishing ownership from project progress
create table if not exists public.project_store_management (
  order_id uuid primary key references public.orders(id) on delete cascade,
  apple_account_owner text not null default 'CUSTOMER' check (apple_account_owner in ('CUSTOMER', 'MAI_CORP')),
  google_account_owner text not null default 'CUSTOMER' check (google_account_owner in ('CUSTOMER', 'MAI_CORP')),
  apple_status text not null default 'NOT_STARTED' check (apple_status in ('NOT_STARTED', 'IN_PROGRESS', 'SUBMISSION', 'REVIEW', 'PUBLISHED', 'BLOCKED')),
  google_status text not null default 'NOT_STARTED' check (google_status in ('NOT_STARTED', 'IN_PROGRESS', 'SUBMISSION', 'REVIEW', 'PUBLISHED', 'BLOCKED')),
  apple_app_id text,
  google_package_name text,
  management_enabled boolean not null default false,
  monthly_fee_cents integer check (monthly_fee_cents is null or monthly_fee_cents >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);
create index if not exists project_store_management_updated_idx on public.project_store_management(updated_at desc);
alter table public.project_store_management enable row level security;
drop policy if exists project_store_management_customer_read on public.project_store_management;
create policy project_store_management_customer_read on public.project_store_management for select using (
  exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
);
drop policy if exists project_store_management_ceo on public.project_store_management;
create policy project_store_management_ceo on public.project_store_management for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));
