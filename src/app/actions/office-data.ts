'use server'

import { requireOfficeSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { DEFAULT_CONFIG } from '@/lib/config'
import { writeAudit, auditFromSession } from '@/lib/audit'
import { toActionError } from '@/lib/action-errors'

function normalizeCustomerName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(ltd|limited|plc|uk)\b\.?/gi, '')
    .replace(/[^\w\s&'-]/g, '')
    .trim()
}

/** Office reads use service role so RLS never blocks the operations UI. */
async function assertOffice() {
  await requireOfficeSession()
}

export async function searchCustomersAction(query: string) {
  await assertOffice()
  const q = query.trim()
  if (q.length < 2) return []

  const escaped = q.replace(/[%_]/g, '\\$&')
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, phone, billing_address, account_balance, updated_at')
    .ilike('name', `%${escaped}%`)
    .order('name')
    .limit(20)

  if (error) {
    console.error('searchCustomersAction:', error)
    throw new Error(error.message)
  }
  return data ?? []
}

export async function listCustomersAction(limit = 50) {
  await assertOffice()
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, phone, billing_address, account_balance, updated_at')
    .order('name')
    .limit(limit)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getCustomerTimelineAction(customerName: string) {
  await assertOffice()
  const name = customerName.trim()
  const pattern = `%${name}%`

  const [{ data: orders }, { data: cashLogs }] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select('*')
      .ilike('customer_name', pattern)
      .eq('status', 'Completed')
      .order('date', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('cash_log')
      .select('*')
      .ilike('customer_name', pattern)
      .order('logged_at', { ascending: false })
      .limit(50),
  ])

  let totalSpend = 0
  let outstandingBalance = 0

  const jobs = (orders ?? []).map((o) => {
    const skipSize = o.skip_size?.replace(/\D/g, '') ?? ''
    const netPrice = DEFAULT_CONFIG.pricesSkip[skipSize] || 0
    const gross = netPrice * (1 + DEFAULT_CONFIG.vatRate)
    totalSpend += gross
    if (!o.paid && o.payment_method === 'Invoice') outstandingBalance += gross
    return {
      date: o.date,
      type: o.job_type,
      size: o.skip_size,
      address: o.address,
      skipId: o.skip_id_used,
      amount: gross,
      paid: o.paid,
      id: o.id,
    }
  })

  const tips = (cashLogs ?? []).map((cl) => {
    const gross = cl.cost_gross || 0
    const paid = (cl.amount_paid || 0) >= gross
    totalSpend += gross
    if (!paid && cl.payment_method === 'Invoice') outstandingBalance += gross - (cl.amount_paid || 0)
    return {
      date: cl.logged_at,
      ticket: cl.ticket_number,
      wasteType: cl.waste_type,
      netWeight: cl.net_weight,
      amount: gross,
      paid,
      id: cl.id,
    }
  })

  return { customer: name, totalSpend, outstandingBalance, jobs, tips }
}

export async function generateReportAction(type: string, startDate: string, endDate: string) {
  await assertOffice()
  const end = endDate.includes('T') ? endDate : `${endDate}T23:59:59`

  switch (type) {
    case 'SEPA': {
      const { data, error } = await supabaseAdmin
        .from('weight_logs')
        .select('*')
        .gte('logged_at', startDate)
        .lte('logged_at', end)
        .order('logged_at')
      if (error) throw new Error(error.message)
      return data ?? []
    }
    case 'FINANCE': {
      const { data, error } = await supabaseAdmin
        .from('cash_log')
        .select('*')
        .gte('logged_at', startDate)
        .lte('logged_at', end)
        .order('logged_at')
      if (error) throw new Error(error.message)
      return data ?? []
    }
    case 'ASSETS': {
      const { data, error } = await supabaseAdmin
        .from('inventory')
        .select('*')
        .in('status', ['Delivered', 'In Use'])
      if (error) throw new Error(error.message)
      return data ?? []
    }
    case 'DRIVER_MANIFEST': {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'Completed')
        .order('driver_name')
      if (error) throw new Error(error.message)
      return data ?? []
    }
    default:
      return []
  }
}

export async function getInventoryAction() {
  await assertOffice()
  const { data, error } = await supabaseAdmin
    .from('inventory')
    .select('*')
    .order('skip_id')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getDashboardStatsAction() {
  await assertOffice()
  const today = new Date().toISOString().split('T')[0]
  const weekStart = getWeekStart()
  const twoDaysAway = new Date()
  twoDaysAway.setDate(twoDaysAway.getDate() + 2)
  const expiryCutoff = twoDaysAway.toISOString().split('T')[0]

  const [
    { count: completedToday },
    { count: completedWeek },
    { count: futureBookings },
    { count: tipsToday },
    { data: inventorySummary },
    { data: activeTippers },
    { data: unpaidInvoices },
    { data: driverHours },
    { data: collections },
    { data: expiringPermits },
    { data: revenueData },
  ] = await Promise.all([
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'Completed').eq('date', today),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'Completed').gte('date', weekStart),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).in('status', ['Booked', 'Assigned']).gt('date', today),
    supabaseAdmin.from('cash_log').select('id', { count: 'exact', head: true }).gte('logged_at', `${today}T00:00:00`),
    supabaseAdmin.from('v_inventory_summary').select('*'),
    supabaseAdmin.from('active_tippers').select('*').order('timestamp', { ascending: false }),
    supabaseAdmin.from('v_unpaid_invoices').select('*').limit(100),
    supabaseAdmin.from('v_driver_hours_today').select('*'),
    supabaseAdmin.from('v_collections_due').select('*'),
    supabaseAdmin.from('permits').select('*').lte('expiry_date', expiryCutoff).neq('status', 'Expired'),
    supabaseAdmin.from('cash_log').select('cost_gross, net_weight, waste_type').gte('logged_at', `${today}T00:00:00`),
  ])

  const totalRev = revenueData?.reduce((sum, r) => sum + (r.cost_gross || 0), 0) ?? 0
  const estDisposalCost =
    revenueData?.reduce((sum, r) => {
      const rate = DEFAULT_CONFIG.disposalCosts[r.waste_type || 'Mix Con'] || 130
      const tonnage = (r.net_weight || 0) / 1000
      return sum + tonnage * rate
    }, 0) ?? 0

  return {
    stats: {
      completedToday: completedToday ?? 0,
      completedWeek: completedWeek ?? 0,
      futureBookings: futureBookings ?? 0,
      tipsToday: tipsToday ?? 0,
      estProfitToday: totalRev - estDisposalCost,
    },
    inventorySummary: inventorySummary ?? [],
    activeTippers: activeTippers ?? [],
    unpaidInvoices: unpaidInvoices ?? [],
    driverHours: driverHours ?? [],
    collections: collections ?? [],
    expiringPermits: expiringPermits ?? [],
  }
}

function getWeekStart() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().split('T')[0]
}

export async function getAuditLogAction(limit = 80) {
  await assertOffice()
  const { data, error } = await supabaseAdmin
    .from('activity_log')
    .select('id, type, message, status, actor_email, actor_name, entity_type, entity_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getOfficeSessionAction() {
  const session = await requireOfficeSession()
  return {
    name: session.name,
    email: session.email ?? null,
    officeRole: session.officeRole ?? null,
  }
}

export async function listOfficeStaffAction() {
  await assertOffice()
  const { data, error } = await supabaseAdmin
    .from('office_staff')
    .select('id, email, display_name, role, active')
    .order('email')

  if (error) throw new Error(error.message)
  return data ?? []
}

/** Groups customers with similar normalized names (possible duplicates). */
export async function findDuplicateCustomersAction() {
  await assertOffice()
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, phone, account_balance')
    .order('name')
    .limit(500)

  if (error) throw new Error(error.message)

  const groups = new Map<string, typeof data>()
  for (const c of data ?? []) {
    const key = normalizeCustomerName(c.name)
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(c)
    groups.set(key, list)
  }

  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, customers]) => ({ key, customers }))
}

/** Merge duplicate customer records into one primary account. */
export async function mergeCustomersAction(primaryId: string, duplicateIds: string[]) {
  const session = await requireOfficeSession()
  const ids = duplicateIds.filter((id) => id && id !== primaryId)
  if (!ids.length) throw new Error('Select at least one duplicate to merge')

  try {
    const { data: primary, error: pErr } = await supabaseAdmin
      .from('customers')
      .select('id, name')
      .eq('id', primaryId)
      .single()
    if (pErr || !primary) throw new Error('Primary customer not found')

    const { data: dupes } = await supabaseAdmin
      .from('customers')
      .select('id, name')
      .in('id', ids)

    for (const d of dupes ?? []) {
      await supabaseAdmin
        .from('orders')
        .update({ customer_name: primary.name })
        .ilike('customer_name', d.name)
      await supabaseAdmin
        .from('cash_log')
        .update({ customer_name: primary.name })
        .ilike('customer_name', d.name)
    }

    const { error: delErr } = await supabaseAdmin.from('customers').delete().in('id', ids)
    if (delErr) throw delErr

    await writeAudit(
      auditFromSession(session, {
        type: 'customer.merge',
        message: `Merged ${ids.length} duplicate(s) into ${primary.name}`,
        entityType: 'customer',
        entityId: primaryId,
        metadata: { mergedIds: ids },
      })
    )

    return { success: true, primaryName: primary.name, mergedCount: ids.length }
  } catch (e) {
    throw toActionError(e)
  }
}

export async function runMonthlySepaDriveSyncAction(startDate: string, endDate: string) {
  await assertOffice()
  const { runMonthlySepaDriveSync } = await import('@/lib/monthly-sepa-drive-sync')
  return runMonthlySepaDriveSync(startDate, endDate)
}

export async function getOpsSummaryAction(startDate: string, endDate: string) {
  await assertOffice()
  const end = endDate.includes('T') ? endDate : `${endDate}T23:59:59`

  const [
    { data: cash },
    { count: completedJobs },
    { count: openJobs },
    { count: unpaidCount },
  ] = await Promise.all([
    supabaseAdmin
      .from('cash_log')
      .select('cost_gross, net_weight, amount_paid, payment_method')
      .gte('logged_at', startDate)
      .lte('logged_at', end),
    supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Completed')
      .gte('date', startDate)
      .lte('date', endDate),
    supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['Booked', 'Assigned', 'Out for Delivery', 'On Site'])
      .gte('date', startDate)
      .lte('date', endDate),
    supabaseAdmin.from('v_unpaid_invoices').select('id', { count: 'exact', head: true }),
  ])

  const cashGross = cash?.reduce((s, r) => s + (r.cost_gross || 0), 0) ?? 0
  const cashPaid = cash?.reduce((s, r) => s + (r.amount_paid || 0), 0) ?? 0
  const tonnageKg = cash?.reduce((s, r) => s + (r.net_weight || 0), 0) ?? 0
  const tipCount = cash?.length ?? 0

  return {
    cashGross,
    cashPaid,
    tonnageTonnes: tonnageKg / 1000,
    tipCount,
    completedJobs: completedJobs ?? 0,
    openJobs: openJobs ?? 0,
    unpaidInvoices: unpaidCount ?? 0,
  }
}
