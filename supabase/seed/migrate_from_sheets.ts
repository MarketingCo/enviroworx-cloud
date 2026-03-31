/**
 * ENVIROWORX: Data Migration Script
 * Migrates data from your Google Sheets (exported as XLSX) into Supabase.
 *
 * USAGE:
 *   1. Export your Google Sheet as XLSX
 *   2. Set your Supabase URL and Service Role Key below
 *   3. Run: npx ts-node migrate_from_sheets.ts
 *
 * DEPENDENCIES:
 *   npm install @supabase/supabase-js xlsx
 */
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================
// CONFIGURATION
// ============================================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJ...'  // Service role key (full access)
const EXCEL_FILE = process.env.MIGRATION_EXCEL_FILE || path.join(__dirname, '../../Enviroworx.xlsx')

if (SUPABASE_URL.includes('YOUR_PROJECT')) {
  console.warn('⚠️  WARNING: Using default Supabase URL. Make sure to set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ============================================================
// HELPERS
// ============================================================

function parseDate(raw: any): string | null {
  if (!raw) return null
  if (raw instanceof Date) return raw.toISOString()
  const s = String(raw).trim()

  // Excel serial number
  if (/^\d+(\.\d+)?$/.test(s) && parseFloat(s) > 25000) {
    const d = XLSX.SSF.parse_date_code(parseFloat(s))
    return new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0).toISOString()
  }

  // UK date format DD/MM/YYYY
  const uk = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})/)
  if (uk) {
    let y = parseInt(uk[3])
    if (y < 100) y += 2000
    return new Date(y, parseInt(uk[2]) - 1, parseInt(uk[1])).toISOString()
  }

  // ISO or other parseable format
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function clean(val: any): string {
  if (val === null || val === undefined) return ''
  return String(val).trim()
}

function cleanNum(val: any): number {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

// ============================================================
// MIGRATION FUNCTIONS
// ============================================================

async function migrateCustomers(wb: XLSX.WorkBook) {
  console.log('📋 Migrating Customers...')
  const ws = wb.Sheets['Customers']
  if (!ws) return console.warn('  ⚠️ No Customers sheet found')

  const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })
  const records = []
  const seen = new Set<string>()

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const name = clean(r[0])
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    records.push({
      name,
      phone: clean(r[1]),
      billing_address: clean(r[2]),
      email: clean(r[3]),
      invoice_type: clean(r[4]) || 'Invoice',
      full_name: clean(r[5]),
      shipping_address: clean(r[6]),
      account_balance: cleanNum(r[7]),
      comments: clean(r[8]),
    })
  }

  // Batch insert in chunks of 500
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500)
    const { error } = await supabase.from('customers').insert(chunk)
    if (error) console.error(`  ❌ Error at chunk ${i}:`, error.message)
  }
  console.log(`  ✅ Migrated ${records.length} customers`)
}

async function migrateLorries(wb: XLSX.WorkBook) {
  console.log('🚛 Migrating Lorries...')
  const ws = wb.Sheets['Lorries']
  if (!ws) return

  const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })
  const records = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const reg = clean(r[2] || r[1] || r[0])
    if (!reg) continue
    records.push({
      lorry_type: clean(r[0]) || 'Skip',
      status: 'Available',
      registration: reg,
    })
  }

  const { error } = await supabase.from('lorries').insert(records)
  if (error) console.error('  ❌', error.message)
  else console.log(`  ✅ Migrated ${records.length} lorries`)
}

async function migrateDrivers(wb: XLSX.WorkBook) {
  console.log('👷 Migrating Drivers...')
  const ws = wb.Sheets['Drivers']
  if (!ws) return

  const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })
  const records = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const name = clean(r[0])
    if (!name) continue
    records.push({
      name,
      status: clean(r[1]) || 'Available',
      pin: clean(r[2]).replace('.0', ''),
      pay_rate: cleanNum(r[3]),
    })
  }

  const { error } = await supabase.from('drivers').insert(records)
  if (error) console.error('  ❌', error.message)
  else console.log(`  ✅ Migrated ${records.length} drivers`)
}

async function migrateInventory(wb: XLSX.WorkBook) {
  console.log('📦 Migrating Inventory...')
  const ws = wb.Sheets['Inventory']
  if (!ws) return

  const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })
  const records = []

  // Get customer ID map
  const { data: customers } = await supabase.from('customers').select('id, name')
  const custMap = new Map(customers?.map(c => [c.name.toLowerCase(), c.id]) ?? [])

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const skipId = clean(r[0])
    if (!skipId) continue

    const customerName = clean(r[10])
    const customerId = custMap.get(customerName.toLowerCase()) || null
    const rawSize = clean(r[2])
    const size = rawSize.replace(/\.0$/, '').replace(/\D/g, '') || rawSize

    records.push({
      skip_id: skipId,
      lorry_type: clean(r[1]) || 'Skip',
      skip_size: size,
      priority_score: cleanNum(r[3]) || null,
      customer_request: clean(r[4]) || 'Standard',
      status: clean(r[5]) || 'Available',
      delivery_address: clean(r[6]) || null,
      date_booked: parseDate(r[7]),
      delivery_date: parseDate(r[8]),
      scheduled_return_date: parseDate(r[9]),
      customer_id: customerId,
      customer_name: customerName || null,
      customer_phone: clean(r[11]) || null,
      payment_method: clean(r[12]) || null,
      payment_status: clean(r[13]) || null,
      comments: clean(r[14]) || null,
      ticket_number: clean(r[15]) || null,
    })
  }

  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500)
    const { error } = await supabase.from('inventory').insert(chunk)
    if (error) console.error(`  ❌ Error at chunk ${i}:`, error.message)
  }
  console.log(`  ✅ Migrated ${records.length} inventory items`)
}

async function migrateOrders(wb: XLSX.WorkBook) {
  console.log('📋 Migrating Orders...')
  const ws = wb.Sheets['Orders']
  if (!ws) return

  const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })
  const records = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const date = parseDate(r[0])
    if (!date) continue

    records.push({
      date: date.split('T')[0],
      created_at: parseDate(r[1]) || date,
      status: clean(r[2]) || 'Booked',
      skip_size: clean(r[3]).replace('.0', ''),
      job_type: clean(r[4]) || 'Delivery',
      address: clean(r[5]),
      customer_name: clean(r[6]),
      phone: clean(r[7]),
      payment_method: clean(r[8]) || 'Invoice',
      comments: clean(r[9]),
      delivery_comments: clean(r[10]),
      in_diary: clean(r[11]).toLowerCase() === 'yes',
      on_map: clean(r[12]).toLowerCase() === 'yes',
      skip_id_used: clean(r[13]) || null,
      paid: clean(r[14]).toLowerCase() === 'yes',
      photo_proof: clean(r[15]) || null,
      driver_name: clean(r[16]) || null,
      depart_time: parseDate(r[17]),
      arrive_time: parseDate(r[18]),
    })
  }

  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500)
    const { error } = await supabase.from('orders').insert(chunk)
    if (error) console.error(`  ❌ Error at chunk ${i}:`, error.message)
  }
  console.log(`  ✅ Migrated ${records.length} orders`)
}

async function migrateWeightLogs(wb: XLSX.WorkBook) {
  console.log('⚖️ Migrating Weight Logs...')
  const ws = wb.Sheets['Weight log data']
  if (!ws) return

  const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })
  const records = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const date = parseDate(r[0])
    if (!date) continue

    records.push({
      logged_at: date,
      ticket_number: clean(r[1]).replace('.0', ''),
      customer_name: clean(r[2]),
      lorry_reg: clean(r[3]),
      skip_size: clean(r[4]).replace('.0', ''),
      skip_id: clean(r[5]) || null,
      address: clean(r[6]),
      waste_type: clean(r[7]) || 'TBC',
      gross_weight: cleanNum(r[8]),
      tare_weight: 0,
      net_weight: cleanNum(r[9]),
      mix_con: cleanNum(r[10]),
      mix_mun: cleanNum(r[11]),
      wood: cleanNum(r[12]),
      inert: cleanNum(r[13]),
      soil: cleanNum(r[14]),
      cardboard: cleanNum(r[15]),
      metal: cleanNum(r[16]),
      direction: 'On-site',
    })
  }

  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500)
    const { error } = await supabase.from('weight_logs').insert(chunk)
    if (error) console.error(`  ❌ Error at chunk ${i}:`, error.message)
  }
  console.log(`  ✅ Migrated ${records.length} weight logs`)
}

async function migrateCashLog(wb: XLSX.WorkBook) {
  console.log('💰 Migrating Cash Log...')
  const ws = wb.Sheets['Cash log']
  if (!ws) return

  const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })
  const records = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const date = parseDate(r[0])
    if (!date) continue

    records.push({
      logged_at: date,
      ticket_number: clean(r[1]).replace('.0', ''),
      customer_name: clean(r[2]),
      skip_size: clean(r[3]),
      address: clean(r[4]),
      waste_type: clean(r[5]),
      gross_weight: cleanNum(r[6]),
      net_weight: cleanNum(r[7]),
      cost_net: cleanNum(r[8]),
      cost_gross: cleanNum(r[9]),
      amount_paid: cleanNum(r[10]),
      payment_method: clean(r[11]) || 'Invoice',
      tyl_ref: clean(r[12]) || null,
      comments: clean(r[13]) || null,
    })
  }

  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500)
    const { error } = await supabase.from('cash_log').insert(chunk)
    if (error) console.error(`  ❌ Error at chunk ${i}:`, error.message)
  }
  console.log(`  ✅ Migrated ${records.length} cash log entries`)
}

async function migrateTareWeights(wb: XLSX.WorkBook) {
  console.log('🔧 Migrating Tare Weights...')
  const ws = wb.Sheets['Weigh bridge (skips tare net)']
  if (!ws) return

  const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })
  const records = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r[0]) continue
    records.push({
      lorry_registration: clean(r[0]),
      skip_size: clean(r[1]).replace('.0', ''),
      tare_weight: cleanNum(r[2]),
    })
  }

  const { error } = await supabase.from('tare_weights').insert(records)
  if (error) console.error('  ❌', error.message)
  else console.log(`  ✅ Migrated ${records.length} tare weights`)
}

async function migrateSkipCombos(wb: XLSX.WorkBook) {
  console.log('🧩 Migrating Skip Combos...')
  const ws = wb.Sheets['Skip Combo']
  if (!ws) return

  const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })
  const records = []

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) records.push({ combination: clean(rows[i][0]) })
  }

  const { error } = await supabase.from('skip_combos').insert(records)
  if (error) console.error('  ❌', error.message)
  else console.log(`  ✅ Migrated ${records.length} combos`)
}

async function migrateShifts(wb: XLSX.WorkBook) {
  console.log('⏰ Migrating Shifts...')
  const ws = wb.Sheets['Shifts']
  if (!ws) return

  const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })
  const records = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r[1]) continue
    records.push({
      employee: clean(r[1]),
      date: parseDate(r[2])?.split('T')[0] || new Date().toISOString().split('T')[0],
      role_or_lorry: clean(r[3]),
      clock_in: parseDate(r[4]),
      clock_out: parseDate(r[5]),
      total_mins: cleanNum(r[6]),
      break_mins: cleanNum(r[7]),
      payable_hours: cleanNum(r[8]),
    })
  }

  const { error } = await supabase.from('shifts').insert(records)
  if (error) console.error('  ❌', error.message)
  else console.log(`  ✅ Migrated ${records.length} shifts`)
}

// ============================================================
// MAIN RUNNER
// ============================================================

async function main() {
  console.log('🚀 ENVIROWORX DATA MIGRATION')
  console.log('=' .repeat(50))
  console.log(`Source: ${EXCEL_FILE}`)
  console.log(`Target: ${SUPABASE_URL}`)
  console.log('')

  const wb = XLSX.readFile(EXCEL_FILE)
  console.log(`Found sheets: ${wb.SheetNames.join(', ')}\n`)

  // Order matters for foreign keys
  await migrateCustomers(wb)
  await migrateLorries(wb)
  await migrateDrivers(wb)
  await migrateInventory(wb)
  await migrateSkipCombos(wb)
  await migrateTareWeights(wb)
  await migrateOrders(wb)
  await migrateWeightLogs(wb)
  await migrateCashLog(wb)
  await migrateShifts(wb)

  console.log('\n✅ MIGRATION COMPLETE!')
  console.log('Next steps:')
  console.log('  1. Verify data in Supabase Dashboard → Table Editor')
  console.log('  2. Check row counts match your Google Sheet')
  console.log('  3. Deploy the Next.js app with: vercel deploy')
}

main().catch(console.error)
