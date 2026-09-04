-- 026 Infrastructure coverage, monthly renewal, immediate suspension
-- Distinguishes:
--   1. Management Plan        (orders.management_plan)
--   2. Infrastructure Payment Responsibility (orders.infrastructure_payment_responsibility)
--   3. Infrastructure Monthly Coverage/Renewal (infrastructure_coverage)
--   4. Infrastructure Invoices                  (infrastructure_invoices)
-- Invoices are paid through PayPal; emails are sent via the
-- send-infrastructure-email edge function.

-- ---------------------------------------------------------------------
-- 1. Add infrastructure_payment_responsibility to orders
-- ---------------------------------------------------------------------
alter table public.orders
  add column if not exists infrastructure_payment_responsibility text
  not null default 'CUSTOMER_DIRECT'
  check (infrastructure_payment_responsibility in ('CUSTOMER_DIRECT','MAI_CORP_COVERED'));

alter table public.orders
  add column if not exists infrastructure_initial_cost_cents int
  not null default 0;

-- ---------------------------------------------------------------------
-- 2. Customer-owned infrastructure account (one per order).
-- ---------------------------------------------------------------------
create table if not exists public.infrastructure_accounts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_id uuid not null references public.users(id) on delete cascade,
  provider text not null default 'SUPABASE_PRO',
  provider_resource_id text,
  plan_tier text,
  monthly_cost_cents int not null default 0,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','PENDING_PAYMENT','PAYMENT_OVERDUE','SUSPENSION_REQUIRED','SUSPENDED','RESTORATION_REQUIRED','CANCELLED')),
  activated_at timestamptz not null default now(),
  suspended_at timestamptz,
  suspension_reason text,
  restored_at timestamptz,
  restored_by uuid references public.users(id),
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.infrastructure_accounts enable row level security;
create index if not exists infrastructure_accounts_order_idx on public.infrastructure_accounts(order_id);
create index if not exists infrastructure_accounts_customer_idx on public.infrastructure_accounts(customer_id);
create index if not exists infrastructure_accounts_status_idx on public.infrastructure_accounts(status);

drop policy if exists infrastructure_accounts_self_read on public.infrastructure_accounts;
create policy infrastructure_accounts_self_read on public.infrastructure_accounts for select
  using (customer_id = auth.uid());

-- Customers MUST NOT modify billing state.
drop policy if exists infrastructure_accounts_self_update on public.infrastructure_accounts;
create policy infrastructure_accounts_self_update on public.infrastructure_accounts for update
  using (false) with check (false);

drop policy if exists infrastructure_accounts_ceo_all on public.infrastructure_accounts;
create policy infrastructure_accounts_ceo_all on public.infrastructure_accounts for all
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

drop policy if exists infrastructure_accounts_self_insert on public.infrastructure_accounts;
create policy infrastructure_accounts_self_insert on public.infrastructure_accounts for insert
  with check (customer_id = auth.uid() and status = 'ACTIVE');

-- ---------------------------------------------------------------------
-- 3. Infrastructure coverage (the recurring $50 MAI Corp service)
-- ---------------------------------------------------------------------
create table if not exists public.infrastructure_coverage (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_id uuid not null references public.users(id) on delete cascade,
  infrastructure_id uuid references public.infrastructure_accounts(id) on delete set null,
  coverage_type text not null default 'NONE'
    check (coverage_type in ('NONE','MAI_CORP_COVERED')),
  monthly_fee_cents int not null default 0,
  infrastructure_cost_cents int not null default 0,
  billing_start_date date not null,
  current_period_start date not null,
  current_period_end date not null,
  next_invoice_date date,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','PENDING_PAYMENT','PAYMENT_OVERDUE','SUSPENSION_REQUIRED','SUSPENDED','RESTORATION_REQUIRED','CANCELLED')),
  auto_renew boolean not null default true,
  cancelled_at timestamptz,
  cancellation_reason text,
  cancelled_by uuid references public.users(id),
  suspended_at timestamptz,
  suspension_reason text,
  restored_at timestamptz,
  restored_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.infrastructure_coverage enable row level security;
create index if not exists infrastructure_coverage_order_idx on public.infrastructure_coverage(order_id);
create index if not exists infrastructure_coverage_customer_idx on public.infrastructure_coverage(customer_id);
create index if not exists infrastructure_coverage_status_idx on public.infrastructure_coverage(status);
create index if not exists infrastructure_coverage_next_invoice_idx on public.infrastructure_coverage(next_invoice_date);

drop policy if exists infrastructure_coverage_self_read on public.infrastructure_coverage;
create policy infrastructure_coverage_self_read on public.infrastructure_coverage for select
  using (customer_id = auth.uid());

drop policy if exists infrastructure_coverage_self_insert on public.infrastructure_coverage;
create policy infrastructure_coverage_self_insert on public.infrastructure_coverage for insert
  with check (customer_id = auth.uid() and coverage_type in ('NONE','MAI_CORP_COVERED') and status = 'ACTIVE');

drop policy if exists infrastructure_coverage_self_update on public.infrastructure_coverage;
create policy infrastructure_coverage_self_update on public.infrastructure_coverage for update
  using (false) with check (false);

drop policy if exists infrastructure_coverage_ceo_all on public.infrastructure_coverage;
create policy infrastructure_coverage_ceo_all on public.infrastructure_coverage for all
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

-- ---------------------------------------------------------------------
-- 4. Infrastructure invoices (MAI-INV-...)
--    Linked to a PayPal order for payment.
-- ---------------------------------------------------------------------
create table if not exists public.infrastructure_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_id uuid not null references public.users(id) on delete restrict,
  infrastructure_id uuid references public.infrastructure_accounts(id) on delete set null,
  coverage_id uuid references public.infrastructure_coverage(id) on delete set null,
  coverage_type text not null check (coverage_type in ('NONE','MAI_CORP_COVERED')),
  management_plan text not null,
  billing_period_start date not null,
  billing_period_end date not null,
  issue_date date not null default current_date,
  due_date date not null,
  infrastructure_cost_cents int not null default 0,
  coverage_fee_cents int not null default 0,
  additional_costs_cents int not null default 0,
  total_cents int not null,
  currency text not null default 'USD',
  status text not null default 'PENDING'
    check (status in ('PENDING','SENT','PAID','OVERDUE','CANCELLED','REFUNDED','SUSPENDED')),
  paypal_order_id text,
  paypal_capture_id text,
  paypal_approval_url text,
  paypal_error text,
  paid_at timestamptz,
  payment_method text,
  payment_reference text,
  paid_by uuid references public.users(id),
  pdf_storage_path text,
  pdf_generated_at timestamptz,
  email_sent_at timestamptz,
  email_message_id text,
  email_error text,
  overdue_email_sent_at timestamptz,
  suspended_email_sent_at timestamptz,
  restored_email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.infrastructure_invoices enable row level security;
create index if not exists infrastructure_invoices_order_idx on public.infrastructure_invoices(order_id);
create index if not exists infrastructure_invoices_customer_idx on public.infrastructure_invoices(customer_id);
create index if not exists infrastructure_invoices_status_idx on public.infrastructure_invoices(status);
create index if not exists infrastructure_invoices_due_idx on public.infrastructure_invoices(due_date);

drop policy if exists infrastructure_invoices_self_read on public.infrastructure_invoices;
create policy infrastructure_invoices_self_read on public.infrastructure_invoices for select
  using (customer_id = auth.uid());

drop policy if exists infrastructure_invoices_self_write on public.infrastructure_invoices;
create policy infrastructure_invoices_self_write on public.infrastructure_invoices for all
  using (false) with check (false);

drop policy if exists infrastructure_invoices_ceo_all on public.infrastructure_invoices;
create policy infrastructure_invoices_ceo_all on public.infrastructure_invoices for all
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

-- ---------------------------------------------------------------------
-- 5. Notification log (for the alert types)
-- ---------------------------------------------------------------------
create table if not exists public.infrastructure_notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users(id) on delete cascade,
  invoice_id uuid references public.infrastructure_invoices(id) on delete cascade,
  coverage_id uuid references public.infrastructure_coverage(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  kind text not null check (kind in (
    'INVOICE_CREATED','PAYMENT_DUE','OVERDUE','SUSPENDED','PAYMENT_RECEIVED','RESTORED','CANCELLED'
  )),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.infrastructure_notifications enable row level security;
create index if not exists infrastructure_notifications_customer_idx on public.infrastructure_notifications(customer_id);
create index if not exists infrastructure_notifications_order_idx on public.infrastructure_notifications(order_id);

drop policy if exists infrastructure_notifications_self_read on public.infrastructure_notifications;
create policy infrastructure_notifications_self_read on public.infrastructure_notifications for select
  using (customer_id = auth.uid());

drop policy if exists infrastructure_notifications_self_write on public.infrastructure_notifications;
create policy infrastructure_notifications_self_write on public.infrastructure_notifications for all
  using (false) with check (false);

drop policy if exists infrastructure_notifications_ceo_all on public.infrastructure_notifications;
create policy infrastructure_notifications_ceo_all on public.infrastructure_notifications for all
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

-- ---------------------------------------------------------------------
-- 6. Helper: generate the next MAI-INV-YYYY-NNNNNN invoice number.
-- ---------------------------------------------------------------------
create or replace function public.next_infrastructure_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  yr text := to_char(current_date, 'YYYY');
  prefix text := 'MAI-INV-' || yr || '-';
  next_seq int;
  candidate text;
begin
  select coalesce(
    max(
      case
        when invoice_number like prefix || '%'
          then substring(invoice_number from length(prefix)+1)::int
        else 0
      end
    ), 0
  ) + 1
  into next_seq
  from public.infrastructure_invoices
  where invoice_number like prefix || '%';

  candidate := prefix || lpad(next_seq::text, 6, '0');

  while exists (select 1 from public.infrastructure_invoices where invoice_number = candidate) loop
    next_seq := next_seq + 1;
    candidate := prefix || lpad(next_seq::text, 6, '0');
  end loop;

  return candidate;
end $$;

grant execute on function public.next_infrastructure_invoice_number() to authenticated;

-- ---------------------------------------------------------------------
-- 7. updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists touch_infrastructure_accounts on public.infrastructure_accounts;
create trigger touch_infrastructure_accounts before update on public.infrastructure_accounts
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_infrastructure_coverage on public.infrastructure_coverage;
create trigger touch_infrastructure_coverage before update on public.infrastructure_coverage
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_infrastructure_invoices on public.infrastructure_invoices;
create trigger touch_infrastructure_invoices before update on public.infrastructure_invoices
  for each row execute function public.touch_updated_at();
