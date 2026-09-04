-- 015 Store verticals: 10+ industry-specific app categories
-- Pricing tiers per CEO directive:
--   Starter vertical apps: $99
--   Mid-tier verticals: $199-$299
--   Pro / heavy verticals: $399-$499
--   Broadcast platform: $499
--   Broadcast app + platform: $599 (highest)
insert into public.products(slug, name, category, description, price_cents, currency, features, status, featured, sort_order, estimated_delivery, management_available) values
  -- $99 starter tier
  ('barbershop-starter', 'Barbershop App — Starter', 'INDUSTRY_VERTICALS',
   'A complete barbershop booking platform: online appointments, barber schedules, walk-in queue, and SMS reminders.',
   9900, 'USD',
   '["Online booking","Barber schedules","Walk-in queue","SMS reminders","Customer profiles"]'::jsonb,
   'AVAILABLE', true, 10, '3–4 weeks', true),

  ('tutoring-starter', 'Tutoring & Coaching App — Starter', 'INDUSTRY_VERTICALS',
   '1:1 and group bookings, course content, progress tracking, and recurring revenue.',
   9900, 'USD',
   '["1:1 booking","Group sessions","Course content","Progress tracking","Subscriptions"]'::jsonb,
   'AVAILABLE', false, 15, '3–4 weeks', true),

  ('church-nonprofit-starter', 'Church & Nonprofit App — Starter', 'INDUSTRY_VERTICALS',
   'Events, content, groups, giving, and volunteer scheduling.',
   9900, 'USD',
   '["Events","Sermons / content","Groups","Giving","Volunteer scheduling"]'::jsonb,
   'AVAILABLE', false, 18, '3–4 weeks', true),

  -- $199 tier
  ('restaurant-pro', 'Restaurant App — Pro', 'INDUSTRY_VERTICALS',
   'Online ordering, reservations, table management, kitchen display, QR ordering, and loyalty.',
   19900, 'USD',
   '["Online ordering","Reservations","Table management","Kitchen display","QR ordering","Loyalty","Tip prompts"]'::jsonb,
   'AVAILABLE', true, 30, '3–4 weeks', true),

  ('salon-spa-pro', 'Salon & Spa App — Pro', 'INDUSTRY_VERTICALS',
   'Booking, service menus, stylist profiles, retail, memberships, and gift cards.',
   19900, 'USD',
   '["Service menus","Stylist profiles","Booking","Retail","Memberships","Gift cards"]'::jsonb,
   'AVAILABLE', false, 35, '3–4 weeks', true),

  ('gym-fitness-pro', 'Gym & Fitness App — Pro', 'INDUSTRY_VERTICALS',
   'Class scheduling, memberships, trainer bookings, body metrics, and workout library.',
   19900, 'USD',
   '["Class scheduling","Memberships","Trainer bookings","Body metrics","Workout library","Billing"]'::jsonb,
   'AVAILABLE', false, 38, '3–4 weeks', true),

  ('event-booking-pro', 'Event Booking App — Pro', 'INDUSTRY_VERTICALS',
   'Ticketing, RSVPs, capacity management, attendee check-in, and event-branded pages.',
   19900, 'USD',
   '["Ticketing","RSVPs","Capacity","Check-in","Branded pages","Discount codes","Refunds"]'::jsonb,
   'AVAILABLE', false, 42, '3–4 weeks', true),

  -- $299 tier
  ('auto-repair-pro', 'Auto Repair Shop App — Pro', 'INDUSTRY_VERTICALS',
   'Vehicle intake, repair-order tracking, parts & labor estimates, technician assignments, and customer approvals.',
   29900, 'USD',
   '["Repair order tracking","VIN-driven vehicle profiles","Estimate approvals","Technician assignments","Parts & labor","Customer notifications"]'::jsonb,
   'AVAILABLE', true, 20, '4–5 weeks', true),

  ('contractor-pro', 'Contractor Services App — Pro', 'INDUSTRY_VERTICALS',
   'Job estimates, scheduling, crews, materials, invoicing, and customer updates for general and specialty contractors.',
   29900, 'USD',
   '["Job estimates","Crew scheduling","Materials tracking","Invoicing","Customer updates","Photo logs","Change orders"]'::jsonb,
   'AVAILABLE', false, 70, '3–5 weeks', true),

  -- $399 tier
  ('real-estate-pro', 'Real Estate App — Pro', 'INDUSTRY_VERTICALS',
   'MLS-ready listings, agent profiles, scheduling, lead capture, and CRM workflows.',
   39900, 'USD',
   '["Listings","Agent profiles","Scheduling","Lead capture","CRM","Saved searches","Map search","Virtual tours"]'::jsonb,
   'AVAILABLE', false, 60, '4–6 weeks', true),

  -- $499 - broadcast platform
  ('broadcast-platform', 'Broadcast Platform', 'INDUSTRY_VERTICALS',
   'A premium live-broadcast platform with multi-stream ingest, viewer analytics, real-time chat, presence, and creator monetization. Built on the MaiTroll-grade architecture.',
   49900, 'USD',
   '["Multi-stream ingest","Viewer analytics","Real-time chat","Presence","Creator monetization","Recording library","RTMP / WebRTC support","Tipping & gifts","Moderation","Branded overlays"]'::jsonb,
   'AVAILABLE', true, 5, '6–8 weeks', true),

  -- $599 - broadcast app + platform (highest tier)
  ('broadcast-app-and-platform', 'Broadcast App + Platform', 'INDUSTRY_VERTICALS',
   'The flagship offering: a complete custom broadcast ecosystem — branded mobile app, web app, and platform backend with creator accounts, subscriptions, payouts, and end-to-end monetization.',
   59900, 'USD',
   '["Branded mobile app","Branded web app","Creator accounts","Subscriptions","Payouts","Live broadcasts","Replays","Push notifications","In-app chat","Gifting & tipping","End-to-end monetization","Premium analytics","Priority support"]'::jsonb,
   'AVAILABLE', true, 1, '8–12 weeks', true)
on conflict (slug) do nothing;