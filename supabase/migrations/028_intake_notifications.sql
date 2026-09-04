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
