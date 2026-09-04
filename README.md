# MAI CORP — Headquarters + CEO Command Center

Production-grade corporate platform. Built with **Vite + React 19 + TypeScript + Tailwind v3 + Supabase**.

## Quickstart

```bash
cd maicorp
npm install
npm run dev
```

Open `http://localhost:5173`.

## Database setup

Apply `supabase/CONSOLIDATED.sql` (or the numbered files under `supabase/migrations/`) to your Supabase project via the SQL editor.

The migration creates:

- HR core (departments, positions, employees, employment history)
- Time clock, breaks, timesheets
- PTO policies, balances, requests
- Payroll periods, pay rates, records, deductions, pay stubs
- HR documents, requests, notes, notifications, audit logs
- Bug reports, blocker events, schema migrations
- Marketing schema (companies, products, orders, intakes, infrastructure)
- Page CMS, announcements, contact inbox, donations
- Platforms, secrets, diagnostics

Plus RLS policies, server-side helper functions, and 20+ RPCs (hire, terminate, promote, transfer, suspend, reactivate, place_on_leave, return_from, clock_in, clock_out, start_break, end_break, approve_timesheet, reject_timesheet, submit_timesheet, calculate_payroll, approve_payroll, close_payroll, audit_log, public_ceo_signup_allowed, revoke_user_sessions).

## Environment

`.env`:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_APP_VERSION=2026.09.03.001
```

Server-only secrets (PayPal, service-role keys for diagnostic probes) must be configured through the CEO Dashboard **Secrets** page or your hosting provider's secret store — never via `VITE_*` env vars.

## Roles

- `CEO` — sole administrative authority
- `HR_MANAGER` — workforce operations
- `EMPLOYEE` — user-only access
- `CUSTOMER` — public-facing clients

The `/ceo/signup` page is only available until a valid CEO account exists. After that, it is permanently disabled server-side.

## CEO Command Center

Routes under `/ceo`:

```
/ceo                          overview dashboard
/ceo/hr                       HR dashboard
/ceo/hr/employees             employee directory
/ceo/hr/employees/:id         employee profile + lifecycle actions
/ceo/hr/departments           department management
/ceo/hr/positions             position management
/ceo/hr/documents             HR document storage
/ceo/payroll                  payroll periods + records
/ceo/orders                   order management
/ceo/orders/:id               order detail + infrastructure handoff
/ceo/customers                workforce + customer roster
/ceo/products                 product catalog
/ceo/companies                companies directory
/ceo/website                  CMS (page_content)
/ceo/announcements            announcements
/ceo/analytics                platform analytics center
/ceo/bug-catcher              MAI CORP Bug Catcher
/ceo/platforms                platform registry + diagnostics
/ceo/infrastructure           customer infrastructure roster
/ceo/secrets                  secret management (CEO only)
/ceo/audit-log                audit log
/ceo/blocker                  Universal Blocker events
/ceo/system                   system health
/ceo/contact                  contact inbox
/ceo/support                  donation log
/ceo/settings                 CEO settings
```

## Customer

```
/account                      client portal
/account/orders               orders
/account/orders/:id           project intake + infrastructure
/account/infrastructure       infrastructure overview
/account/profile              profile
```

## HR & Employee

```
/hr                           HR dashboard
/employee                     employee portal
/employee/profile             my profile
/employee/employment          employment history
/employee/documents           my documents
/employee/requests            HR requests
/employee/timesheets          timesheets
/employee/calendar            schedule + PTO
/employee/pay                 pay stubs
```

## Public

```
/                             home
/about                        about
/companies                    companies directory
/companies/:slug              company detail
/future                       pipeline
/studio                       MAI Corp Technology Studio
/store                        premium marketplace
/store/:category              category browse
/store/product/:slug          product detail (with infra disclaimer)
/support                      donations
/contact                      contact form
/login, /signup, /ceo/signup  authentication
```

## Bug Catcher

Universal monitor (CEO-only). Captures:

- JavaScript errors (window.onerror / unhandledrejection)
- Supabase / RPC / RLS failures
- Schema mismatches against EXPECTED_TABLES / EXPECTED_RPCS
- Realtime, payments, platform issues

Reports are fingerprinted and deduped by `(error_type, normalized message, route, db_error_code)`. Each report supports:

- Copy as full text
- Download as .txt
- Mark Fixed / Won't Fix / Investigating
- Soft-delete (audited)

## Universal Blocker

Centralized authorization layer. Every privileged action passes through `assertAuthenticated`, `assertRole`, `assertActive`, and `guarded(...)`. Failures are recorded to `universal_blocker_events` (CEO-only view at `/ceo/blocker`).

## Termination → instant revocation

`public.terminate_employee` is a `SECURITY DEFINER` RPC that:

1. Sets `employment_status = 'TERMINATED'`
2. Sets `account_status = 'TERMINATED'`
3. Increments `users.access_version`
4. Best-effort revokes Supabase Auth sessions (sets `banned_until`)
5. Records audit log

The frontend subscribes to `user-access-revocation` channel and force-logs out the affected user. The CEO never deletes an employee — the row stays, history stays, payroll history stays.

## Migration safety

Never destructive — uses `create table if not exists` and `drop policy if exists` so re-running is safe. Add columns and policies additively.