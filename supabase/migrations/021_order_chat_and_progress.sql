-- 021 Private order chat and customer-visible project progress
create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('CUSTOMER','CEO')),
  message text not null check (char_length(trim(message)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  read_at timestamptz,
  deleted_at timestamptz
);
create index if not exists order_messages_order_created_idx on public.order_messages(order_id, created_at desc);
create index if not exists order_messages_sender_idx on public.order_messages(sender_user_id, created_at desc);
alter table public.order_messages enable row level security;
drop policy if exists order_messages_read on public.order_messages;
create policy order_messages_read on public.order_messages for select using (
  public.is_ceo(auth.uid()) or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
);
drop policy if exists order_messages_insert on public.order_messages;
create policy order_messages_insert on public.order_messages for insert with check (
  sender_user_id = auth.uid() and (
    (sender_role = 'CEO' and public.is_ceo(auth.uid())) or
    (sender_role = 'CUSTOMER' and exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()))
  )
);
drop policy if exists order_messages_update on public.order_messages;
create policy order_messages_update on public.order_messages for update using (
  public.is_ceo(auth.uid()) or sender_user_id = auth.uid()
) with check (
  public.is_ceo(auth.uid()) or sender_user_id = auth.uid()
);

create table if not exists public.project_progress (
  order_id uuid primary key references public.orders(id) on delete cascade,
  current_stage text not null default 'ORDER_RECEIVED',
  progress_percent int not null default 0 check (progress_percent between 0 and 100),
  customer_visible boolean not null default true,
  customer_message text,
  estimated_completion date,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);
alter table public.project_progress enable row level security;
drop policy if exists project_progress_customer_read on public.project_progress;
create policy project_progress_customer_read on public.project_progress for select using (
  customer_visible and exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
);
drop policy if exists project_progress_ceo on public.project_progress;
create policy project_progress_ceo on public.project_progress for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

create table if not exists public.project_progress_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  previous_stage text,
  new_stage text not null,
  previous_percent int,
  new_percent int not null,
  note text,
  customer_visible boolean not null default true,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists project_progress_history_order_idx on public.project_progress_history(order_id, created_at desc);
alter table public.project_progress_history enable row level security;
drop policy if exists project_progress_history_customer_read on public.project_progress_history;
create policy project_progress_history_customer_read on public.project_progress_history for select using (
  customer_visible and exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
);
drop policy if exists project_progress_history_ceo on public.project_progress_history;
create policy project_progress_history_ceo on public.project_progress_history for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

create table if not exists public.project_internal_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  author_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_internal_notes_order_idx on public.project_internal_notes(order_id, created_at desc);
alter table public.project_internal_notes enable row level security;
drop policy if exists project_internal_notes_ceo on public.project_internal_notes;
create policy project_internal_notes_ceo on public.project_internal_notes for all using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

alter table public.notifications add column if not exists order_id uuid references public.orders(id) on delete cascade;
alter table public.notifications add column if not exists metadata jsonb not null default '{}';
create index if not exists notifications_user_unread_idx on public.notifications(user_id, read_at, created_at desc);

create or replace function public.notify_order_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recipient uuid;
  order_name text;
begin
  select coalesce(p.name, 'Project') into order_name
  from public.orders o left join public.products p on p.id = o.product_id where o.id = new.order_id;
  if new.sender_role = 'CUSTOMER' then
    for recipient in select id from public.users where role = 'CEO' loop
      insert into public.notifications(user_id, kind, title, body, order_id, metadata)
      values (recipient, 'ORDER_MESSAGE', 'New customer message', left(new.message, 160), new.order_id, jsonb_build_object('project', order_name, 'message_id', new.id));
    end loop;
  else
    select customer_id into recipient from public.orders where id = new.order_id;
    if recipient is not null then
      insert into public.notifications(user_id, kind, title, body, order_id, metadata)
      values (recipient, 'ORDER_MESSAGE', 'New message from MAI Corp', left(new.message, 160), new.order_id, jsonb_build_object('project', order_name, 'message_id', new.id));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists order_message_notification on public.order_messages;
create trigger order_message_notification after insert on public.order_messages for each row execute function public.notify_order_message();

create or replace function public.mark_order_messages_read(p_order_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.order_messages m
  set read_at = coalesce(read_at, now())
  where m.order_id = p_order_id
    and m.sender_user_id <> auth.uid()
    and (public.is_ceo(auth.uid()) or exists (select 1 from public.orders o where o.id = m.order_id and o.customer_id = auth.uid()));
$$;

create or replace function public.record_project_progress_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  order_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.project_progress_history(order_id, new_stage, new_percent, note, customer_visible, changed_by)
    values (new.order_id, new.current_stage, new.progress_percent, new.customer_message, new.customer_visible, new.updated_by);
  elsif old.current_stage is distinct from new.current_stage or old.progress_percent is distinct from new.progress_percent or old.customer_message is distinct from new.customer_message or old.customer_visible is distinct from new.customer_visible then
    insert into public.project_progress_history(order_id, previous_stage, new_stage, previous_percent, new_percent, note, customer_visible, changed_by)
    values (new.order_id, old.current_stage, new.current_stage, old.progress_percent, new.progress_percent, new.customer_message, new.customer_visible, new.updated_by);
    if new.customer_visible and (old.current_stage is distinct from new.current_stage or old.progress_percent is distinct from new.progress_percent) then
      select coalesce(p.name, 'Project') into order_name from public.orders o left join public.products p on p.id = o.product_id where o.id = new.order_id;
      insert into public.notifications(user_id, kind, title, body, order_id, metadata)
      select o.customer_id, 'PROJECT_PROGRESS', 'Your project has been updated', coalesce(new.customer_message, order_name || ' is now ' || replace(new.current_stage, '_', ' ')), new.order_id, jsonb_build_object('stage', new.current_stage, 'percent', new.progress_percent)
      from public.orders o where o.id = new.order_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists project_progress_history_trigger on public.project_progress;
create trigger project_progress_history_trigger after insert or update on public.project_progress for each row execute function public.record_project_progress_change();

do $$ begin
  alter publication supabase_realtime add table public.order_messages;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.project_progress;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
