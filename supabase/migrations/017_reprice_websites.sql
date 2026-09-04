-- 017 Re-price website products (CEO pricing update)
update public.products set
  description = 'A premium starter website for small businesses and personal brands.',
  price_cents = 99900,
  features = '["5–7 pages","Mobile responsive","Contact form","Basic SEO","Deployment","2 revisions"]'::jsonb,
  estimated_delivery = '5–7 business days'
where slug = 'starter-website';

update public.products set
  description = 'A polished website for growing businesses with richer content and integrations.',
  price_cents = 249900,
  features = '["8–12 pages","Custom design","SEO","Forms","Integrations","Analytics","3 revisions"]'::jsonb,
  estimated_delivery = '2–3 weeks'
where slug = 'business-website';

update public.products set
  description = 'A high-end corporate website with refined animations, integrations and content modeling.',
  price_cents = 499900,
  features = '["Premium custom design","Animations","Advanced integrations","CMS / content management","Advanced SEO","Unlimited revisions during build"]'::jsonb,
  estimated_delivery = '3–5 weeks'
where slug = 'professional-website';

update public.products set
  description = 'A complete storefront with full products, cart, checkout, orders, customer accounts, payments, and admin management.',
  price_cents = 699900,
  features = '["Full storefront","Products","Cart","Checkout","Orders","Customer accounts","Payment integration","Admin management","Inventory","Tax handling"]'::jsonb,
  estimated_delivery = '4–6 weeks'
where slug = 'ecommerce-website';

update public.products set
  description = 'A custom web platform built around your business workflows. Starting at $9,999.',
  price_cents = 999900,
  features = '["Bespoke architecture","Tailored UX","API integrations","Custom dashboards","Security review","Discovery + architecture + implementation"]'::jsonb
where slug = 'custom-platform';

update public.products set
  description = 'A custom web application built end-to-end. Starting at $4,999.',
  price_cents = 499900,
  features = '["Frontend","Backend","Database","Auth","Deployment","Maintenance guidance"]'::jsonb
where slug = 'custom-application';

update public.products set
  description = 'A custom technology project of any shape or size. Quoted per scope.',
  price_cents = 0,
  features = '["Discovery","Architecture","Implementation","QA","Launch","Handoff"]'::jsonb
where slug = 'custom-project';