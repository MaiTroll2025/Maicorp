-- 013 Seed: companies, products, departments, page content, default PTO policy
insert into public.departments(name, description) values
  ('Executive', 'Executive leadership'),
  ('Technology', 'Platform engineering'),
  ('Engineering', 'Product engineering'),
  ('Operations', 'Operations and reliability'),
  ('Marketing', 'Brand, growth, and communications'),
  ('Customer Support', 'Customer-facing support'),
  ('Finance', 'Finance and accounting'),
  ('Human Resources', 'HR and people operations'),
  ('Sales', 'Sales and partnerships'),
  ('Research & Development', 'Research and innovation')
on conflict (name) do nothing;

insert into public.companies(slug, name, tagline, description, status, featured, sort_order, category, launch_date, website, play_url, store_url) values
  ('maitroll', 'MaiTroll', 'LIVE. INTERACT. TROLL.',
   'MaiTroll is a social / live entertainment platform designed around interaction, community, creators, broadcasting, and entertainment.',
   'LIVE', true, 10, 'ENTERTAINMENT', null, null, null, null),
  ('otach', 'Otach', 'Understand your vehicle. Save money. Drive smarter.',
   'Otach is positioned as a step-by-step OBD-II diagnostic and education companion designed to help drivers understand what is happening with their vehicle, learn how repairs work, save money where possible, and avoid being taken advantage of by dishonest or unnecessarily expensive mechanics and dealerships.',
   'IN_DEVELOPMENT', true, 20, 'AUTOMOTIVE', null, null, null, null),
  ('udryve', 'Udryve', 'The next generation driver platform.',
   'Udryve allows drivers to complete deliveries while earning through the MAI Corp ecosystem, with a roadmap exploring partnerships with insurance and roadside-assistance providers and a future MAI Corp-operated roadside service.',
   'IN_DEVELOPMENT', true, 30, 'LOGISTICS', null, null, null, null),
  ('mai-dash', 'MAI Dash', 'Connect. Service. Get it done.',
   'MAI Dash is a marketplace for everyday service needs — mechanics, plumbers, construction, electricians, contractors, home services, automotive services, and local professionals.',
   'COMING_SOON', true, 40, 'MARKETPLACE', null, null, null, null)
on conflict (slug) do nothing;

insert into public.products(slug, name, category, description, price_cents, currency, features, status, featured, sort_order, estimated_delivery, management_available) values
  ('starter-website', 'Starter Website', 'WEBSITES',
   'A premium starter website for small businesses and personal brands.',
   99900, 'USD',
   '["5–7 pages","Mobile responsive","Contact form","Basic SEO","Deployment","2 revisions"]'::jsonb,
   'AVAILABLE', true, 10, '5–7 business days', true),
  ('business-website', 'Business Website', 'WEBSITES',
   'A polished website for growing businesses with richer content and integrations.',
   249900, 'USD',
   '["8–12 pages","Custom design","SEO","Forms","Integrations","Analytics","3 revisions"]'::jsonb,
   'AVAILABLE', true, 20, '2–3 weeks', true),
  ('professional-website', 'Professional Website', 'WEBSITES',
   'A high-end corporate website with refined animations, integrations and content modeling.',
   499900, 'USD',
   '["Premium custom design","Animations","Advanced integrations","CMS / content management","Advanced SEO","Unlimited revisions during build"]'::jsonb,
   'AVAILABLE', true, 30, '3–5 weeks', true),
  ('ecommerce-website', 'E-Commerce Website', 'ECOMMERCE',
   'A complete storefront with full products, cart, checkout, orders, customer accounts, payments, and admin management.',
   699900, 'USD',
   '["Full storefront","Products","Cart","Checkout","Orders","Customer accounts","Payment integration","Admin management","Inventory","Tax handling"]'::jsonb,
   'AVAILABLE', true, 10, '4–6 weeks', true),
  ('custom-platform', 'Custom Platform', 'CUSTOM',
   'A custom web platform built around your business workflows. Starting at $9,999.',
   999900, 'USD',
   '["Bespoke architecture","Tailored UX","API integrations","Custom dashboards","Security review","Discovery + architecture + implementation"]'::jsonb,
   'AVAILABLE', true, 10, 'Quoted per scope', true),
  ('custom-application', 'Custom Application', 'CUSTOM',
   'A custom web application built end-to-end. Starting at $4,999.',
   499900, 'USD',
   '["Frontend","Backend","Database","Auth","Deployment","Maintenance guidance"]'::jsonb,
   'AVAILABLE', false, 20, 'Quoted per scope', true),
  ('custom-project', 'Custom Project', 'CUSTOM',
   'A custom technology project of any shape or size.',
   0, 'USD',
   '["Discovery","Architecture","Implementation","QA","Launch","Handoff"]'::jsonb,
   'AVAILABLE', false, 30, 'Quoted per scope', true)
on conflict (slug) do nothing;

insert into public.pto_policies(name, annual_hours, accrual)
values ('Standard PTO', 80, 'MONTHLY')
on conflict (name) do nothing;

insert into public.page_content(key, value) values
  ('hero.headline', jsonb_build_object('lines', jsonb_build_array('BUILDING','TECHNOLOGY','WITH PURPOSE.'))),
  ('hero.subhead', jsonb_build_object('text', 'With the help of AI, I was able to create and develop apps designed to bring people joy, create opportunities, and help people earn money from home.')),
  ('hero.cta_primary', jsonb_build_object('label', 'Explore Our Companies', 'href', '/companies')),
  ('hero.cta_secondary', jsonb_build_object('label', 'Meet MAI Corp', 'href', '/about')),
  ('mission.title', jsonb_build_object('text', 'THE MAI CORP MISSION')),
  ('mission.body', jsonb_build_array(
    'MAI Corp was built on a simple idea: people deserve better.',
    'Whether you''re a customer, user, driver, contractor, broadcaster, creator, or employee, your time and effort have value.',
    'We believe technology should create opportunity — not simply take from the people using it.',
    'From day one, customer service has been at the heart of MAI Corp. As CEO, I strive to build platforms where people can enjoy themselves, earn, connect, and become something better than they were yesterday.',
    'Our goal isn''t just to build apps. It''s to build opportunities.'
  )),
  ('mission.attribution', jsonb_build_object('name', 'Joshua Tucker', 'title', 'CEO, MAI Corp')),
  ('infrastructure.disclaimer', jsonb_build_object('text', 'MAI Corp management fees cover the management and maintenance services provided by MAI Corp. Customers are responsible for third-party infrastructure and service costs required to operate their website or application, including hosting, domains, databases, email services, storage, payment processing, APIs, and other applicable services.')),
  ('support.headline', jsonb_build_object('text', 'HELP US BUILD WHAT''S NEXT')),
  ('support.body', jsonb_build_object('text', 'MAI Corp is building technology designed around people, opportunity, entertainment, and connection. If you believe in what we''re building and want to help us create the next generation of apps and platforms, you can support the mission.'))
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.schema_migrations(name, checksum, version, status)
values ('bootstrap-2026-09-03-001', md5('bootstrap-2026-09-03-001'), '2026.09.03.001', 'APPLIED')
on conflict (name) do nothing;