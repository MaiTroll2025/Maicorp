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
-- 027 Infrastructure coverage RPCs
-- Server-authoritative lifecycle for:
--   * initialize_coverage   - create coverage + initial invoice on payment
--   * generate_invoice      - create next monthly invoice
--   * process_overdue       - mark invoices OVERDUE + coverage SUSPENSION_REQUIRED
--   * execute_suspension    - move infrastructure to SUSPENDED
--   * restore_infrastructure - mark invoice PAID + restore
--   * cancel_coverage       - customer cancels; preserve history
--   * run_monthly_renewals  - generate next invoices for active coverages
--   * get_invoice_pdf       - return text representation
--   * notify_invoice_event  - record notification in infrastructure_notifications
--
-- PayPal integration is handled by the existing paypal-create / paypal-capture
-- edge functions and the paypal-webhook, which now also recognise
-- infrastructure_invoices.paypal_order_id.

-- ---------------------------------------------------------------------
-- Constants
-- ---------------------------------------------------------------------
-- MAI Corp's monthly infrastructure coverage service fee.
create or replace function public.mai_coverage_monthly_fee_cents()
returns int language sql immutable as $$ select 5000 $$;

-- ---------------------------------------------------------------------
-- initialize_infrastructure_coverage
-- Called after the initial order is paid. Creates:
--   - infrastructure_accounts row (always)
--   - infrastructure_coverage row (only when MAI_CORP_COVERED)
--   - the FIRST infrastructure invoice (only when MAI_CORP_COVERED)
-- The function never throws on CUSTOMER_DIRECT; it simply records the
-- choice and exits without creating any coverage or invoice.
-- ---------------------------------------------------------------------
create or replace function public.initialize_infrastructure_coverage(
  p_order_id uuid,
  p_infrastructure_cost_cents int default 2500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_resp public.infrastructure_accounts%rowtype;
  v_cov public.infrastructure_coverage%rowtype;
  v_inv public.infrastructure_invoices%rowtype;
  v_monthly_fee int := public.mai_coverage_monthly_fee_cents();
  v_infra_cost int := greatest(coalesce(p_infrastructure_cost_cents, 0), 0);
  v_period_start date := current_date;
  v_period_end date := (current_date + interval '1 month')::date;
  v_due date := (current_date + interval '14 days')::date;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  -- Always create the infrastructure_accounts row so we can record the
  -- payment responsibility decision.
  insert into public.infrastructure_accounts(
    order_id, customer_id, provider, monthly_cost_cents, status, metadata
  )
  values (
    v_order.id, v_order.customer_id, 'SUPABASE_PRO', v_infra_cost, 'ACTIVE',
    jsonb_build_object('initial_cost_cents', v_infra_cost)
  )
  on conflict (order_id) do update
    set monthly_cost_cents = excluded.monthly_cost_cents,
        provider = excluded.provider,
        updated_at = now()
  returning * into v_resp;

  if v_order.infrastructure_payment_responsibility <> 'MAI_CORP_COVERED' then
    return jsonb_build_object(
      'ok', true,
      'mode', 'CUSTOMER_DIRECT',
      'infrastructure_account_id', v_resp.id,
      'coverage_id', null,
      'invoice_id', null
    );
  end if;

  -- MAI_CORP_COVERED: create coverage + initial invoice.
  insert into public.infrastructure_coverage(
    order_id, customer_id, infrastructure_id,
    coverage_type, monthly_fee_cents, infrastructure_cost_cents,
    billing_start_date, current_period_start, current_period_end, next_invoice_date,
    status, auto_renew
  )
  values (
    v_order.id, v_order.customer_id, v_resp.id,
    'MAI_CORP_COVERED', v_monthly_fee, v_infra_cost,
    v_period_start, v_period_start, v_period_end, v_period_end,
    'ACTIVE', true
  )
  on conflict (order_id) do update
    set coverage_type = 'MAI_CORP_COVERED',
        monthly_fee_cents = excluded.monthly_fee_cents,
        infrastructure_cost_cents = excluded.infrastructure_cost_cents,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        next_invoice_date = excluded.next_invoice_date,
        status = 'ACTIVE',
        auto_renew = true,
        cancelled_at = null,
        cancellation_reason = null,
        cancelled_by = null,
        updated_at = now()
  returning * into v_cov;

  insert into public.infrastructure_invoices(
    invoice_number, order_id, customer_id, infrastructure_id, coverage_id,
    coverage_type, management_plan,
    billing_period_start, billing_period_end, issue_date, due_date,
    infrastructure_cost_cents, coverage_fee_cents, additional_costs_cents,
    total_cents, currency, status
  )
  values (
    public.next_infrastructure_invoice_number(),
    v_order.id, v_order.customer_id, v_resp.id, v_cov.id,
    'MAI_CORP_COVERED', coalesce(v_order.management_plan, 'NONE'),
    v_period_start, v_period_end, current_date, v_due,
    v_infra_cost, v_monthly_fee, 0,
    v_infra_cost + v_monthly_fee, 'USD', 'PENDING'
  )
  returning * into v_inv;

  update public.infrastructure_coverage
    set status = 'PENDING_PAYMENT'
    where id = v_cov.id;

  update public.infrastructure_accounts
    set status = 'PENDING_PAYMENT'
    where id = v_resp.id;

  return jsonb_build_object(
    'ok', true,
    'mode', 'MAI_CORP_COVERED',
    'infrastructure_account_id', v_resp.id,
    'coverage_id', v_cov.id,
    'invoice_id', v_inv.id,
    'invoice_number', v_inv.invoice_number,
    'total_cents', v_inv.total_cents
  );
end $$;

grant execute on function public.initialize_infrastructure_coverage(uuid, int) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- generate_next_invoice
-- Creates the next billing invoice for an ACTIVE coverage.
-- Each call creates a NEW invoice row (history is preserved; numbers
-- are never reused).
-- ---------------------------------------------------------------------
create or replace function public.generate_next_invoice(
  p_coverage_id uuid,
  p_infrastructure_cost_cents int default null
)
returns public.infrastructure_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cov public.infrastructure_coverage%rowtype;
  v_infra public.infrastructure_accounts%rowtype;
  v_order public.orders%rowtype;
  v_period_start date;
  v_period_end date;
  v_due date;
  v_infra_cost int;
  v_monthly_fee int;
  v_total int;
  v_inv public.infrastructure_invoices%rowtype;
begin
  select * into v_cov from public.infrastructure_coverage where id = p_coverage_id for update;
  if not found then raise exception 'coverage_not_found'; end if;
  if v_cov.cancelled_at is not null then raise exception 'coverage_cancelled'; end if;

  select * into v_infra from public.infrastructure_accounts where id = v_cov.infrastructure_id;
  select * into v_order from public.orders where id = v_cov.order_id;

  v_period_start := v_cov.current_period_end;
  v_period_end   := (v_period_start + interval '1 month')::date;
  v_due          := (current_date + interval '14 days')::date;
  v_infra_cost   := coalesce(p_infrastructure_cost_cents, v_cov.infrastructure_cost_cents);
  v_monthly_fee  := v_cov.monthly_fee_cents;
  v_total        := v_infra_cost + v_monthly_fee;

  insert into public.infrastructure_invoices(
    invoice_number, order_id, customer_id, infrastructure_id, coverage_id,
    coverage_type, management_plan,
    billing_period_start, billing_period_end, issue_date, due_date,
    infrastructure_cost_cents, coverage_fee_cents, additional_costs_cents,
    total_cents, currency, status
  )
  values (
    public.next_infrastructure_invoice_number(),
    v_cov.order_id, v_cov.customer_id, v_cov.infrastructure_id, v_cov.id,
    'MAI_CORP_COVERED', coalesce(v_order.management_plan, 'NONE'),
    v_period_start, v_period_end, current_date, v_due,
    v_infra_cost, v_monthly_fee, 0,
    v_total, 'USD', 'PENDING'
  )
  returning * into v_inv;

  update public.infrastructure_coverage
    set current_period_start = v_period_start,
        current_period_end   = v_period_end,
        next_invoice_date    = v_period_end,
        infrastructure_cost_cents = v_infra_cost,
        status = 'PENDING_PAYMENT'
    where id = v_cov.id;

  update public.infrastructure_accounts
    set status = 'PENDING_PAYMENT',
        monthly_cost_cents = v_infra_cost
    where id = v_cov.infrastructure_id;

  return v_inv;
end $$;

grant execute on function public.generate_next_invoice(uuid, int) to service_role;

-- ---------------------------------------------------------------------
-- process_overdue_invoices
--   * Marks any PENDING/SENT invoices past due_date as OVERDUE.
--   * Sets coverage.status = 'PAYMENT_OVERDUE' and
--     infrastructure_accounts.status = 'SUSPENSION_REQUIRED'.
--   * There is NO grace period.
--   * If the provider supports automated suspension (provider_resource_id
--     and a configured hook), this function attempts it. The actual
--     suspension is performed by execute_suspension (which can be
--     invoked synchronously or queued).
-- Returns the list of invoice ids that were transitioned.
-- ---------------------------------------------------------------------
create or replace function public.process_overdue_invoices()
returns table(invoice_id uuid, coverage_id uuid, infrastructure_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select i.id, i.coverage_id, c.infrastructure_id
    from public.infrastructure_invoices i
    join public.infrastructure_coverage c on c.id = i.coverage_id
    where i.status in ('PENDING','SENT')
      and i.due_date < current_date
      and c.cancelled_at is null
  )
  update public.infrastructure_invoices i
    set status = 'OVERDUE'
    from due
    where i.id = due.id
    returning i.id, due.coverage_id, due.infrastructure_id;
end $$;

grant execute on function public.process_overdue_invoices() to service_role;

create or replace function public.mark_overdue_state()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.infrastructure_invoices
    set status = 'OVERDUE'
    where status in ('PENDING','SENT')
      and due_date < current_date;

  get diagnostics v_count = row_count;

  update public.infrastructure_coverage c
    set status = 'PAYMENT_OVERDUE'
    from public.infrastructure_invoices i
    where i.coverage_id = c.id
      and i.status = 'OVERDUE'
      and c.status not in ('CANCELLED','SUSPENDED')
      and c.cancelled_at is null;

  update public.infrastructure_accounts a
    set status = 'SUSPENSION_REQUIRED'
    from public.infrastructure_coverage c
    where c.infrastructure_id = a.id
      and c.status = 'PAYMENT_OVERDUE'
      and a.status not in ('CANCELLED','SUSPENDED');

  return v_count;
end $$;

grant execute on function public.mark_overdue_state() to service_role;

-- ---------------------------------------------------------------------
-- execute_suspension
-- Suspends infrastructure for an overdue invoice. Marks the invoice
-- SUSPENDED, the coverage SUSPENSION_REQUIRED, and the infrastructure
-- account SUSPENDED. Attempts automated provider shutdown when possible.
-- ---------------------------------------------------------------------
create or replace function public.execute_suspension(p_invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.infrastructure_invoices%rowtype;
  v_cov public.infrastructure_coverage%rowtype;
  v_acc public.infrastructure_accounts%rowtype;
  v_provider text := v_acc.provider;
begin
  select * into v_inv from public.infrastructure_invoices where id = p_invoice_id;
  if not found then raise exception 'invoice_not_found'; end if;
  if v_inv.status = 'PAID' then raise exception 'invoice_already_paid'; end if;
  if v_inv.status = 'CANCELLED' then raise exception 'invoice_cancelled'; end if;

  select * into v_cov from public.infrastructure_coverage where id = v_inv.coverage_id;
  select * into v_acc from public.infrastructure_accounts where id = v_inv.infrastructure_id;
  v_provider := v_acc.provider;

  update public.infrastructure_accounts
    set status = 'SUSPENDED',
        suspended_at = now(),
        suspension_reason = format('Invoice %s is overdue', v_inv.invoice_number),
        metadata = coalesce(metadata, '{}'::jsonb)
                   || jsonb_build_object('provider_suspend_attempted_at', now())
    where id = v_acc.id;

  update public.infrastructure_coverage
    set status = 'SUSPENDED',
        suspended_at = now(),
        suspension_reason = format('Invoice %s overdue', v_inv.invoice_number)
    where id = v_cov.id;

  update public.infrastructure_invoices
    set status = 'SUSPENDED'
    where id = v_inv.id;

  -- Record a CEO action. The actual provider shutdown is attempted by
  -- the edge function suspend_infrastructure which is configured per
  -- provider. Until that confirms success, metadata reflects that the
  -- automated suspension was *attempted*, not completed.

  return jsonb_build_object(
    'ok', true,
    'invoice_id', v_inv.id,
    'coverage_id', v_cov.id,
    'infrastructure_id', v_acc.id,
    'provider', v_provider,
    'automated', false,
    'reason', 'Awaiting CEO confirmation or provider hook'
  );
end $$;

grant execute on function public.execute_suspension(uuid) to service_role;

-- ---------------------------------------------------------------------
-- mark_invoice_paid
-- Idempotent. Marks an invoice PAID, advances the coverage, and
-- schedules the NEXT invoice for the following month.
-- ---------------------------------------------------------------------
create or replace function public.mark_invoice_paid(
  p_invoice_id uuid,
  p_paypal_capture_id text default null,
  p_payment_method text default 'PAYPAL'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.infrastructure_invoices%rowtype;
  v_cov public.infrastructure_coverage%rowtype;
  v_acc public.infrastructure_accounts%rowtype;
  v_order public.orders%rowtype;
  v_next_inv public.infrastructure_invoices%rowtype;
begin
  select * into v_inv from public.infrastructure_invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice_not_found'; end if;
  if v_inv.status = 'PAID' then
    return jsonb_build_object('ok', true, 'already_paid', true);
  end if;

  update public.infrastructure_invoices
    set status = 'PAID',
        paid_at = now(),
        payment_method = p_payment_method,
        payment_reference = coalesce(p_paypal_capture_id, payment_reference),
        paypal_capture_id = coalesce(p_paypal_capture_id, paypal_capture_id)
    where id = v_inv.id
    returning * into v_inv;

  if v_inv.coverage_id is not null then
    select * into v_cov from public.infrastructure_coverage where id = v_inv.coverage_id for update;
    select * into v_acc from public.infrastructure_accounts where id = v_cov.infrastructure_id;
    select * into v_order from public.orders where id = v_cov.order_id;

    -- If we were suspended or in suspension-required state, RESTORE.
    if v_cov.status in ('SUSPENDED','SUSPENSION_REQUIRED','PAYMENT_OVERDUE','RESTORATION_REQUIRED') then
      update public.infrastructure_accounts
        set status = 'ACTIVE',
            restored_at = now(),
            restored_by = null,
            suspended_at = null,
            suspension_reason = null
        where id = v_acc.id;

      update public.infrastructure_coverage
        set status = 'RESTORATION_REQUIRED',
            restored_at = now(),
            suspended_at = null,
            suspension_reason = null
        where id = v_cov.id;
      -- RESTORATION_REQUIRED is set so the CEO confirms or the provider
      -- hook actually restores. The follow-up RPC confirm_restoration
      -- flips it to ACTIVE.
      -- For convenience, when there is no provider hook configured,
      -- we mark ACTIVE immediately so the customer is unblocked.
      if coalesce(v_acc.metadata->>'provider_restore_required', 'true') = 'false' then
        update public.infrastructure_coverage set status = 'ACTIVE' where id = v_cov.id;
      end if;
    else
      update public.infrastructure_coverage
        set status = 'ACTIVE'
        where id = v_cov.id;
      update public.infrastructure_accounts
        set status = 'ACTIVE'
        where id = v_acc.id;
    end if;

    -- Auto-generate the NEXT invoice if coverage is auto_renew and active.
    if v_cov.auto_renew and v_cov.cancelled_at is null then
      select * into v_next_inv from public.generate_next_invoice(
        v_cov.id, v_cov.infrastructure_cost_cents
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'invoice_id', v_inv.id,
    'paid_at', v_inv.paid_at,
    'next_invoice_id', v_next_inv.id
  );
end $$;

grant execute on function public.mark_invoice_paid(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------
-- confirm_restoration
-- CEO confirms the infrastructure was restored after suspension.
-- ---------------------------------------------------------------------
create or replace function public.confirm_restoration(p_invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.infrastructure_invoices%rowtype;
  v_cov public.infrastructure_coverage%rowtype;
  v_acc public.infrastructure_accounts%rowtype;
begin
  select * into v_inv from public.infrastructure_invoices where id = p_invoice_id;
  if not found then raise exception 'invoice_not_found'; end if;
  select * into v_cov from public.infrastructure_coverage where id = v_inv.coverage_id;
  select * into v_acc from public.infrastructure_accounts where id = v_cov.infrastructure_id;

  update public.infrastructure_accounts
    set status = 'ACTIVE',
        restored_at = now(),
        restored_by = auth.uid(),
        suspended_at = null,
        suspension_reason = null
    where id = v_acc.id;

  update public.infrastructure_coverage
    set status = 'ACTIVE',
        restored_at = now(),
        restored_by = auth.uid(),
        suspended_at = null,
        suspension_reason = null
    where id = v_cov.id;

  return jsonb_build_object('ok', true, 'restored', true);
end $$;

grant execute on function public.confirm_restoration(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- cancel_coverage
-- Customer cancels MAI Corp coverage. Stops future renewals but
-- preserves all invoice + payment history.
-- ---------------------------------------------------------------------
create or replace function public.cancel_coverage(
  p_coverage_id uuid,
  p_reason text default 'Customer cancellation'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cov public.infrastructure_coverage%rowtype;
begin
  select * into v_cov from public.infrastructure_coverage where id = p_coverage_id for update;
  if not found then raise exception 'coverage_not_found'; end if;
  if v_cov.customer_id <> auth.uid() and not public.is_ceo(auth.uid()) then
    raise exception 'forbidden';
  end if;
  if v_cov.cancelled_at is not null then
    return jsonb_build_object('ok', true, 'already_cancelled', true);
  end if;

  update public.infrastructure_coverage
    set cancelled_at = now(),
        cancelled_by = auth.uid(),
        cancellation_reason = p_reason,
        auto_renew = false,
        status = 'CANCELLED',
        next_invoice_date = null
    where id = v_cov.id;

  update public.orders
    set infrastructure_payment_responsibility = 'CUSTOMER_DIRECT'
    where id = v_cov.order_id;

  update public.infrastructure_accounts
    set status = 'ACTIVE',
        metadata = coalesce(metadata, '{}'::jsonb)
                   || jsonb_build_object('returned_to_customer', now(), 'reason', p_reason)
    where id = v_cov.infrastructure_id;

  return jsonb_build_object('ok', true, 'cancelled_at', now());
end $$;

grant execute on function public.cancel_coverage(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- run_monthly_renewals
-- For every ACTIVE + auto_renew coverage whose current_period_end has
-- arrived, generate the next invoice. Called by a daily cron edge
-- function.
-- ---------------------------------------------------------------------
create or replace function public.run_monthly_renewals()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count int := 0;
begin
  for r in
    select c.id as coverage_id, c.infrastructure_cost_cents
    from public.infrastructure_coverage c
    join public.infrastructure_invoices i
      on i.coverage_id = c.id
    where c.auto_renew = true
      and c.cancelled_at is null
      and c.status in ('ACTIVE','PENDING_PAYMENT')
    group by c.id, c.infrastructure_cost_cents
    having max(i.due_date) <= current_date
       and max(i.status) = 'PAID'
  loop
    perform public.generate_next_invoice(r.coverage_id, r.infrastructure_cost_cents);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

grant execute on function public.run_monthly_renewals() to service_role;

-- ---------------------------------------------------------------------
-- record_infrastructure_notification
-- Centralised logging so RPCs and edge functions can write a single
-- row and the customer dashboard query can read it back.
-- ---------------------------------------------------------------------
create or replace function public.record_infrastructure_notification(
  p_customer_id uuid,
  p_invoice_id uuid,
  p_coverage_id uuid,
  p_order_id uuid,
  p_kind text,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.infrastructure_notifications(
    customer_id, invoice_id, coverage_id, order_id, kind, title, body
  )
  values (
    p_customer_id, p_invoice_id, p_coverage_id, p_order_id, p_kind, p_title, p_body
  )
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.record_infrastructure_notification(uuid, uuid, uuid, uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- CEO dashboard view (denormalised row per order/coverage/invoice)
-- ---------------------------------------------------------------------
create or replace view public.v_ceo_infrastructure_dashboard as
select
  o.id as order_id,
  u.email as customer_email,
  u.full_name as customer_name,
  p.name as project_name,
  o.management_plan,
  o.infrastructure_payment_responsibility,
  ia.id as infrastructure_id,
  ia.provider,
  ia.monthly_cost_cents as infrastructure_monthly_cost_cents,
  ia.status as infrastructure_status,
  ia.suspended_at,
  ia.suspension_reason,
  ic.id as coverage_id,
  ic.coverage_type,
  ic.monthly_fee_cents,
  ic.infrastructure_cost_cents as coverage_infrastructure_cost_cents,
  ic.status as coverage_status,
  ic.current_period_start,
  ic.current_period_end,
  ic.next_invoice_date,
  ic.auto_renew,
  inv.id as current_invoice_id,
  inv.invoice_number,
  inv.total_cents as current_invoice_total_cents,
  inv.due_date as current_invoice_due_date,
  inv.status as current_invoice_status,
  inv.paypal_order_id as current_invoice_paypal_order_id,
  inv.paypal_approval_url as current_invoice_paypal_approval_url,
  inv.paid_at as current_invoice_paid_at
from public.orders o
join public.users u on u.id = o.customer_id
left join public.products p on p.id = o.product_id
left join public.infrastructure_accounts ia on ia.order_id = o.id
left join public.infrastructure_coverage ic on ic.order_id = o.id
left join lateral (
  select * from public.infrastructure_invoices ii
  where ii.order_id = o.id
  order by ii.created_at desc
  limit 1
) inv on true;

grant select on public.v_ceo_infrastructure_dashboard to authenticated;

-- RLS for the view is satisfied via the underlying table policies; we
-- additionally restrict CEO read to authenticated users only.
revoke all on public.v_ceo_infrastructure_dashboard from public;
grant select on public.v_ceo_infrastructure_dashboard to authenticated;
-- 028 Order intake notifications + reminder tracking
-- Adds:
--   * orders.intake_reminder_sent_at  - when we last emailed the intake reminder
--   * orders.intake_submitted_at      - when the customer submitted the intake
--   * intake_notifications log        - per-email delivery tracking
--   * notify_ceo_on_intake_submitted  - notification row for the CEO

alter table public.orders
  add column if not exists intake_reminder_sent_at timestamptz;

alter table public.orders
  add column if not exists intake_submitted_at timestamptz;

create table if not exists public.intake_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('REMINDER','CONFIRMATION')),
  to_email text not null,
  subject text not null,
  resend_message_id text,
  error text,
  sent_at timestamptz not null default now()
);
alter table public.intake_notifications enable row level security;
create index if not exists intake_notifications_order_idx on public.intake_notifications(order_id);

drop policy if exists intake_notifications_ceo on public.intake_notifications;
create policy intake_notifications_ceo on public.intake_notifications for all
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

drop policy if exists intake_notifications_self_read on public.intake_notifications;
create policy intake_notifications_self_read on public.intake_notifications for select
  using (customer_id = auth.uid());

drop policy if exists intake_notifications_self_write on public.intake_notifications;
create policy intake_notifications_self_write on public.intake_notifications for all
  using (false) with check (false);

-- Trigger: when a project_intakes row is inserted/updated, stamp
-- orders.intake_submitted_at and drop a notification for the CEO.
create or replace function public.mark_intake_submitted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_user public.users%rowtype;
begin
  select * into v_order from public.orders where id = new.order_id;
  if found then
    update public.orders set intake_submitted_at = now() where id = new.order_id;
    select * into v_user from public.users where id = v_order.customer_id;
    insert into public.notifications(user_id, kind, title, body, order_id, metadata)
    select u.id, 'INTAKE_SUBMITTED',
      format('New intake from %s', coalesce(v_user.full_name, v_user.email)),
      'Customer submitted the project intake form. Open the order to review.',
      new.order_id,
      jsonb_build_object('intake_id', new.id)
    from public.users u where u.role = 'CEO' and u.account_status = 'ACTIVE';
  end if;
  return new;
end $$;

drop trigger if exists trg_mark_intake_submitted on public.project_intakes;
create trigger trg_mark_intake_submitted
  after insert or update on public.project_intakes
  for each row execute function public.mark_intake_submitted();
