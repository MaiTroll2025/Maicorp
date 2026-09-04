-- 022 Standardize project lifecycle and store-account ownership
-- Normalize legacy stage names before enforcing the canonical lifecycle.
drop policy if exists order_messages_update on public.order_messages;
create policy order_messages_update on public.order_messages for update using (
  public.is_ceo(auth.uid())
) with check (
  public.is_ceo(auth.uid())
);

update public.project_progress
set current_stage = case current_stage
  when 'REQUIREMENTS_CONFIRMED' then 'PLANNING'
  when 'IN_DEVELOPMENT' then 'DEVELOPMENT'
  when 'FINAL_APPROVAL' then 'LAUNCH_READY'
  when 'DEPLOYMENT' then 'LAUNCH_READY'
  when 'LAUNCH' then 'LAUNCHED'
  else current_stage
end
where current_stage in ('REQUIREMENTS_CONFIRMED', 'IN_DEVELOPMENT', 'FINAL_APPROVAL', 'DEPLOYMENT', 'LAUNCH');

update public.project_progress_history
set previous_stage = case previous_stage
  when 'REQUIREMENTS_CONFIRMED' then 'PLANNING'
  when 'IN_DEVELOPMENT' then 'DEVELOPMENT'
  when 'FINAL_APPROVAL' then 'LAUNCH_READY'
  when 'DEPLOYMENT' then 'LAUNCH_READY'
  when 'LAUNCH' then 'LAUNCHED'
  else previous_stage
end,
new_stage = case new_stage
  when 'REQUIREMENTS_CONFIRMED' then 'PLANNING'
  when 'IN_DEVELOPMENT' then 'DEVELOPMENT'
  when 'FINAL_APPROVAL' then 'LAUNCH_READY'
  when 'DEPLOYMENT' then 'LAUNCH_READY'
  when 'LAUNCH' then 'LAUNCHED'
  else new_stage
end
where previous_stage in ('REQUIREMENTS_CONFIRMED', 'IN_DEVELOPMENT', 'FINAL_APPROVAL', 'DEPLOYMENT', 'LAUNCH')
   or new_stage in ('REQUIREMENTS_CONFIRMED', 'IN_DEVELOPMENT', 'FINAL_APPROVAL', 'DEPLOYMENT', 'LAUNCH');

alter table public.project_progress
  add column if not exists store_account_owner text not null default 'CUSTOMER';

update public.project_progress
set current_stage = 'ORDER_RECEIVED'
where current_stage not in (
  'ORDER_RECEIVED', 'PAYMENT_CONFIRMED', 'PLANNING', 'DESIGN', 'DEVELOPMENT',
  'CUSTOMER_REVIEW', 'REVISIONS', 'TESTING', 'STORE_SUBMISSION', 'STORE_REVIEW',
  'LAUNCH_READY', 'LAUNCHED', 'MANAGEMENT', 'COMPLETED'
);

update public.project_progress_history
set new_stage = 'ORDER_RECEIVED'
where new_stage not in (
  'ORDER_RECEIVED', 'PAYMENT_CONFIRMED', 'PLANNING', 'DESIGN', 'DEVELOPMENT',
  'CUSTOMER_REVIEW', 'REVISIONS', 'TESTING', 'STORE_SUBMISSION', 'STORE_REVIEW',
  'LAUNCH_READY', 'LAUNCHED', 'MANAGEMENT', 'COMPLETED'
);
update public.project_progress_history
set previous_stage = null
where previous_stage is not null and previous_stage not in (
  'ORDER_RECEIVED', 'PAYMENT_CONFIRMED', 'PLANNING', 'DESIGN', 'DEVELOPMENT',
  'CUSTOMER_REVIEW', 'REVISIONS', 'TESTING', 'STORE_SUBMISSION', 'STORE_REVIEW',
  'LAUNCH_READY', 'LAUNCHED', 'MANAGEMENT', 'COMPLETED'
);

alter table public.project_progress
  drop constraint if exists project_progress_store_account_owner_check;
alter table public.project_progress
  add constraint project_progress_store_account_owner_check
  check (store_account_owner in ('CUSTOMER', 'MAI_CORP'));

alter table public.project_progress
  drop constraint if exists project_progress_current_stage_check;
alter table public.project_progress
  add constraint project_progress_current_stage_check
  check (current_stage in (
    'ORDER_RECEIVED', 'PAYMENT_CONFIRMED', 'PLANNING', 'DESIGN', 'DEVELOPMENT',
    'CUSTOMER_REVIEW', 'REVISIONS', 'TESTING', 'STORE_SUBMISSION', 'STORE_REVIEW',
    'LAUNCH_READY', 'LAUNCHED', 'MANAGEMENT', 'COMPLETED'
  ));

alter table public.project_progress_history
  drop constraint if exists project_progress_history_new_stage_check;
alter table public.project_progress_history
  add constraint project_progress_history_new_stage_check
  check (new_stage in (
    'ORDER_RECEIVED', 'PAYMENT_CONFIRMED', 'PLANNING', 'DESIGN', 'DEVELOPMENT',
    'CUSTOMER_REVIEW', 'REVISIONS', 'TESTING', 'STORE_SUBMISSION', 'STORE_REVIEW',
    'LAUNCH_READY', 'LAUNCHED', 'MANAGEMENT', 'COMPLETED'
  ));

alter table public.project_progress_history
  drop constraint if exists project_progress_history_previous_stage_check;
alter table public.project_progress_history
  add constraint project_progress_history_previous_stage_check
  check (previous_stage is null or previous_stage in (
    'ORDER_RECEIVED', 'PAYMENT_CONFIRMED', 'PLANNING', 'DESIGN', 'DEVELOPMENT',
    'CUSTOMER_REVIEW', 'REVISIONS', 'TESTING', 'STORE_SUBMISSION', 'STORE_REVIEW',
    'LAUNCH_READY', 'LAUNCHED', 'MANAGEMENT', 'COMPLETED'
  ));

create or replace function public.sync_payment_confirmed_progress()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'PAID' and old.status is distinct from new.status then
    insert into public.project_progress(order_id, current_stage, progress_percent, customer_visible, updated_at)
    values (new.id, 'PAYMENT_CONFIRMED', 5, true, now())
    on conflict (order_id) do update
      set current_stage = case when project_progress.current_stage = 'ORDER_RECEIVED' then 'PAYMENT_CONFIRMED' else project_progress.current_stage end,
          progress_percent = case when project_progress.current_stage = 'ORDER_RECEIVED' then greatest(project_progress.progress_percent, 5) else project_progress.progress_percent end,
          updated_at = now();
  end if;
  return new;
end $$;
drop trigger if exists orders_payment_progress on public.orders;
create trigger orders_payment_progress after update of status on public.orders for each row execute function public.sync_payment_confirmed_progress();
