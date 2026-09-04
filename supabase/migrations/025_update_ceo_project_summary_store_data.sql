-- 025 Include separate Apple and Google publishing data in the CEO project summary
 drop function if exists public.get_ceo_project_summaries();
create function public.get_ceo_project_summaries()
returns table (
  order_id uuid,
  order_status text,
  order_created_at timestamptz,
  customer_name text,
  customer_email text,
  product_name text,
  management_plan text,
  current_stage text,
  progress_percent int,
  estimated_completion date,
  store_account_owner text,
  latest_message text,
  latest_sender_role text,
  latest_message_at timestamptz,
  unread_count bigint,
  apple_account_owner text,
  google_account_owner text,
  apple_status text,
  google_status text,
  management_enabled boolean,
  monthly_fee_cents integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.status,
    o.created_at,
    u.full_name,
    u.email,
    p.name,
    o.management_plan,
    coalesce(pp.current_stage, 'ORDER_RECEIVED'),
    coalesce(pp.progress_percent, 0),
    pp.estimated_completion,
    coalesce(pp.store_account_owner, 'CUSTOMER'),
    latest.message,
    latest.sender_role,
    latest.created_at,
    (select count(*) from public.order_messages unread
      where unread.order_id = o.id
        and unread.sender_role = 'CUSTOMER'
        and unread.read_at is null
        and unread.deleted_at is null),
    coalesce(psm.apple_account_owner, 'CUSTOMER'),
    coalesce(psm.google_account_owner, 'CUSTOMER'),
    coalesce(psm.apple_status, 'NOT_STARTED'),
    coalesce(psm.google_status, 'NOT_STARTED'),
    coalesce(psm.management_enabled, false),
    psm.monthly_fee_cents
  from public.orders o
  join public.users u on u.id = o.customer_id
  left join public.products p on p.id = o.product_id
  left join public.project_progress pp on pp.order_id = o.id
  left join public.project_store_management psm on psm.order_id = o.id
  left join lateral (
    select m.message, m.sender_role, m.created_at
    from public.order_messages m
    where m.order_id = o.id and m.deleted_at is null
    order by m.created_at desc
    limit 1
  ) latest on true
  where public.is_ceo(auth.uid())
  order by coalesce(latest.created_at, o.created_at) desc;
$$;
revoke execute on function public.get_ceo_project_summaries() from public;
grant execute on function public.get_ceo_project_summaries() to authenticated;
