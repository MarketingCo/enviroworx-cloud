/**
 * DATA MIGRATION: Excel → Supabase
 *
 * Reads the Enviroworx Excel file and imports all data into Supabase.
 *
 * Usage:
 *   npx ts-node supabase/seed/migrate_from_sheets.ts
 *
 * Requires .env.local with SUPABASE credentials or set them below.
 */
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'

// ES module fix for __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env.local
dotenv.config({ path: path.join(__dirname, '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iuodjkeygsqthlpfjkwj.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY === 'YOUR_SERVICE_ROLE_KEY') {
  console.error('ERROR: Set SUPABASE_SERVICE_ROLE_KEY in .env.local first!')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Try multiple file locations and names
const POSSIBLE_PATHS = [
  path.join(process.cwd(), 'data.xlsx'),
  path.join(__dirname, '../../data.xlsx'),
  path.join(process.cwd(), 'Enviroworx (3).xlsx'),
  path.join(__dirname, '../../Enviroworx (3).xlsx'),
  path.join(process.env.HOME || '', 'Downloads', 'Enviroworx (3).xlsx'),
  path.join(process.env.HOME || '', 'Downloads', 'data.xlsx'),
]

function findExcelFile(): string {
  for (const p of POSSIBLE_PATHS) {
    if (fs.existsSync(p)) {
      return p
    }
  }
  console.error('Excel file not found! Tried:')
  POSSIBLE_PATHS.forEach(p => console.error('  -', p))
  console.error('\nMake sure data.xlsx is in the enviroworx-cloud folder.')
  process.exit(1)
}

// ---- HELPERS ----

function parseDate(val: any): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  if (typeof val === 'string') {
    // Try UK date format (DD/MM/YYYY)
    const ukMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ukMatch) return `${ukMatch[3]}-${ukMatch[2].padStart(2, '0')}-${ukMatch[1].padStart(2, '0')}`
    // Try ISO
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  return null
}

function parseTimestamp(val: any): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0).toISOString()
  }
  if (typeof val === 'string') {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  return null
}

function num(val: any): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.-]/g, '')) || 0
  return 0
}

function str(val: any): string {
  if (val === null || val === undefined) return ''
  return String(val).trim()
}

function bool(val: any): boolean {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'yes' || val.toLowerCase() === 'true'
  return false
}

async function batchInsert(table: string, rows: any[], batchSize = 200) {
  if (!rows.length) {
    console.log(`  ⏭️  ${table}: 0 rows (skipped)`)
    return
  }

  let inserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase.from(table).insert(batch)
    if (error) {
      console.error(`  ❌ ${table} batch ${Math.floor(i / batchSize) + 1}: ${error.message}`)
      // Try one by one to find the bad row
      if (batch.length > 1) {
        for (let j = 0; j < batch.length; j++) {
          const { error: singleErr } = await supabase.from(table).insert(batch[j])
          if (singleErr) {
            console.error(`    Row ${i + j + 1}: ${singleErr.message}`)
            console.error(`    Data:`, JSON.stringify(batch[j]).substring(0, 200))
          } else {
            inserted++
          }
        }
      }
    } else {
      inserted += batch.length
    }
  }
  console.log(`  ✅ ${table}: ${inserted}/${rows.length} rows imported`)
}

// ---- MIGRATION FUNCTIONS ----

async function migrateCustomers(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['Customers']
  if (!sheet) return
  const raw = XLSX.utils.sheet_to_json(sheet)

  // Deduplicate by name (case-insensitive)
  const seen = new Set<string>()
  const rows = raw.filter((r: any) => {
    const name = str(r['Name']).trim()
    if (!name) return false
    const key = name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map((r: any) => ({
    name: str(r['Name']).trim(),
    phone: str(r['Phone Number']) || null,
    billing_address: str(r['Billing Address']) || null,
    email: str(r['Email']) || null,
    invoice_type: str(r['Invoice Type']) || 'Invoice',
    full_name: str(r['Full Name']) || null,
    shipping_address: str(r['Shipping Address']) || null,
    account_balance: num(r['Account Balance']),
    comments: str(r['Comments']) || null,
  }))

  await batchInsert('customers', rows)
}

async function migrateDrivers(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['Drivers']
  if (!sheet) return
  const raw = XLSX.utils.sheet_to_json(sheet)

  const rows = raw.filter((r: any) => str(r['Name'])).map((r: any) => ({
    name: str(r['Name']),
    status: str(r['Status']) || 'Available',
    pin: str(r['PIN']) || null,
    pay_rate: num(r['Pay Rate']) || null,
  }))

  await batchInsert('drivers', rows)
}

async function migrateLorries(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['Lorries']
  if (!sheet) return
  const raw = XLSX.utils.sheet_to_json(sheet)

  const rows = raw.filter((r: any) => str(r['Registration'])).map((r: any) => ({
    lorry_type: str(r['Lorry Type']) || 'Skip',
    status: str(r['Status']) || 'Available',
    registration: str(r['Registration']),
    tax_due: parseDate(r['Tax due']) || null,
    maintenance_due: parseDate(r['Maintenace due']) || null,
    mot_due: parseDate(r['MOT due']) || null,
    brake_check: parseDate(r['Brake check']) || null,
    tacho_calibration: parseDate(r['Tacho calibration']) || null,
    loler_test: parseDate(r['Loler test']) || null,
    vehicle_condition: str(r['Vehicle condition']) || null,
  }))

  await batchInsert('lorries', rows)
}

async function migrateYardStaff(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['Yard Staff']
  if (!sheet) return
  const raw = XLSX.utils.sheet_to_json(sheet)

  const rows = raw.filter((r: any) => str(r['Name'])).map((r: any) => ({
    name: str(r['Name']),
    pin: str(r['PIN']),
    pay_rate: num(r['Pay Rate']) || null,
  }))

  await batchInsert('yard_staff', rows)
}

async function migrateOrders(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['Orders']
  if (!sheet) return
  const raw = XLSX.utils.sheet_to_json(sheet)

  // Valid enum values
  const validStatuses = ['Booked', 'Assigned', 'Out for Delivery', 'Completed', 'Cancelled', 'Aborted']
  const validJobTypes = ['Delivery', 'Exchange', 'Collection', 'Wait & Load', 'Cage Load']
  const validPayments = ['Invoice', 'Cash', 'Card']

  const rows = raw.filter((r: any) => str(r['Address']) && str(r['Customer'])).map((r: any) => {
    const status = str(r['Status'])
    const jobType = str(r['Job Type'])
    const payment = str(r['Payment Method'])

    return {
      date: parseDate(r['Date']) || new Date().toISOString().split('T')[0],
      created_at: parseTimestamp(r['Timestamp']) || null,
      status: validStatuses.includes(status) ? status : 'Booked',
      skip_size: str(r['Skip Size']) || '8',
      job_type: validJobTypes.includes(jobType) ? jobType : 'Delivery',
      address: str(r['Address']),
      customer_name: str(r['Customer']),
      phone: str(r['Phone Number']) || null,
      payment_method: validPayments.includes(payment) ? payment : 'Invoice',
      comments: str(r['Comments']) || null,
      delivery_comments: str(r['Delivery Comments']) || null,
      in_diary: bool(r['In Diary']),
      on_map: bool(r['On Map']),
      skip_id_used: str(r['Skip ID Used']) || null,
      paid: bool(r['Paid']),
      photo_proof: str(r['Photo Proof']) || null,
    }
  })

  await batchInsert('orders', rows)
}

async function migrateInventory(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['Inventory']
  if (!sheet) return
  const raw = XLSX.utils.sheet_to_json(sheet)

  const validStatuses = ['Available', 'Delivered', 'In Use', 'Damaged', 'Decommissioned']

  const rows = raw.filter((r: any) => str(r['Skip I.D.'])).map((r: any) => {
    const status = str(r['Current Status'])
    return {
      skip_id: str(r['Skip I.D.']),
      lorry_type: str(r['Lorry Type']) || 'Skip',
      skip_size: str(r['Skip Size']) || '8',
      priority_score: num(r['Priority Score']) || null,
      customer_request: str(r['Customer Request']) || 'Standard',
      status: validStatuses.includes(status) ? status : 'Available',
      delivery_address: str(r['Delivery Address']) || null,
      date_booked: parseTimestamp(r['Date Booked']) || null,
      delivery_date: parseTimestamp(r['Delivery Date']) || null,
      scheduled_return_date: parseTimestamp(r['Scheduled Return Date']) || null,
      customer_name: str(r['Customer']) || null,
      customer_phone: str(r['Customer Contact Number']) || null,
      payment_method: null,
      payment_status: str(r['Payment Status']) || null,
      comments: str(r['Comments']) || null,
      ticket_number: str(r['Ticket Number']) || null,
    }
  })

  await batchInsert('inventory', rows)
}

async function migrateWeightLogs(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['Weight log data']
  if (!sheet) return
  const raw = XLSX.utils.sheet_to_json(sheet)

  const validWaste = ['Mix Con', 'Mix Mun', 'Wood', 'Inert', 'Soil', 'Cardboard', 'Metal', 'TBC']

  const rows = raw.filter((r: any) => str(r['Customer'])).map((r: any) => {
    const waste = str(r['weight type'])
    return {
      logged_at: parseTimestamp(r['Ticket number']) || new Date().toISOString(), // Ticket number col has the date
      ticket_number: str(r['__EMPTY']) || str(num(r['__EMPTY_1'])) || '',  // actual ticket number
      customer_name: str(r['Customer']),
      lorry_reg: str(r['Lorry Reg']) || null,
      skip_size: str(r['Skip size']) || null,
      skip_id: str(r['Skip No']) || null,
      address: str(r['address']) || null,
      waste_type: validWaste.includes(waste) ? waste : 'TBC',
      gross_weight: num(r['Weight gross']),
      tare_weight: 0, // Will be calculated by trigger
      net_weight: num(r['Weight Net']),
      mix_con: num(r['Mix Con']),
      mix_mun: num(r['Mix Mun']),
      wood: num(r['Wood']),
      inert: num(r['Inert']),
      soil: num(r['Soil']),
      cardboard: num(r['Cardboard']),
      metal: num(r['Metal']),
    }
  })

  await batchInsert('weight_logs', rows)
}

async function migrateCashLog(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['Cash log']
  if (!sheet) return
  const raw = XLSX.utils.sheet_to_json(sheet)

  const validPayments = ['Invoice', 'Cash', 'Card']

  const rows = raw.filter((r: any) => str(r['Customer'])).map((r: any) => {
    const payment = str(r['Payment Method'])
    return {
      ticket_number: str(r['Ticket number']) || null,
      customer_name: str(r['Customer']),
      skip_size: str(r['Skip Size']) || null,
      address: str(r['Address']) || null,
      waste_type: str(r['Waste type']) || null,
      gross_weight: num(r['Gross Weight']),
      net_weight: num(r['Net Weight']),
      cost_net: num(r['Cost Net']),
      cost_gross: num(r['Cost Gross']),
      amount_paid: num(r['Amount paid ']),
      payment_method: validPayments.includes(payment) ? payment : 'Invoice',
      tyl_ref: str(r['TYL number']) || null,
      comments: str(r['Comments']) || null,
    }
  })

  await batchInsert('cash_log', rows)
}

async function migrateTareWeights(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['Weigh bridge (skips tare net)']
  if (!sheet) return
  const raw = XLSX.utils.sheet_to_json(sheet)

  const rows = raw.filter((r: any) => str(r['Lorry Registration'])).map((r: any) => ({
    lorry_registration: str(r['Lorry Registration']),
    skip_size: str(r['Skip Size']),
    tare_weight: num(r['Lorry Net weight']),
  }))

  await batchInsert('tare_weights', rows)
}

async function migrateSkipCombos(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['Skip Combo']
  if (!sheet) return
  const raw = XLSX.utils.sheet_to_json(sheet)

  const rows = raw.filter((r: any) => str(r['Combination'])).map((r: any) => ({
    combination: str(r['Combination']),
  }))

  await batchInsert('skip_combos', rows)
}

async function migrateFuelCards(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['Fuel Cards']
  if (!sheet) return
  // Fuel Cards has headers on row 2 (Pin, Reg)
  const raw = XLSX.utils.sheet_to_json(sheet, { header: ['pin', 'reg'], range: 1 })

  const rows = raw.filter((r: any) => str(r['pin']) && str(r['reg'])).map((r: any) => ({
    pin: str(r['pin']),
    reg: str(r['reg']),
  }))

  await batchInsert('fuel_cards', rows)
}

async function migrateShifts(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['Shifts']
  if (!sheet) return
  const raw = XLSX.utils.sheet_to_json(sheet)

  const rows = raw.filter((r: any) => str(r['Employee'])).map((r: any) => ({
    employee: str(r['Employee']),
    date: parseDate(r['Date']) || new Date().toISOString().split('T')[0],
    role_or_lorry: str(r['Role/Lorry']) || null,
    clock_in: parseTimestamp(r['Clock In']) || null,
    clock_out: parseTimestamp(r['Clock Out']) || null,
    total_mins: num(r['Total Mins']),
    break_mins: num(r['Break Mins']) || 45,
    payable_hours: num(r['Payable Hours']),
  }))

  await batchInsert('shifts', rows)
}

async function migrateHRLogs(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['HR Logs']
  if (!sheet) return
  const raw = XLSX.utils.sheet_to_json(sheet)

  const rows = raw.filter((r: any) => str(r['Employee'])).map((r: any) => ({
    timestamp: parseTimestamp(r['Timestamp']) || new Date().toISOString(),
    employee: str(r['Employee']),
    category: str(r['Category']),
    notes: str(r['Notes']) || null,
  }))

  await batchInsert('hr_logs', rows)
}

async function migrateFleetLogs(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['Daily Checks']
  if (!sheet) return
  const raw = XLSX.utils.sheet_to_json(sheet)

  const validIssues = ['RHA Pass', 'RHA Fail', 'Minor Defect', 'Major Defect', 'Incident']

  const rows = raw.filter((r: any) => str(r['Driver']) || str(r['Lorry Reg'])).map((r: any) => {
    const status = str(r['Status (Pass/Fail)'])
    let issueType = 'RHA Pass'
    if (status.toUpperCase() === 'FAIL') issueType = 'RHA Fail'
    if (status.toUpperCase() === 'PASS') issueType = 'RHA Pass'

    return {
      timestamp: parseTimestamp(r['imestamp'] || r['Timestamp']) || new Date().toISOString(),
      lorry_reg: str(r['Lorry Reg']),
      issue_type: validIssues.includes(issueType) ? issueType : 'RHA Pass',
      description: str(r['Notes/Defects']) || null,
      reported_by: str(r['Driver']) || null,
    }
  })

  await batchInsert('fleet_logs', rows)
}

// ---- MAIN ----

async function main() {
  const filePath = findExcelFile()
  console.log('📂 Reading Excel file:', filePath)

  const workbook = XLSX.readFile(filePath)
  console.log('📊 Sheets found:', workbook.SheetNames.join(', '))
  console.log('')
  console.log('🚀 Starting migration...')
  console.log('')

  // Migrate in dependency order (customers first, then orders that reference them)
  console.log('--- Core Reference Data ---')
  await migrateCustomers(workbook)
  await migrateDrivers(workbook)
  await migrateLorries(workbook)
  await migrateYardStaff(workbook)
  await migrateTareWeights(workbook)
  await migrateSkipCombos(workbook)
  await migrateFuelCards(workbook)

  console.log('')
  console.log('--- Business Data ---')
  await migrateInventory(workbook)
  await migrateOrders(workbook)
  await migrateWeightLogs(workbook)
  await migrateCashLog(workbook)

  console.log('')
  console.log('--- Operational Data ---')
  await migrateShifts(workbook)
  await migrateHRLogs(workbook)
  await migrateFleetLogs(workbook)

  console.log('')
  console.log('✅ Migration complete!')
  console.log('')
  console.log('Next steps:')
  console.log('  1. Check Supabase dashboard → Table Editor to verify data')
  console.log('  2. Run: npm run dev')
  console.log('  3. Open: http://localhost:3000')
}

main().catch(err => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
