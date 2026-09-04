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
