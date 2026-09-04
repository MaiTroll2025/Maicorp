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