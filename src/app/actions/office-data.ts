'use server'

import { requireOfficeSession } from '@/lib/session'
import { getSessionSecret } from '@/lib/env'
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

/** Office reads use service role so RLS never blocks the operations UI. Returns the session. */
async function assertOffice() {
  return requireOfficeSession()
}

export async function searchCustomersAction(query: string) {
  const session = await assertOffice()
  const q = query.trim()
  if (q.length < 2) return []

  const escaped = q.replace(/[%_]/g, '\\$&')
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, phone, billing_address, account_balance, updated_at')
    .eq('tenant_id', session.tenantId)
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
  const session = await assertOffice()
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, phone, billing_address, account_balance, updated_at')
    .eq('tenant_id', session.tenantId)
    .order('name')
    .limit(limit)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getCustomerTimelineAction(customerName: string) {
  const session = await assertOffice()
  const name = customerName.trim()
  const pattern = `%${name}%`

  const [{ data: orders }, { data: openOrders }, { data: cashLogs }] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select('*')
      .eq('tenant_id', session.tenantId)
      .ilike('customer_name', pattern)
      .eq('status', 'Completed')
      .order('date', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('orders')
      .select('id, date, job_type, skip_size, address, status, driver_name')
      .eq('tenant_id', session.tenantId)
      .ilike('customer_name', pattern)
      .in('status', ['Booked', 'Assigned', 'Out for Delivery', 'On Site'])
      .order('date', { ascending: true })
      .limit(20),
    supabaseAdmin
      .from('cash_log')
      .select('*')
      .eq('tenant_id', session.tenantId)
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

  return {
    customer: name,
    totalSpend,
    outstandingBalance,
    openOrders: openOrders ?? [],
    jobs,
    tips,
  }
}

export async function generateReportAction(type: string, startDate: string, endDate: string) {
  const session = await assertOffice()
  const end = endDate.includes('T') ? endDate : `${endDate}T23:59:59`

  switch (type) {
    case 'SEPA': {
      const { data, error } = await supabaseAdmin
        .from('weight_logs')
        .select('*')
        .eq('tenant_id', session.tenantId)
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
        .eq('tenant_id', session.tenantId)
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
        .eq('tenant_id', session.tenantId)
        .in('status', ['Delivered', 'In Use'])
      if (error) throw new Error(error.message)
      return data ?? []
    }
    case 'DRIVER_MANIFEST': {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('tenant_id', session.tenantId)
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
  const session = await assertOffice()
  const { data, error } = await supabaseAdmin
    .from('inventory')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .order('skip_id')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getDashboardStatsAction() {
  const session = await assertOffice()
  const today = new Date().toISOString().split('T')[0]
  const weekStart = getWeekStart()
  const twoDaysAway = new Date()
  twoDaysAway.setDate(twoDaysAway.getDate() + 2)
  const expiryCutoff = twoDaysAway.toISOString().split('T')[0]
  const tid = session.tenantId

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
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('status', 'Completed').eq('date', today),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('status', 'Completed').gte('date', weekStart),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).in('status', ['Booked', 'Assigned']).gt('date', today),
    supabaseAdmin.from('cash_log').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('logged_at', `${today}T00:00:00`),
    supabaseAdmin.from('v_inventory_summary').select('*').eq('tenant_id', tid),
    supabaseAdmin.from('active_tippers').select('*').eq('tenant_id', tid).order('timestamp', { ascending: false }),
    supabaseAdmin.from('v_unpaid_invoices').select('*').eq('tenant_id', tid).limit(100),
    supabaseAdmin.from('v_driver_hours_today').select('*').eq('tenant_id', tid),
    supabaseAdmin.from('v_collections_due').select('*').eq('tenant_id', tid),
    supabaseAdmin.from('permits').select('*').eq('tenant_id', tid).lte('expiry_date', expiryCutoff).neq('status', 'Expired'),
    supabaseAdmin.from('cash_log').select('cost_gross, net_weight, waste_type').eq('tenant_id', tid).gte('logged_at', `${today}T00:00:00`),
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
  const session = await assertOffice()
  const { data, error } = await supabaseAdmin
    .from('activity_log')
    .select('id, type, message, status, actor_email, actor_name, entity_type, entity_id, created_at')
    .eq('tenant_id', session.tenantId)
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
  const session = await assertOffice()
  const { data, error } = await supabaseAdmin
    .from('office_staff')
    .select('id, email, display_name, role, active')
    .eq('tenant_id', session.tenantId)
    .order('email')

  if (error) throw new Error(error.message)
  return data ?? []
}

/** Groups customers with similar normalized names (possible duplicates). */
export async function findDuplicateCustomersAction() {
  const session = await assertOffice()
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, phone, account_balance')
    .eq('tenant_id', session.tenantId)
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
      .eq('tenant_id', session.tenantId)
      .eq('id', primaryId)
      .single()
    if (pErr || !primary) throw new Error('Primary customer not found')

    const { data: dupes } = await supabaseAdmin
      .from('customers')
      .select('id, name')
      .eq('tenant_id', session.tenantId)
      .in('id', ids)

    for (const d of dupes ?? []) {
      await supabaseAdmin
        .from('orders')
        .update({ customer_name: primary.name })
        .eq('tenant_id', session.tenantId)
        .ilike('customer_name', d.name)
      await supabaseAdmin
        .from('cash_log')
        .update({ customer_name: primary.name })
        .eq('tenant_id', session.tenantId)
        .ilike('customer_name', d.name)
    }

    const { error: delErr } = await supabaseAdmin
      .from('customers')
      .delete()
      .eq('tenant_id', session.tenantId)
      .in('id', ids)
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
  const session = await assertOffice()
  const { runMonthlySepaDriveSync } = await import('@/lib/monthly-sepa-drive-sync')
  return runMonthlySepaDriveSync(startDate, endDate, session.tenantId)
}

export async function getOpsSummaryAction(startDate: string, endDate: string) {
  const session = await assertOffice()
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
      .eq('tenant_id', session.tenantId)
      .gte('logged_at', startDate)
      .lte('logged_at', end),
    supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', session.tenantId)
      .eq('status', 'Completed')
      .gte('date', startDate)
      .lte('date', endDate),
    supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', session.tenantId)
      .in('status', ['Booked', 'Assigned', 'Out for Delivery', 'On Site'])
      .gte('date', startDate)
      .lte('date', endDate),
    supabaseAdmin
      .from('v_unpaid_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', session.tenantId),
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

export type SetupCheck = { id: string; label: string; ok: boolean; detail: string }

/** Pre-handover system checklist for Settings tab */
export async function getSetupStatusAction(): Promise<SetupCheck[]> {
  const session = await assertOffice()

  const checks: SetupCheck[] = []

  const { error: dbErr } = await supabaseAdmin.from('config').select('key').eq('tenant_id', session.tenantId).limit(1)
  checks.push({
    id: 'database',
    label: 'Database connected',
    ok: !dbErr,
    detail: dbErr ? dbErr.message : 'Supabase reachable',
  })

  const { count: staffCount } = await supabaseAdmin
    .from('office_staff')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', session.tenantId)
    .eq('active', true)

  const hasDomainAllowlist = Boolean(process.env.OFFICE_GOOGLE_ALLOWED_DOMAINS?.trim())
  checks.push({
    id: 'office_auth',
    label: 'Office Google access',
    ok: (staffCount ?? 0) > 0 || hasDomainAllowlist,
    detail:
      (staffCount ?? 0) > 0
        ? `${staffCount} staff in office_staff`
        : hasDomainAllowlist
          ? 'Domain allowlist configured'
          : 'Add office_staff rows or OFFICE_GOOGLE_ALLOWED_DOMAINS',
  })

  checks.push({
    id: 'session',
    label: 'Session secret',
    ok: Boolean(getSessionSecret()),
    detail: 'Required for driver/portal/tablet PIN sessions',
  })

  checks.push({
    id: 'maps',
    label: 'Google Maps / Places',
    ok: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    detail: 'Address autocomplete on bookings',
  })

  checks.push({
    id: 'twilio',
    label: 'SMS (Twilio)',
    ok: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_NUMBER
    ),
    detail: 'Driver on-site texts & collection reminders',
  })

  checks.push({
    id: 'stripe',
    label: 'Stripe payments',
    ok: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    detail: 'Customer portal pay-invoices',
  })

  const { count: driverCount } = await supabaseAdmin
    .from('drivers')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', session.tenantId)

  checks.push({
    id: 'drivers',
    label: 'Drivers configured',
    ok: (driverCount ?? 0) > 0,
    detail: `${driverCount ?? 0} drivers in database`,
  })

  return checks
}

export async function getEwcCodesAction() {
  await assertOffice()
  const { data, error } = await supabaseAdmin
    .from('ewc_codes')
    .select('id, code, description, hazardous')
    .order('code')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function generateWtnAction(weightLogId: string) {
  const session = await assertOffice()
  const { data: wl, error: wlErr } = await supabaseAdmin
    .from('weight_logs')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .eq('id', weightLogId)
    .single()
  if (wlErr || !wl) throw new Error('Weight log not found')
  const net = Math.abs((wl.gross_weight || 0) - (wl.tare_weight || 0))
  const transferDate = (wl.logged_at || new Date().toISOString()).split('T')[0]
  const { data: wtn, error: wtnErr } = await supabaseAdmin
    .from('waste_transfer_notes')
    .insert({
      tenant_id: session.tenantId,
      weight_log_id: weightLogId,
      transfer_date: transferDate,
      transferee_name: await (await import('@/lib/api-server')).getCompanyName(session.tenantId),
      transferor_name: wl.customer_name,
      transferor_address: wl.address || null,
      waste_description: wl.waste_type || 'Mixed waste',
      ewc_code: wl.ewc_code || null,
      quantity_kg: net > 0 ? net : null,
      vehicle_reg: wl.lorry_reg || null,
    })
    .select().single()
  if (wtnErr || !wtn) throw new Error(wtnErr?.message || 'Failed to create WTN')
  return wtn
}

export async function logFleetIssueAction(form: {
  lorry_reg: string; issue_type: string; description: string; reported_by?: string
}) {
  const session = await assertOffice()
  const { error } = await supabaseAdmin.from('fleet_logs').insert({
    tenant_id: session.tenantId,
    lorry_reg: form.lorry_reg, issue_type: form.issue_type,
    description: form.description, reported_by: form.reported_by || 'Office', status: 'Open',
  } as any)
  if (error) throw new Error(error.message)
  return { success: true }
}

export async function resolveFleetIssueAction(id: string) {
  const session = await assertOffice()
  const { error } = await supabaseAdmin.from('fleet_logs')
    .update({ status: 'Resolved', resolved_at: new Date().toISOString() } as any)
    .eq('tenant_id', session.tenantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
  return { success: true }
}

export async function listCarrierLicencesAction() {
  const session = await assertOffice()
  const { data, error } = await supabaseAdmin
    .from('carrier_licences')
    .select('*')
    .eq('tenant_id', session.tenantId)
    .order('expiry_date')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertCarrierLicenceAction(payload: {
  id?: string; holder_name: string; licence_number: string; licence_type: string
  regulator: string; issue_date?: string; expiry_date?: string; status: string; notes?: string
}) {
  const session = await assertOffice()
  const { error } = await supabaseAdmin
    .from('carrier_licences')
    .upsert({ ...payload, tenant_id: session.tenantId } as any)
  if (error) throw new Error(error.message)
  return { success: true }
}

export async function deleteCarrierLicenceAction(id: string) {
  const session = await assertOffice()
  const { error } = await supabaseAdmin
    .from('carrier_licences')
    .delete()
    .eq('tenant_id', session.tenantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
  return { success: true }
}

// ============================================================
// TENANT-SCOPED READS (replace the old client-side lib/api.ts)
// ============================================================

export async function getDispatchJobsAction(targetDate: string) {
  const session = await assertOffice()
  const server = await import('@/lib/api-server')
  return server.getDispatchJobs(session.tenantId, targetDate)
}

export async function getLorriesAction() {
  const session = await assertOffice()
  const server = await import('@/lib/api-server')
  return server.getLorries(session.tenantId)
}

export async function getDriversListAction() {
  const session = await assertOffice()
  const server = await import('@/lib/api-server')
  return server.getDriversList(session.tenantId)
}

export async function getCustomPricingListAction() {
  const session = await assertOffice()
  const server = await import('@/lib/api-server')
  return server.getCustomPricingList(session.tenantId)
}

export async function getStoredTareAction(reg: string, skipSize: string) {
  const session = await assertOffice()
  const server = await import('@/lib/api-server')
  return server.getStoredTare(session.tenantId, reg, skipSize)
}
