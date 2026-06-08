/**
 * ENVIROWORX — Focused master-data migration (idempotent).
 *
 * Reloads ONLY the master-data tables that were empty / test-junk and are
 * cleanly sourced from the Google Sheet export:
 *   customers, inventory, orders, tare_weights, skip_combos, fuel_cards
 *
 * Deliberately LEAVES untouched the operational/log tables that already hold
 * real or app-generated data the Excel does not have:
 *   weight_logs, cash_log, weighbridge_readings, hr_logs, yard_staff,
 *   lorries, drivers (auth PINs), activity_log, external_map_points.
 *
 * Per-row fallback: a batch insert that fails is retried row-by-row so one
 * bad row never silently drops the whole batch; every skip is reported.
 *
 * Run:  node scripts/migrate-master-data.mjs
 */
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ---- load .env.local ----
const envPath = path.join(process.cwd(), '.env.local')
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2].trim()
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FILE = process.env.MIGRATION_EXCEL_FILE || path.join(os.homedir(), 'Downloads', 'Enviroworx.xlsx')
if (!URL || !KEY) { console.error('Missing Supabase env'); process.exit(1) }

const supabase = createClient(URL, KEY, { auth: { persistSession: false } })
const wb = XLSX.readFile(FILE, { cellDates: true })

// ---- helpers ----
const S = (v) => (v === null || v === undefined) ? '' : String(v).trim()
const N = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n }
const sizeNorm = (v) => { const s = S(v); const d = s.replace(/\.0$/, ''); return d || s }
const iso = (v) => (v instanceof Date && !isNaN(v)) ? v.toISOString() : null
const dateOnly = (v) => { const i = iso(v); return i ? i.slice(0, 10) : null }
const sheetRows = (name) => {
  const ws = wb.Sheets[name]
  if (!ws) { console.warn(`  ⚠️  sheet "${name}" not found`); return [] }
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
}

const JOB_TYPES = new Set(['Delivery', 'Exchange', 'Collection', 'Wait & Load', 'Cage Load'])
const ORDER_STATUS = new Set(['Booked', 'Assigned', 'Out for Delivery', 'Completed', 'Cancelled', 'Aborted'])

async function deleteAll(table) {
  // supabase-js has no TRUNCATE; delete every row via always-true filter.
  const { error } = await supabase.from(table).delete().not('id', 'is', null)
  if (error) throw new Error(`clear ${table}: ${error.message}`)
}

async function insertSafe(table, records) {
  let inserted = 0
  const failures = []
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500)
    const { error } = await supabase.from(table).insert(chunk)
    if (!error) { inserted += chunk.length; continue }
    // fall back to per-row so one bad row doesn't drop the batch
    for (const row of chunk) {
      const { error: e2 } = await supabase.from(table).insert(row)
      if (e2) failures.push({ key: row.skip_id || row.name || row.combination || row.ticket_number || JSON.stringify(row).slice(0, 40), reason: e2.message })
      else inserted++
    }
  }
  return { inserted, failures }
}

function report(table, expected, res) {
  const ok = res.inserted
  console.log(`  ${table}: inserted ${ok}${expected != null ? ` / expected ~${expected}` : ''}` +
    (res.failures.length ? `  ❌ skipped ${res.failures.length}` : '  ✅'))
  for (const f of res.failures.slice(0, 8)) console.log(`      skip "${f.key}": ${f.reason}`)
  if (res.failures.length > 8) console.log(`      … +${res.failures.length - 8} more`)
}

// ---- builders ----
function buildCustomers() {
  const rows = sheetRows('Customers')
  const out = [], seenName = new Set(), seenEmail = new Set()
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; const name = S(r[0]); if (!name) continue
    const nk = name.toLowerCase(); if (seenName.has(nk)) continue; seenName.add(nk)
    let email = S(r[3]).toLowerCase() || null
    if (email) { if (seenEmail.has(email)) email = null; else seenEmail.add(email) } // unique(email): null out dups
    const billing = S(r[2]) || null
    out.push({
      name, phone: S(r[1]),
      email,
      billing_address: billing, address: billing, shipping_address: S(r[6]) || null,
      full_name: S(r[5]) || null, invoice_type: S(r[4]) || 'Invoice',
      account_balance: N(r[7]), comments: S(r[8]) || null,
    })
  }
  return out
}

function buildInventory(custMap) {
  const rows = sheetRows('Inventory'); const out = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; const skip_id = S(r[0]); if (!skip_id) continue
    const cname = S(r[10])
    out.push({
      skip_id, lorry_type: S(r[1]) || 'Skip', skip_size: sizeNorm(r[2]) || '?',
      priority_score: r[3] != null ? Math.round(N(r[3]) ?? 0) || null : null,
      customer_request: S(r[4]) || 'Standard', status: S(r[5]) || 'Available',
      delivery_address: S(r[6]) || null, date_booked: iso(r[7]), delivery_date: iso(r[8]),
      scheduled_return_date: iso(r[9]),
      customer_id: custMap.get(cname.toLowerCase()) || null, customer_name: cname || null,
      customer_phone: S(r[11]) || null, payment_method: S(r[12]) || null,
      payment_status: S(r[13]) || null, comments: S(r[14]) || null, ticket_number: S(r[15]) || null,
    })
  }
  return out
}

function buildOrders(custMap) {
  const rows = sheetRows('Orders'); const out = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; const d = dateOnly(r[0]); if (!d) continue
    let job = S(r[4]); if (!JOB_TYPES.has(job)) job = 'Delivery'
    let st = S(r[2]); if (!ORDER_STATUS.has(st)) st = 'Booked'
    const cname = S(r[6])
    out.push({
      date: d, order_date: d, created_at: iso(r[1]) || `${d}T00:00:00Z`,
      status: st, skip_size: sizeNorm(r[3]) || 'TBC', job_type: job,
      address: S(r[5]) || '—', customer_name: cname || null,
      customer_id: custMap.get(cname.toLowerCase()) || null, phone: S(r[7]) || null,
      payment_method: S(r[8]) || 'Invoice', comments: S(r[9]) || null, delivery_comments: S(r[10]) || null,
      in_diary: S(r[11]).toLowerCase() === 'yes', on_map: S(r[12]).toLowerCase() === 'yes',
      skip_id_used: S(r[13]) || null, paid: S(r[14]).toLowerCase() === 'yes',
      photo_proof: S(r[15]) || null, depart_time: iso(r[17]), arrive_time: iso(r[18]),
    })
  }
  return out
}

function buildTare() {
  const rows = sheetRows('Weigh bridge (skips tare net)'); const out = [], seen = new Set()
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; const reg = S(r[0]); if (!reg) continue
    const size = sizeNorm(r[1]); const k = `${reg}|${size}`; if (seen.has(k)) continue; seen.add(k)
    const tw = N(r[2]); if (tw == null) continue
    out.push({ lorry_registration: reg, skip_size: size, tare_weight: tw })
  }
  return out
}

function buildCombos() {
  const rows = sheetRows('Skip Combo'); const out = [], seen = new Set()
  for (let i = 1; i < rows.length; i++) {
    const c = S(rows[i][0]); if (!c || seen.has(c)) continue; seen.add(c); out.push({ combination: c })
  }
  return out
}

function buildFuel() {
  const rows = sheetRows('Fuel Cards'); const out = []
  for (const r of rows) {
    const pin = S(r[0]).replace(/\.0$/, ''); const reg = S(r[1])
    if (!/^\d+$/.test(pin)) continue // skip header / blank rows
    out.push({ pin, reg: reg || null })
  }
  return out
}

// ---- run ----
async function main() {
  console.log(`🚀 Master-data migration\n   source: ${FILE}\n   target: ${URL}\n`)

  console.log('🧹 Clearing target tables (children first)…')
  for (const t of ['orders', 'inventory', 'customers', 'tare_weights', 'skip_combos', 'fuel_cards']) {
    await deleteAll(t); console.log(`  cleared ${t}`)
  }

  console.log('\n📥 Loading…')
  const customers = buildCustomers()
  report('customers', 553, await insertSafe('customers', customers))

  const { data: custRows } = await supabase.from('customers').select('id,name')
  const custMap = new Map((custRows || []).map((c) => [c.name.toLowerCase(), c.id]))

  report('inventory', 279, await insertSafe('inventory', buildInventory(custMap)))
  report('orders', 30, await insertSafe('orders', buildOrders(custMap)))
  report('tare_weights', 56, await insertSafe('tare_weights', buildTare()))
  report('skip_combos', 36, await insertSafe('skip_combos', buildCombos()))
  report('fuel_cards', 6, await insertSafe('fuel_cards', buildFuel()))

  console.log('\n📊 Final counts:')
  for (const t of ['customers', 'inventory', 'orders', 'tare_weights', 'skip_combos', 'fuel_cards']) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true })
    console.log(`  ${t}: ${count}`)
  }
  console.log('\n✅ Done.')
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
