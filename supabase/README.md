# MAI CORP — Database Setup

Apply these migrations **in order** in the Supabase SQL editor
(Database → SQL editor → New query → paste → Run).

Project: `jkavykrzaygeiwjjmlma`

The migrations are idempotent and use `create table if not exists`
plus `drop policy if exists` so re-running is safe.

You can apply each file one at a time, or run the consolidated
`supabase/CONSOLIDATED.sql` file as a single script.

After applying, confirm:

```sql
select count(*) from public.users;
select count(*) from public.companies;
select count(*) from public.products;
select count(*) from public.departments;
```

Each should return non-zero after migrations are applied.

Recommended order:

1. `001_init_helpers_and_identity.sql`
2. `002_hr_core.sql`
3. `003_time_schedules.sql`
4. `004_pto.sql`
5. `005_payroll.sql`
6. `006_hr_support.sql`
7. `007_bug_blocker.sql`
8. `008_marketing.sql`
9. `009_platforms.sql`
10. `010_rpcs_hr.sql`
12. `011_rpcs_clock.sql`
13. `012_rpcs_payroll.sql`
14. `013_seed.sql`
15. `014_ceo_bootstrap.sql`

After 014 runs, the very first CEO signup at `/ceo/signup` is allowed
server-side. Once a CEO row exists, the exception closes.