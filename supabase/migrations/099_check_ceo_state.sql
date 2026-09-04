-- Reset CEO bootstrap gate for the new Supabase project
select id, email, role, account_status, employment_status from public.users where role = 'CEO';
select id, email from auth.users;