# EnviroWorx Cloud — Product Roadmap & First-Principles Review

> Companion to `docs/GO_LIVE_PLAN.md`. The go-live plan gets the **current** app
> live for Enviroworx. This doc is **what to do after** — cut, fix, and build —
> based on what the business actually is.

## What the business actually is (decided 2026-05-29)

Enviroworx is a **licensed waste operator running its own transfer site with a
weighbridge**, plus a skip delivery/collection fleet, in Edinburgh.

The money-critical loops are:
1. **Weighbridge / on-site tipping** — vehicles weigh in → tip → weigh out, recorded for SEPA (waste on/off site).
2. **Skip cycle** — deliver → customer fills → collect → tip on own site → weigh → SEPA record.
3. **Route optimisation** — sequence multi-drop runs with stacks of skips to minimise mileage (= cost).
4. **Accounts reporting** — clean, easy data pulls for the books.
5. **Road permits** — skips placed on public roads need City of Edinburgh Council permits (placed regularly).

Future (NOT now): possibly sell the software to other waste firms, undercutting competitors.
Implication: don't build multi-tenancy now, but keep two cheap habits (below) so the door stays open.

> **Note:** this is an *operator* tool, not a consumer "book a skip online" site.
> A public self-serve booking funnel is **optional/later**, not the priority.

---

## CUT — delete or defer (not on the critical path; pure maintenance cost)

- **The "SaaS product" landing page framing** ("Launch Instance / Start Integration /
  modernize your operations"). For now this is an internal tool. Replace the public
  homepage with either a simple Enviroworx brochure page or a straight redirect to
  `/office`. Keep the slick design — just stop pitching software to nobody.
- **HR logs, fuel cards, `driver_hours` as built-in features.** Payroll/HR/fuel are
  solved by existing tools (accountant, fuel-card provider portal). Don't maintain a
  half-built version. Export if needed; otherwise hide the UI.
- **Inventory tab as a generic module.** Inventory here = skips. Replace with a simple
  "skips by size: free / out / in for repair" count (see skip-asset tracking below).
- **Verizon telemetry cron, `incidents`, `walkaround_checks`** — keep ONLY if a driver
  or your insurer actually uses them weekly. Otherwise defer; they add schema and cron
  surface for little return.

> Musk test: if after cutting you find you have to add ~10% back, that's correct.
> If you add nothing back, it was genuinely dead.

---

## FIX — consolidate duplicate data models (highest-value cleanup; do before building)

The schema has grown two parallel models. Two sources of truth = bugs. Pick one each:

| Keep | Delete / migrate away | Why |
|---|---|---|
| `vehicles` (richer) **or** `lorries` — pick ONE | the other | Dispatch, fleet, telemetry currently split across both |
| `vehicle_maintenance` **or** `maintenance_logs` | the other | Same data, two tables |
| **One** weight model | merge `weight_logs` + `weighbridge_readings` + `tare_weights` | Weighbridge is core — it must have a single, trusted record |

Also establish **one source of truth for "where is every skip right now"** (skip ID →
current address → out since → due collection). This underpins routing, overstay billing,
and inventory.

---

## BUILD — in priority order

### 1. Route optimisation (the headline feature) 🚚
Sequence each driver's daily drops/collections to minimise mileage.
- **v1 (pragmatic):** Google Maps Directions API with `optimizeWaypoints=true` over the
  day's stops from the yard and back. You already have a Maps key path + the `map`/KML
  tab + `external_map_points`. This gets 80% of the value cheaply.
- **v2:** account for skip stacks / vehicle capacity (how many skips a lorry carries),
  time windows, and drop-vs-collect ordering. This is a Vehicle Routing Problem — only
  reach for a dedicated solver (e.g. OR-Tools, or a routing API) once v1 is proven.
- **Output:** an ordered run sheet on the driver app + estimated mileage, so you can
  see the saving.

### 2. SEPA waste on/off site + Digital Waste Tracking 📋
- Make the (consolidated) weighbridge record capture: direction (in/out), **EWC waste
  code**, gross/tare/net weight, carrier/customer, vehicle, timestamp.
- Feed that into the existing SEPA report generator (`src/lib/reports/sepa-generator.ts`,
  monthly cron already exists).
- **Align to the UK Digital Waste Tracking Service** (becoming mandatory ~2026). Right
  now you produce CSVs; the goal is records that map cleanly to the official service.
  This is compliance, not optional, for a licensed carrier.

### 3. Edinburgh road-permit tracking 🪧
You have a `permits` table but it's plain CRUD. Build:
- Permit linked to an order/skip + address + council reference + start/expiry dates.
- **Expiry reminders** (reuse the collection-reminders cron pattern) so a permit never
  lapses while a skip is on the road (fines + liability).
- A clear office view of "which roadside skips have active vs expiring permits."

### 4. Accounts reporting "pack" 📊
You have `reports-tab` + QuickBooks integration + CSV export. Tighten into the few
reports accounts actually pulls:
- Revenue by period (and unpaid/overdue).
- Weighbridge tonnage in/out by period + by waste code.
- SEPA quarterly return, ready to file.
- One-click export to QuickBooks / CSV.
Make these the *default* screens, not buried.

### 5. Skip-asset tracking + overstay billing 💷
Off the back of the FIX above: flag skips that have been out longer than the hire
period so you bill overstays instead of losing the asset's earning time. Tie a customer
"my skip's full — collect it" action (SMS link or portal) into the collection queue.

---

## Selling the software — current state (updated 2026-06-09)

**Done — tenant isolation is now enforced end-to-end:**
- `tenants` table; `tenant_id` on all operational tables; codified in
  `supabase/migrations/20260609000000_multi_tenancy_codified.sql` +
  `..._tenant_unique_keys.sql` (so a fresh DB can be provisioned from the repo).
- Every server action / API route derives `tenantId` from the session and scopes
  every query (`api-server.ts`, `office-data.ts`, `portal.ts`, documents/reports
  routes, crons). The old client-side `lib/api.ts` layer is deleted.
- Views (`v_unpaid_invoices`, `v_inventory_summary`, etc.) expose `tenant_id`.
- Config, branding, customer emails, driver PINs, skip IDs are unique **per tenant**;
  generated documents (WTN/DTN/invoice) and SMS use the tenant's company name.

**Still needed before onboarding tenant #2:**
1. **Pre-auth tenant context** — driver/portal/tablet login pages list drivers via
   anon RLS reads with no tenant filter, and auth routes default to the Enviroworx
   tenant unless `tenantSlug` is posted. Give each tenant a URL (e.g. `/t/<slug>/driver`
   or a subdomain) and thread the slug into login + the anon `drivers_public` reads.
2. **Tenant onboarding flow** — script or admin screen to create tenant + seed config
   + office_staff (a `tenant_onboarding` table already exists).
3. **Per-tenant integrations** — Twilio/Stripe/QuickBooks/Drive/Verizon keys are
   global env vars (currently Enviroworx's accounts). Move to per-tenant config.
4. **Billing & contracts** — out of scope until a real second customer exists.

---

## Sequencing vs go-live

1. **Go live first** with the app as-is (see `GO_LIVE_PLAN.md`). Don't block launch on any of this.
2. **Then FIX** the duplicate data models (low-risk, high-value, prevents future bugs).
3. **Then BUILD** in the order above — route optimisation first (biggest cost saving),
   then SEPA/DWTS (compliance), then permits, then reporting polish.
4. Re-run the Musk algorithm each quarter: question → delete → simplify → accelerate → automate.
