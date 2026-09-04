-- 018 Add revision_rounds column to products
alter table public.products add column if not exists revision_rounds int not null default 0;

-- Replace existing vertical products with the canonical CEO pricing + revision rounds.
-- Using on conflict do update so re-running is safe.
insert into public.products(slug, name, category, description, price_cents, currency, features, status, featured, sort_order, estimated_delivery, management_available, revision_rounds) values
  ('mechanic-auto-shop',          'Mechanic & Auto Shop',          'INDUSTRY_VERTICALS',
   'A complete mechanic & auto-shop platform: online booking, repair order tracking, VIN-driven vehicle profiles, parts & labor, technician assignments, customer estimates & approvals, and review collection.',
   129900, 'USD',
   '["Online booking","Repair order tracking","VIN-driven vehicle profiles","Parts & labor estimates","Customer estimate approvals","Technician assignments","Photo updates","Customer notifications","Reviews","Insurance-ready export"]'::jsonb,
   'AVAILABLE', true, 10, '4–5 weeks', true, 10),

  ('barber-beauty',               'Barber & Beauty',               'INDUSTRY_VERTICALS',
   'A premium barber & beauty booking platform: services, stylist profiles, walk-in queue, retail POS, memberships, gift cards, and tipping.',
   149900, 'USD',
   '["Service menu","Stylist profiles","Online booking","Walk-in queue","Retail POS","Memberships","Gift cards","Loyalty rewards","Reviews","Tipping"]'::jsonb,
   'AVAILABLE', true, 20, '3–4 weeks', true, 10),

  ('restaurant-food',             'Restaurant & Food',             'INDUSTRY_VERTICALS',
   'Online ordering, reservations, kitchen display, table management, QR ordering, loyalty, and allergen flags for cafés, food trucks, and full-service restaurants.',
   199900, 'USD',
   '["Online ordering","Reservations","Table management","Kitchen display","QR ordering","Loyalty","Delivery zones","Allergen flags","Tip prompts","Reports"]'::jsonb,
   'AVAILABLE', true, 30, '3–5 weeks', true, 12),

  ('creator-social',              'Creator & Social',              'INDUSTRY_VERTICALS',
   'Subscriptions, exclusive posts, livestream scheduling, direct messaging, and merchandise for creators, artists, and personalities.',
   249900, 'USD',
   '["Subscriptions","Exclusive posts","Livestream schedule","Direct messaging","Tipping","Merch","Fan tiers","Analytics","Push notifications"]'::jsonb,
   'AVAILABLE', true, 40, '4–5 weeks', true, 15),

  ('broadcasting-streaming',      'Broadcasting & Streaming',      'INDUSTRY_VERTICALS',
   'Multi-stream ingest, viewer analytics, real-time chat, presence, creator monetization, recording library, and premium moderation — built on MaiTroll-grade architecture.',
   349900, 'USD',
   '["Multi-stream ingest","Viewer analytics","Real-time chat","Presence","Creator monetization","Recording library","RTMP / WebRTC","Tipping & gifts","Moderation","Branded overlays"]'::jsonb,
   'AVAILABLE', true, 50, '6–8 weeks', true, 15),

  ('real-estate-pro',             'Real Estate',                   'INDUSTRY_VERTICALS',
   'MLS-ready listings, agent profiles, scheduling, lead capture, and CRM workflows for agencies and independent agents.',
   249900, 'USD',
   '["Listings","Agent profiles","Scheduling","Lead capture","CRM","Saved searches","Map search","Virtual tours","Document signing"]'::jsonb,
   'AVAILABLE', true, 60, '4–6 weeks', true, 12),

  ('fitness-personal-training',   'Fitness & Personal Training',   'INDUSTRY_VERTICALS',
   'Class scheduling, memberships, trainer bookings, body metrics, workout library, and retention reporting for gyms and trainers.',
   179900, 'USD',
   '["Class scheduling","Memberships","Trainer bookings","Body metrics","Workout library","Nutrition logs","Check-in","Billing","Retention reports"]'::jsonb,
   'AVAILABLE', true, 70, '4–5 weeks', true, 12),

  ('professional-services',       'Professional Services',         'INDUSTRY_VERTICALS',
   'Job estimates, scheduling, crews, materials, invoicing, and customer updates for contractors, plumbers, electricians, and specialty trades.',
   179900, 'USD',
   '["Job estimates","Crew scheduling","Materials tracking","Invoicing","Customer updates","Photo logs","Change orders","Payments"]'::jsonb,
   'AVAILABLE', true, 80, '3–5 weeks', true, 12),

  ('online-store',                'Online Store',                  'INDUSTRY_VERTICALS',
   'A complete online-store platform with storefront, products, cart, checkout, orders, customer accounts, payment integration, and admin management.',
   499900, 'USD',
   '["Storefront","Products","Cart","Checkout","Orders","Customer accounts","Payment integration","Admin management","Inventory","Tax handling","Discounts","Shipping zones","Reviews"]'::jsonb,
   'AVAILABLE', true, 90, '4–6 weeks', true, 15),

  ('custom-business-platform',    'Custom Business Platform',      'INDUSTRY_VERTICALS',
   'A bespoke end-to-end business platform built around your workflows. Starts at $12,999 and scales with discovery, architecture, integration, and ongoing operation.',
   1299900, 'USD',
   '["Bespoke architecture","Tailored UX","API integrations","Custom dashboards","Workflow automation","Security review","Discovery + architecture + implementation + QA","Multi-region rollout","Onboarding","Operations playbooks"]'::jsonb,
   'AVAILABLE', true, 100, 'Quoted per scope', true, 20)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  features = excluded.features,
  estimated_delivery = excluded.estimated_delivery,
  revision_rounds = excluded.revision_rounds,
  status = 'AVAILABLE',
  featured = excluded.featured,
  sort_order = excluded.sort_order,
  management_available = excluded.management_available,
  category = excluded.category;

-- Disable the older per-tier vertical duplicates that were inserted by
-- migration 015 to avoid confusing the storefront. Keep the canonical
-- version (e.g. 'mechanic-auto-shop') and hide the legacy variants.
update public.products set status = 'RETIRED'
where slug in (
  'barbershop-starter',
  'tutoring-starter',
  'church-nonprofit-starter',
  'restaurant-pro',
  'salon-spa-pro',
  'gym-fitness-pro',
  'event-booking-pro',
  'auto-repair-pro',
  'contractor-pro',
  'broadcast-platform'
);