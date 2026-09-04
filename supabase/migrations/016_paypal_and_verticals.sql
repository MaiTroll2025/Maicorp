-- 016 PayPal event idempotency + secret references
create table if not exists public.paypal_events (
  event_id text primary key,
  event_type text,
  processed_at timestamptz not null default now()
);
alter table public.paypal_events enable row level security;
drop policy if exists paypal_events_ceo on public.paypal_events;
create policy paypal_events_ceo on public.paypal_events for all
  using (public.is_ceo(auth.uid())) with check (public.is_ceo(auth.uid()));

-- Seed config placeholders for the new industry-vertical categories
insert into public.page_content(key, value) values
  ('store.verticals.intro', jsonb_build_object(
    'title', 'Industry-specific apps, built for the people who use them.',
    'body', 'From barbershops to broadcast platforms — MAI Corp builds the technology your business depends on. Pick a starter, a pro tier, or the flagship broadcast package. Every plan includes optional monthly management.'
  ))
on conflict (key) do update set value = excluded.value, updated_at = now();