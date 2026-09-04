-- 014 CEO bootstrap exception
-- The very first CEO account must be creatable through the public
-- signup flow. Once a CEO exists, this exception closes and only
-- existing CEOs may insert into public.users with role='CEO'.

create or replace function public.is_first_ceo_bootstrap()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (select 1 from public.users where role = 'CEO');
$$;

drop policy if exists users_ceo_write on public.users;
create policy users_ceo_write on public.users for all
  using (public.is_ceo(auth.uid()))
  with check (public.is_ceo(auth.uid()) or public.is_first_ceo_bootstrap());

-- Allow a freshly signed-up CEO to create their own row before
-- the role check fires (auth.uid() matches the row id).
drop policy if exists users_self_insert on public.users;
create policy users_self_insert on public.users for insert
  with check (id = auth.uid());

-- And let them read their own row even before is_ceo resolves true.
drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users for select
  using (id = auth.uid() or public.is_ceo(auth.uid()));

-- Allow the authenticated user to update their own profile (name only);
-- do NOT permit self-elevation to CEO/HR_MANAGER — that path goes
-- through the CEO-only RLS gate above.
drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.users where id = auth.uid())
    and employment_status = (select employment_status from public.users where id = auth.uid())
    and account_status = (select account_status from public.users where id = auth.uid())
  );