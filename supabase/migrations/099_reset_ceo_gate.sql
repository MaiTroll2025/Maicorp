-- 099 Reset CEO bootstrap gate for fresh projects.
-- Run ONLY on a new project where you intend to bootstrap the first CEO.
-- Removes any stray CEO rows from auth.users / public.users so
-- public_ceo_signup_allowed() returns true again.

delete from public.users where role = 'CEO';
-- (Optional) clear any auth.users you no longer need; comment out if unsure:
-- delete from auth.users where email not in (select email from public.users);