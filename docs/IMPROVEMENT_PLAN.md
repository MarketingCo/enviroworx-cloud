# EnviroWorx Cloud — Improvement Plan (2026-06-09)

> **How to use this document.** Tasks are designed to be executed one at a time by a
> coding agent, in order, with an orchestrator reviewing between tasks. Each task says
> exactly which files to touch, what to change, and how to verify. Rules for the executor:
>
> 1. Do ONE task per session/commit. Commit message: `P<phase>.<task>: <summary>`.
> 2. After every task run `npm run typecheck` and `npm run build` — both must pass.
> 3. **Never** remove a `.eq('tenant_id', ...)` filter or an auth check (`requireOfficeSession`,
>    `requireDriverSession`, `requirePortalSession`, `resolveOfficeSession`). Every new query
>    on a tenant table MUST be scoped by the session's `tenantId`.
> 4. New reads/writes go through server actions (`src/app/actions/*`) or `src/lib/api-server.ts`
>    — never query Supabase directly from client components (exception: Supabase Storage
>    uploads and realtime `postgres_changes` subscriptions used as refresh triggers).
> 5. Keep the existing dark theme and Tailwind idiom. Do not add UI libraries without
>    orchestrator approval. `lucide-react`, `react-hot-toast`, `framer-motion` are available.
> 6. Database changes = new file in `supabase/migrations/` (idempotent), never edit old ones.
>    The orchestrator applies migrations to live Supabase — flag when a task includes one.
> 7. If a task turns out to be wrong about the code (line moved, name changed), adapt but
>    keep the intent; note the deviation in the commit body.

Tenant context: Enviroworx tenant UUID `56ec5b3f-6d42-4672-a98c-d60d9c22f284`.
Views with `tenant_id`: `v_unpaid_invoices`, `v_inventory_summary`, `v_collections_due`,
`v_driver_hours_today`, `v_dashboard_stats`, `v_tips_today`.

---

## Phase 0 — Fix real bugs (do these first; the dashboard shows wrong numbers today)

### P0.1 Dashboard field mismatches (3 bugs)
`src/app/office/_components/dashboard-tab.tsx` reads fields the views don't return:
- Line ~31 + ~142: uses `inv.outstanding` — `v_unpaid_invoices` returns **`amount`**.
  Fix both (`totalUnpaid` reduce and the row render) to use `inv.amount`.
- Line ~80: uses `row.in_use` — `v_inventory_summary` returns **`out_on_hire`**. Fix.
- Lines ~115–117: uses `d.employee` and `d.hours_worked` — `v_driver_hours_today` returns
  **`driver_name`** and **`hours_today`** (and `currently_clocked_in`, `current_lorry`). Fix;
  while there, show a small green dot when `currently_clocked_in` is true.
**Verify:** with the dev server against live data, the Unpaid Invoices panel shows non-zero
amounts for CashLog rows, Inventory by Size shows non-zero "out", Driver Hours lists names.

### P0.2 Unpaid order invoices always £0
`v_unpaid_invoices` hardcodes `0 AS amount` for the Orders branch (see
`supabase/migrations/20260609000000_multi_tenancy_codified.sql` line ~150). Skip-hire prices
live in app config (`DEFAULT_CONFIG.pricesSkip` keyed by numeric size), not the DB, so fix in
the app layer: in `getDashboardStatsAction` (`src/app/actions/office-data.ts`), after fetching
`unpaidInvoices`, map rows where `source === 'Orders'` and `amount === 0` to
`amount = pricesSkip[skip_size digits] * (1 + vatRate)` (same logic as `getCustomerTimeline`).
Add a one-line comment explaining why. (Longer-term fix — storing `price_net` on orders — is
P4.4; do not attempt here.)
**Verify:** unpaid Orders rows show a realistic gross price.

### P0.3 Map tab reads bypass the tenant-scoped server layer
`src/app/office/_components/map-tab.tsx` `loadMapData()` queries `inventory`, `vehicles`,
`orders`, `external_map_points` via the browser client. Add a server action
`getMapDataAction()` in `src/app/actions/office-data.ts` that runs the same four queries via
`supabaseAdmin`, each `.eq('tenant_id', session.tenantId)` (external_map_points too — it has
tenant_id now), returns `{ skips, vehicles, liveOrders, externalPoints }`. Replace
`loadMapData`'s queries with one call to the action. Keep the realtime subscriptions as
refresh triggers only.
**Verify:** map still renders all pin types; network tab shows no direct PostgREST reads
from the map tab.

### P0.4 Dashboard permit alert field check — ✅ verified OK (2026-06-09)
`permits.location` exists in the live schema; the dashboard render is correct. No action.
Columns for P3.1 reference: id, created_at, skip_id, location, permit_number, date_applied,
date_issued, expiry_date, status, tenant_id.

> **Status note:** P0.1–P0.3 fixed 2026-06-09 (commit b5015f0; view migration applied to live).
> Phase 1 (P1.1–P1.6) completed 2026-06-09; Phase 2 (P2.1–P2.4) completed 2026-06-10.
> Both need a visual smoke test on the live deploy (map: pins/clustering/drag/search/info
> buttons; tabs: readability + retry states; / homepage).
> 2026-06-10: live weighbridge capture fixed outside the plan — supabase_realtime publication
> was empty (migration 20260609000003 adds all subscribed tables; applied to live), new
> POST /api/scale ingest (SCALE_INGEST_SECRET in Vercel), captureScale server fallback, and
> scripts/weighbridge-monitor.py for the yard PC (streams live readings; needs SCALE_API_URL
> + SCALE_API_SECRET in its .env). Endpoint verified end-to-end against production.
> Note for P4.3: vehicles table has no RLS read policy — its realtime events won't deliver.

---

## Phase 1 — Map overhaul (client-facing priority)

The map already uses Google Maps JS API with click-to-place, drag-to-move, and
mark-collected. The problem is it *looks* dated and lacks the conveniences of Google
My Maps (which the client used before). All work in
`src/app/office/_components/map-tab.tsx` unless stated.

### P1.1 Modern markers (kill the 2009 red-dot icons)
- Add `mapId` to the map constructor (use literal `'ENVIROWORX_OFFICE_MAP'`; advanced markers
  require a mapId — vector map) and switch from `google.maps.Marker` to
  `google.maps.marker.AdvancedMarkerElement` (`libraries=marker` in the script URL,
  i.e. `&libraries=marker,places`).
- Build a small `makePin({ background, glyphText, scale })` helper using `PinElement`:
  - **Skips:** emerald pin, glyph = skip size (e.g. "8"); overstay (> demurrageDays) = amber
    pin with "!" suffix.
  - **Live orders:** blue pin glyph "D" for delivery, amber "C" for collection.
  - **Trucks:** red pin, glyph "🚛" or reg's last 3 chars.
  - **Legacy KML:** grey/purple small pins (scale 0.8).
- Keep drag behaviour for skips (AdvancedMarkerElement supports `gmpDraggable: true`,
  listen to `dragend`).
**Verify:** all four layers render with the new pins; dragging a skip still saves.

### P1.2 Marker clustering
Add `@googlemaps/markerclusterer` (npm). Cluster the **Active Skips** and **Legacy** layers
(orders/trucks stay unclustered — they're few and operational). Rebuild clusterer when
markers redraw.
**Verify:** zooming out groups skip pins into numbered clusters.

### P1.3 Address search on the map
Add a search input (top-left overlay on the map, same dark style as the place-skip card)
backed by the existing server action in `src/app/actions/places.ts` (used by
`src/components/AddressAutocomplete.tsx` — reuse that component). On select: pan/zoom map
to the location and open the place-skip form pre-filled with the chosen address + lat/lng.
**Verify:** typing an Edinburgh address pans the map and opens the pre-filled form.

### P1.4 Place-skip form upgrades
- Add `AddressAutocomplete` to the form's address field (currently a plain input); when an
  address is chosen, keep the clicked lat/lng but store the formatted address.
- Add a customer picker: reuse `searchCustomersAction` (debounced) so existing customers
  link by name; allow free text for one-offs.
- Add skip ID input (optional, "reuse existing skip number") — `placeSkipOnMapAction`
  already accepts `skipId`.
**Verify:** placing a skip with an autocompleted address and existing customer works.

### P1.5 Info windows + side panel polish
- Restyle info window HTML: white card, 13px base text, buttons: **Mark collected**,
  **Get directions** (link `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`,
  target _blank), **Call** when phone exists.
- Side panel: clicking a card pans the map to that pin and opens its info window (keep a
  `markerById` ref). Add per-layer counts to the toggle chips (e.g. "Active Skips · 27").
  Raise card text from 8–9px to 11–12px.
- Map type control default `hybrid` available; persist the user's last map type in
  `localStorage`.
**Verify:** click a side card → map pans + info opens; directions link opens Google Maps.

### P1.6 Mobile + loading
- Map container: `h-[650px]` → `h-[70vh] min-h-[420px]`; side panel collapses under the map
  on small screens (it already grids — verify and fix ordering).
- Replace the pulsing "Loading map…" text with a skeleton block.
**Verify:** usable at 390px wide.

---

## Phase 2 — UI consistency & readability (whole app)

### P2.1 Readability pass
The office app uses 8–10px text everywhere (`text-[8px]`/`text-[9px]`/`text-[10px]`). Office
staff stare at this all day. Global pass over `src/app/office/_components/*.tsx`:
- Data values: minimum `text-xs` (12px). Labels/chips: minimum 10px, only for true chips.
- Remove `italic` from data text (it's on skip IDs, headers).
- Check contrast: `text-slate-500` on `bg-slate-900` for primary data → use `text-slate-300`.
Do it tab by tab (one commit per tab) to keep diffs reviewable.
**Verify:** screenshot each tab; no data text below 12px.

### P2.2 Shared UI primitives
`src/app/office/_components/shared.tsx`: add `Button` (primary/secondary/danger/ghost,
loading state), `EmptyState` (icon + message + optional action), `TableShell`,
`LoadingSkeleton`. Then migrate tabs to use them (one commit per 2–3 tabs). No new deps.
**Verify:** all tabs build; buttons look consistent.

### P2.3 Replace the public homepage
`src/app/page.tsx` is a SaaS marketing pitch ("Launch Instance", fake stats) — wrong for an
operator tool, and it leaks the product pitch to the client's customers. Replace with a
minimal tenant-branded entry page: company name (from config via a server component),
four big link cards (Office / Driver / Customer portal / Yard tablet), phone number,
no marketing copy. Keep `/blog`, `/demo`, `/apply` routes untouched for now (P5 decides
their fate).
**Verify:** `/` renders the entry page with the four links.

### P2.4 Per-page error & loading states
Each tab handles loading/error ad-hoc; some fail silently. Standardise: every tab's loader
sets `error` state on catch and renders `EmptyState` with a Retry button instead of a toast
alone. Tabs: dispatch, fleet, settings, inventory, customers, map, activity, reports.
**Verify:** stop the dev DB (or throw in the action) → tab shows retry UI, retry recovers.

---

## Phase 3 — Missing operator functions

### P3.1 Permits management UI (compliance-critical, currently NO UI)
The `permits` table exists and the dashboard alerts on expiring ones, but there is no screen
to create/edit permits. Build:
- Server actions in `src/app/actions/office-data.ts`: `listPermitsAction()`,
  `upsertPermitAction(payload)`, `deletePermitAction(id)` — all tenant-scoped; payload:
  address/location, council_ref, linked order_id?, skip_id?, start_date, expiry_date,
  status, fee, notes (match actual table columns; extend with a migration if a needed
  column is missing — flag for orchestrator).
- UI: new "Permits" section inside the Fleet tab is wrong-home — add a **Permits tab**
  (`permits-tab.tsx`, register in `office/(app)/page.tsx` nav with a `Signpost` icon):
  table of permits sorted by expiry, status chips (Active / Expiring ≤7d / Expired),
  add/edit modal, link to skip ID where set.
- Extend `src/app/api/cron/collection-reminders/route.ts` with a third block: permits
  expiring in exactly 7 or 2 days → log to `activity_log` (type `permit.expiring`) so it
  surfaces in Activity; (SMS to office number optional, behind config flag).
**Verify:** create a permit expiring tomorrow → appears in dashboard alert + Permits tab.

### P3.2 Demurrage / overstay billing button
`POST /api/admin {action:'demurrage'}` exists (creates cash_log charges for overdue skips)
but nothing in the UI calls it. Add to the Inventory tab header: button
"Charge overstays (N)" where N = skips with days out > demurrageDays; confirm dialog
listing affected skips; calls the endpoint; toasts the result. Office-role gate: render
only when `officeRole` is `admin` or `office` (get via `getOfficeSessionAction`).
**Verify:** with a test skip >28 days out, the button charges once and not twice within 7d.

### P3.3 Route optimisation v1 (roadmap headline)
Pragmatic version only:
- Server action `optimiseDriverRouteAction(driverName, date)` in a new
  `src/app/actions/routing.ts`: fetch that driver's jobs for the date (tenant-scoped),
  geocode missing lat/lng via the existing geocode helper (`src/app/actions/geo.ts`),
  call Google Directions API (server key `GOOGLE_MAPS_API_KEY`) with
  `origin=destination=yard` (yard address from config; add `yard_address` config key,
  default the Enviroworx yard), `waypoints=optimize:true|...`, return ordered stop list +
  total distance/duration.
- Dispatch tab: per driver group, "Optimise route" button → shows the ordered list with
  leg times and a "save order" action writing `route_order` int to orders (migration:
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_order INT` — new migration file).
- Driver app: `getDriverJobs` orders by `route_order NULLS LAST, address`.
**Verify:** a driver with 4+ jobs gets a sensible ordered run with total mileage shown.

### P3.4 Weighbridge EWC enforcement
SEPA records need an EWC code. In `weighbridge-tab.tsx` the EWC select exists but is
optional. Make it required before `processWeightLogAction` when direction is In (tip):
block submit with a toast if missing. Add config flag `require_ewc` (default true) read
from the config table so other tenants can relax it.
**Verify:** weighbridge submit without EWC is blocked; with EWC succeeds and the WTN
offer flow still appears.

### P3.5 Customer portal: "collect my skip" request
Portal shows orders but customers can't request collection (roadmap item). Add to
`src/app/portal/page.tsx`: on active hires (delivered, not collected), a "Request
collection" button → new server action `requestCollectionAction()` in
`src/app/actions/portal.ts` that inserts a `Booked` order (job_type `Collection`,
session-derived identity, `[Portal Request]` tag) and logs to activity_log. Office sees
it as a new booking (realtime toast already exists).
**Verify:** portal request appears in office Bookings/Dispatch for the chosen date.

---

## Phase 4 — Data model consolidation (orchestrator pairs closely; riskiest phase)

Each step: migration + code in one task, behind verification. Do not start until Phases
0–3 are deployed and stable for a few days.

### P4.1 `lorries` vs `vehicles`
Decide: `vehicles` is richer (telemetry fields) — migrate `lorries` rows into `vehicles`
(matching on registration), repoint code (`getLorries`, fleet-tab, driver login lorry list,
dispatch) to `vehicles`, create a compatibility view `lorries` for one release, then drop.

### P4.2 `vehicle_maintenance` vs `maintenance_logs`
Merge into `maintenance_logs`; same pattern.

### P4.3 Single weight model
`weight_logs` is the system of record (has ticket_number, EWC, direction).
`weighbridge_readings` duplicates each gross reading — replace its three uses
(`processWeightLog` insert, `getLiveScaleWeight`) with `weight_logs` queries; keep
`tare_weights` (it's a lookup, not a log). Drop `weighbridge_readings` after a release.

### P4.4 Price on order
`ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_net NUMERIC` — populate at booking time
(processBooking already computes effective price; store it instead of burying it in the
notes string). Update `v_unpaid_invoices` to use `price_net * (1+vat)` for the Orders
branch and delete the P0.2 app-layer patch. Update customer timeline + invoice generator
to prefer stored price.

---

## Phase 5 — Hardening & ops

### P5.1 Tenant-isolation regression tests
Add `vitest` (dev dep) + `src/lib/__tests__/tenant-scope.test.ts`: a static test that
greps `src/app/actions/*.ts` + `src/lib/api-server.ts` and fails if any `.from('<tenant
table>')` chain lacks `tenant_id` within the same statement (regex-based; tenant table
list hardcoded from the migration). Crude but catches the most likely regression. Add
`"test": "vitest run"` script; orchestrator wires CI later.

### P5.2 Error monitoring
`MONITORING_WEBHOOK_URL` exists in env. Add `src/lib/monitor.ts` `reportError(context, err)`
posting JSON to the webhook (fire-and-forget), call it from `toActionError`, the cron
catch blocks, and the documents/reports route catches. No Sentry dependency yet.

### P5.3 Pre-auth tenant context (first real step toward tenant #2)
Driver/portal/tablet logins default to the Enviroworx tenant. Implement `/t/[slug]` route
group: layout resolves slug → tenant (server-side), stores it in a cookie, login pages read
it and pass `tenantSlug` to the auth routes (already supported). The anon `drivers_public`
dropdown must filter by tenant: replace the anon read with a public server route
`GET /api/public/drivers?tenant=<slug>` that uses supabaseAdmin scoped by the slug's
tenant id and returns id+name only. Old URLs keep working (default tenant).

### P5.4 Dependency + npm audit pass
`npm audit` (Dependabot has flagged items, per HANDOVER). Patch-level upgrades only;
`xlsx` is historically vulnerable — it's only used by the one-off Excel migration script,
move it to devDependencies.

### P5.5 Decide /blog, /demo, /apply
These exist for the SaaS pitch. Either delete or move behind an env flag
(`NEXT_PUBLIC_SHOW_MARKETING=false` hides routes via middleware redirect). Orchestrator
decision with Iain.

---

## Execution order & orchestration

| Order | Tasks | Why first |
|---|---|---|
| 1 | P0.1–P0.4 | Numbers on screen are wrong today |
| 2 | P1.1–P1.6 | Client-facing complaint (map) |
| 3 | P2.1–P2.4 | Readability everywhere |
| 4 | P3.1, P3.2 | Compliance (permits) + money (overstays) |
| 5 | P3.3–P3.5 | Headline value features |
| 6 | P5.1, P5.2 | Lock in safety before refactors |
| 7 | P4.x | Consolidation, one table at a time |
| 8 | P5.3–P5.5 | Tenant #2 prep |

Orchestrator checklist per task: review diff for tenant-scope/auth regressions → typecheck +
build → manual smoke of the touched screen → migration applied to live (if any) → commit
pushed → next task.
