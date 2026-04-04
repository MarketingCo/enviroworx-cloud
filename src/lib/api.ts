/**
 * ENVIROWORX API LAYER
 *
 * Replaces ALL google.script.run calls with direct Supabase queries.
 * Each function maps 1:1 to a Google Apps Script function from Code.gs.
 *
 * KEY PERFORMANCE DIFFERENCE:
 * - Google Sheets: batchGet reads ALL data, sends to client, client processes
 * - Supabase: SQL queries run server-side, return ONLY what's needed
 *   → 10-50x faster for dashboard loads
 */
import { supabase, supabaseAdmin } from './supabase'
import { DEFAULT_CONFIG, type AppConfig } from './config'
import { logToDrive } from '@/app/actions/drive'

// ============================================================
// DASHBOARD DATA (replaces getBusinessData & getRawDashboardData)
// ============================================================

export async function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0]
  const weekStart = getWeekStart()

  // Run all queries in parallel (this is the key speed improvement)
  const [
    { data: completedToday },
    { data: completedWeek },
    { data: futureBookings },
    { data: tipsToday },
    { data: inventorySummary },
    { data: activeTippers },
    { data: unpaidInvoices },
    { data: driverHours },
    { data: collections },
  ] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('status', 'Completed').eq('date', today),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('status', 'Completed').gte('date', weekStart),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .in('status', ['Booked', 'Assigned']).gt('date', today),
    supabase.from('cash_log').select('id', { count: 'exact', head: true })
      .gte('logged_at', today + 'T00:00:00'),
    supabase.from('v_inventory_summary').select('*'),
    supabase.from('active_tippers').select('*').order('timestamp', { ascending: false }),
    supabase.from('v_unpaid_invoices').select('*').limit(100),
    supabase.from('v_driver_hours_today').select('*'),
    supabase.from('v_collections_due').select('*'),
  ])

  return {
    stats: {
      completedToday: completedToday?.length ?? 0,
      completedWeek: completedWeek?.length ?? 0,
      futureBookings: futureBookings?.length ?? 0,
      tipsToday: tipsToday?.length ?? 0,
    },
    inventorySummary: inventorySummary ?? [],
    activeTippers: activeTippers ?? [],
    unpaidInvoices: unpaidInvoices ?? [],
    driverHours: driverHours ?? [],
    collections: collections ?? [],
  }
}

// ============================================================
// DISPATCH (replaces dispatchJobs filtering)
// ============================================================

export async function getDispatchJobs(targetDate: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customer:customers(name, phone, billing_address)')
    .eq('date', targetDate)
    .not('status', 'in', '("Completed","Cancelled")')
    .order('driver_name', { ascending: true, nullsFirst: true })

  if (error) throw error
  return data ?? []
}

export async function assignDriverToJob(orderId: string, driverName: string, driverId: string | null) {
  const { error } = await supabase
    .from('orders')
    .update({
      driver_name: driverName || null,
      driver_id: driverId,
      status: driverName ? 'Assigned' : 'Booked'
    })
    .eq('id', orderId)

  if (error) throw error

  // Send SMS notification (via Edge Function)
  if (driverName) {
    const { data: order } = await supabase.from('orders').select('phone').eq('id', orderId).single()
    if (order?.phone) {
      await fetch('/api/sms', {
        method: 'POST',
        body: JSON.stringify({
          to: order.phone,
          body: `Enviroworx: Your skip is on the route plan today. Driver: ${driverName}`
        })
      })
    }
  }
  return { success: true }
}

export async function autoAssignJobs(targetDate: string) {
  const { data: unassigned } = await supabase
    .from('orders')
    .select('*')
    .eq('date', targetDate)
    .is('driver_name', null)
    .in('status', ['Booked', 'Aborted'])
    .order('address')

  const { data: drivers } = await supabase.from('drivers').select('*').eq('status', 'Available')
  const { data: combos } = await supabase.from('skip_combos').select('combination')

  if (!unassigned?.length || !drivers?.length) return { success: false, message: 'No jobs or drivers' }

  const comboSet = new Set(combos?.map(c => c.combination) ?? [])
  const driverPayloads: Record<string, string[]> = {}
  drivers.forEach(d => driverPayloads[d.name] = [])

  let assignedCount = 0
  const assignments: { job: any; driverName: string; driverId: string }[] = []

  for (const job of unassigned) {
    for (const driver of drivers) {
      const currentLoad = [...driverPayloads[driver.name]]
      if (job.job_type !== 'Collection') currentLoad.push(job.skip_size)
      currentLoad.sort((a, b) => parseInt(a) - parseInt(b))
      const testCombo = currentLoad.join('|')

      if (job.job_type === 'Collection' || currentLoad.length === 0 || comboSet.has(testCombo)) {
        assignments.push({ job, driverName: driver.name, driverId: driver.id })
        if (job.job_type !== 'Collection') driverPayloads[driver.name] = currentLoad
        assignedCount++
        break
      }
    }
  }

  await Promise.all(assignments.map(({ job, driverName, driverId }) =>
    supabase.from('orders').update({
      driver_name: driverName,
      driver_id: driverId,
      status: 'Assigned' as any
    }).eq('id', job.id)
  ))

  // SMS notifications for customers with phone numbers
  const smsPromises = assignments
    .filter(({ job }) => job.phone)
    .map(({ job, driverName }) =>
      fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: job.phone,
          body: `Enviroworx: Your ${job.job_type?.toLowerCase() || 'job'} is scheduled for ${targetDate}. Driver: ${driverName}. Reply STOP to opt out.`
        })
      }).catch(() => {})
    )
  await Promise.all(smsPromises)

  return { success: true, message: `Assigned ${assignedCount} jobs.` }
}

// ============================================================
// BOOKINGS (replaces processBooking)
// ============================================================

export async function processBooking(form: {
  customerName: string
  phone: string
  address: string
  skipSize: string
  jobType: string
  deliveryDate: string
  paymentMethod: string
  deliveryComments?: string
  calculatedPrice?: string
  permitCheck?: boolean
  permitWeeks?: number
}) {
  // Auto-create customer if not exists
  let { data: customer } = await supabase
    .from('customers')
    .select('id')
    .ilike('name', form.customerName.trim())
    .single()

  if (!customer) {
    const { data: newCust } = await supabase
      .from('customers')
      .insert({ name: form.customerName.trim(), phone: form.phone, shipping_address: form.address })
      .select('id')
      .single()
    customer = newCust
  }

  // Check custom pricing for this customer/skip size
  const customSkipPrice = await getCustomerPrice(form.customerName.trim(), form.skipSize)
  const effectivePrice = form.calculatedPrice || (customSkipPrice !== null ? String(customSkipPrice) : null)

  let notes = form.deliveryComments || ''
  if (effectivePrice) notes += ` [Net: £${effectivePrice}${customSkipPrice !== null ? ' (Custom)' : ''}]`
  if (form.permitCheck) notes += ` [Permit: ${form.permitWeeks || 1} Wk]`

  const { error } = await supabase.from('orders').insert({
    date: form.deliveryDate,
    status: 'Booked' as any,
    skip_size: form.skipSize,
    job_type: form.jobType as any,
    address: form.address,
    customer_id: customer?.id,
    customer_name: form.customerName.trim(),
    phone: form.phone,
    payment_method: form.paymentMethod as any,
    delivery_comments: notes.trim(),
  })

  if (error) throw error
  return { success: true, message: '✅ Job Booked!' }
}

// ============================================================
// WEIGHBRIDGE (replaces processWeightLog + logActiveTipper)
// ============================================================

export async function logActiveTipper(form: {
  lorryReg: string
  customerName: string
  wasteType: string
  grossWeight: number
  address: string
  skipSize: string
  skipId?: string
}) {
  if (!form.skipSize) return { success: false, message: '❌ ERROR: Select Size!' }
  if (!form.lorryReg) return { success: false, message: '❌ ERROR: Enter Reg!' }

  const { error } = await supabase.from('active_tippers').insert({
    reg: form.lorryReg,
    customer_name: form.customerName,
    waste_type: form.wasteType,
    gross_weight: form.grossWeight,
    address: form.address || 'Unknown',
    skip_size: form.skipSize,
    skip_id: form.skipId || null,
  })

  if (error) throw error
  return { success: true, message: `📥 Truck ${form.lorryReg} logged IN.` }
}

export async function processWeightLog(form: {
  lorryReg: string
  customerName: string
  wasteType: string
  grossWeight: number
  tareWeight: number
  skipSize: string
  skipId?: string
  address: string
  direction: string
  costNet?: number
  paymentMethod?: string
  amountPaid?: number
  tylRef?: string
  wbNotes?: string
  tipperRowIndex?: string
}) {
  if (form.wasteType === 'TBC') return { success: false, message: '❌ ERROR: Waste Type Required!' }

  const gross = form.grossWeight || 0
  const tare = form.tareWeight || 0
  const net = Math.abs(gross - tare)
  const config = DEFAULT_CONFIG

  // Calculate cost — check custom pricing first
  let costNet = form.costNet ?? 0
  if (!form.costNet) {
    const customPrice = await getCustomerPrice(form.customerName, undefined, form.wasteType)
    if (customPrice !== null) {
      costNet = (net / 1000) * customPrice
    } else {
      const isCage = form.skipSize?.toUpperCase() === 'CAGE'
      if (isCage) {
        costNet = 180 + ((net / 1000) * (config.pricesWaste[form.wasteType] || 0))
      } else {
        costNet = (net / 1000) * (config.pricesWaste[form.wasteType] || 0)
      }
    }
  }

  const costGross = costNet * (1 + config.vatRate)

  // Insert weight log
  const { data: weightLog, error: wlError } = await supabase.from('weight_logs').insert({
    customer_name: form.customerName,
    lorry_reg: form.lorryReg,
    skip_size: form.skipSize,
    skip_id: form.skipId || null,
    address: form.address,
    waste_type: form.wasteType as any,
    gross_weight: gross,
    tare_weight: tare,
    direction: form.direction as any,
    notes: form.wbNotes || null,
  }).select('ticket_number').single()

  if (wlError) throw wlError

  // Insert cash log
  await supabase.from('cash_log').insert({
    ticket_number: weightLog.ticket_number,
    customer_name: form.customerName,
    skip_size: form.skipSize,
    address: form.address,
    waste_type: form.wasteType,
    gross_weight: gross,
    net_weight: net,
    cost_net: costNet,
    cost_gross: costGross,
    amount_paid: form.amountPaid || 0,
    payment_method: (form.paymentMethod || 'Invoice') as any,
    tyl_ref: form.tylRef || null,
    comments: form.wbNotes || null,
  })

  if (form.paymentMethod === 'Cash') {
    await logToDrive({
      date: new Date().toISOString(),
      ticketNumber: weightLog.ticket_number || '',
      customerName: form.customerName,
      address: form.address,
      amountPaid: form.amountPaid || 0,
      costGross: costGross,
      paymentMethod: 'Cash'
    }).catch(console.error);
  }

  // Insert weighbridge reading
  await supabase.from('weighbridge_readings').insert({
    weight_kg: gross,
    description: `${form.customerName} - ${form.wasteType} (Ticket ${weightLog.ticket_number})`,
    reg_number: form.lorryReg,
  })

  // Delete tipper from holding pen if applicable
  if (form.tipperRowIndex) {
    await supabase.from('active_tippers').delete().eq('id', form.tipperRowIndex)
  }

  // Update inventory if skip returned
  let inventoryMessage = ''
  if (form.skipId) {
    const { data: skip } = await supabase
      .from('inventory')
      .select('id')
      .ilike('skip_id', form.skipId.trim())
      .single()

    if (skip) {
      await supabase.from('inventory').update({
        status: 'Available' as any,
        delivery_address: null,
        delivery_date: null,
        customer_name: null,
      }).eq('id', skip.id)
      inventoryMessage = `\n✅ Skip ${form.skipId} Available in Yard.`
    } else {
      inventoryMessage = `\n⚠️ Skip ID '${form.skipId}' not in Inventory!`
    }
  }

  return {
    success: true,
    message: `📤 Ticket ${weightLog.ticket_number} Logged.${inventoryMessage}`,
    ticketNumber: weightLog.ticket_number,
  }
}

// ============================================================
// DRIVER APP (replaces getDriverSpecificJobs, completeJob, etc.)
// ============================================================

export async function getDriverJobs(driverName: string) {
  const today = new Date().toISOString().split('T')[0]

  const { data: jobs } = await supabase
    .from('orders')
    .select('*')
    .eq('driver_name', driverName)
    .lte('date', today)
    .in('status', ['Booked', 'Assigned', 'Out for Delivery'])
    .order('address')

  const { data: fuelCards } = await supabase.from('fuel_cards').select('*')

  // For collections, look up the skip currently at the customer
  const enrichedJobs = await Promise.all((jobs ?? []).map(async (job) => {
    let hint = ''
    if (job.job_type === 'Collection' || job.job_type === 'Exchange') {
      const { data: skip } = await supabase
        .from('inventory')
        .select('skip_id')
        .ilike('customer_name', job.customer_name)
        .in('status', ['Delivered', 'In Use'])
        .limit(1)
        .single()
      hint = skip?.skip_id || ''
    }
    return { ...job, hint }
  }))

  return {
    jobs: enrichedJobs,
    fuelCards: fuelCards ?? [],
    config: DEFAULT_CONFIG,
  }
}

export async function completeJob(form: {
  orderId: string
  skipId: string
  jobType: string
  address: string
  customerName: string
  lorryReg: string
  photoUrl?: string      // Upload to Supabase Storage first
  voiceNoteUrl?: string
}) {
  const sid = form.skipId.trim().toUpperCase()

  // Update order to Completed
  await supabase.from('orders').update({
    status: 'Completed' as any,
    skip_id_used: sid,
    photo_proof: form.photoUrl || null,
    voice_note_url: form.voiceNoteUrl || null,
    arrive_time: new Date().toISOString(),
  }).eq('id', form.orderId)

  // Update inventory
  const { data: skip } = await supabase
    .from('inventory')
    .select('id, skip_size')
    .ilike('skip_id', sid)
    .single()

  if (skip) {
    if (form.jobType === 'Delivery' || form.jobType === 'Exchange') {
      await supabase.from('inventory').update({
        status: 'In Use' as any,
        delivery_address: form.address,
        delivery_date: new Date().toISOString(),
        customer_name: form.customerName,
      }).eq('id', skip.id)
    } else if (['Collection', 'Wait & Load', 'Cage Load'].includes(form.jobType)) {
      await supabase.from('inventory').update({
        status: 'Available' as any,
        delivery_address: null,
        delivery_date: null,
        customer_name: null,
      }).eq('id', skip.id)
    }
  }

  return { success: true, message: 'Job Synced.' }
}

export async function driverAbortJob(orderId: string, reason: string) {
  await supabase.from('orders').update({
    status: 'Aborted' as any,
    delivery_comments: reason,
  }).eq('id', orderId)
  return { success: true }
}

// ============================================================
// SHIFTS & TIME TRACKING (replaces verifyPINAndClock)
// ============================================================

export async function clockInOut(driverName: string, pin: string, action: 'IN' | 'OUT', lorryReg?: string) {
  // Verify PIN
  const { data: driver } = await supabase
    .from('drivers')
    .select('*')
    .eq('name', driverName)
    .eq('pin', pin)
    .single()

  if (!driver) return { success: false, message: '❌ Invalid PIN for ' + driverName }

  if (action === 'IN') {
    const { data: shift } = await supabase.from('shifts').insert({
      employee: driverName,
      date: new Date().toISOString().split('T')[0],
      role_or_lorry: lorryReg || 'Driver',
      clock_in: new Date().toISOString(),
    }).select('id').single()

    return { success: true, shiftId: shift?.id, driverName, message: `👋 Welcome ${driverName}. Clocked IN.` }
  }

  // Clock OUT - find open shift
  const today = new Date().toISOString().split('T')[0]
  const { data: openShift } = await supabase
    .from('shifts')
    .select('*')
    .eq('employee', driverName)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .single()

  if (openShift) {
    const clockIn = new Date(openShift.clock_in!)
    const now = new Date()
    const totalMins = Math.floor((now.getTime() - clockIn.getTime()) / 60000)
    const breakMins = 45
    const payableHours = Math.max(0, (totalMins - breakMins) / 60)

    await supabase.from('shifts').update({
      clock_out: now.toISOString(),
      total_mins: totalMins,
      break_mins: breakMins,
      payable_hours: parseFloat(payableHours.toFixed(2)),
    }).eq('id', openShift.id)
  }

  return { success: true, message: `🚪 Goodbye ${driverName}. Clocked OUT.` }
}

// ============================================================
// CUSTOMERS (replaces customer search + add + timeline)
// ============================================================

export async function searchCustomers(query: string) {
  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, billing_address, account_balance')
    .ilike('name', `%${query}%`)
    .limit(10)

  return data ?? []
}

export async function addNewCustomer(form: { name: string; phone: string; email?: string; address?: string }) {
  const { error } = await supabase.from('customers').insert({
    name: form.name,
    phone: form.phone,
    email: form.email,
    billing_address: form.address,
    shipping_address: form.address,
  })
  if (error) throw error
  return { success: true, message: '✅ Added!' }
}

export async function getCustomerTimeline(customerName: string) {
  const config = DEFAULT_CONFIG
  const nameLower = customerName.toLowerCase()

  const [{ data: orders }, { data: cashLogs }] = await Promise.all([
    supabase.from('orders').select('*')
      .ilike('customer_name', nameLower)
      .eq('status', 'Completed')
      .order('date', { ascending: false })
      .limit(50),
    supabase.from('cash_log').select('*')
      .ilike('customer_name', nameLower)
      .order('logged_at', { ascending: false })
      .limit(50),
  ])

  let totalSpend = 0
  let outstandingBalance = 0

  const jobs = (orders ?? []).map(o => {
    const skipSize = o.skip_size?.replace(/\D/g, '') ?? ''
    const netPrice = config.pricesSkip[skipSize] || 0
    const gross = netPrice * (1 + config.vatRate)
    const paid = o.paid
    totalSpend += gross
    if (!paid && o.payment_method === 'Invoice') outstandingBalance += gross
    return { date: o.date, type: o.job_type, size: o.skip_size, address: o.address, skipId: o.skip_id_used, amount: gross, paid }
  })

  const tips = (cashLogs ?? []).map(cl => {
    const gross = cl.cost_gross || 0
    const paid = (cl.amount_paid || 0) >= gross
    totalSpend += gross
    if (!paid && cl.payment_method === 'Invoice') outstandingBalance += gross
    return { date: cl.logged_at, ticket: cl.ticket_number, wasteType: cl.waste_type, netWeight: cl.net_weight, amount: gross, paid }
  })

  return { customer: customerName, totalSpend, outstandingBalance, jobs, tips }
}

// ============================================================
// REPORTS (replaces generateSheetReport)
// ============================================================

export async function generateReport(type: string, startDate: string, endDate: string) {
  switch (type) {
    case 'SEPA': {
      const { data } = await supabase.from('weight_logs').select('*')
        .gte('logged_at', startDate).lte('logged_at', endDate + 'T23:59:59')
        .order('logged_at')
      return data ?? []
    }
    case 'FINANCE': {
      const { data } = await supabase.from('cash_log').select('*')
        .gte('logged_at', startDate).lte('logged_at', endDate + 'T23:59:59')
        .order('logged_at')
      return data ?? []
    }
    case 'ASSETS': {
      const { data } = await supabase.from('inventory').select('*')
        .in('status', ['Delivered', 'In Use'])
      return data ?? []
    }
    case 'DRIVER_MANIFEST': {
      const { data } = await supabase.from('orders').select('*')
        .gte('date', startDate).lte('date', endDate)
        .eq('status', 'Completed')
        .order('driver_name')
      return data ?? []
    }
    default:
      return []
  }
}

// ============================================================
// LIVE WEIGHBRIDGE (replaces getLiveScaleWeight)
// ============================================================

export async function getLiveScaleWeight() {
  const { data } = await supabase
    .from('weighbridge_readings')
    .select('weight_kg, reg_number, timestamp')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single()
  return data
}

export async function getStoredTare(reg: string, skipSize: string) {
  const { data } = await supabase
    .from('tare_weights')
    .select('tare_weight')
    .ilike('lorry_registration', reg.replace(/\s+/g, ''))
    .ilike('skip_size', skipSize)
    .single()
  return data?.tare_weight ?? null
}

// ============================================================
// MISC OPERATIONS
// ============================================================

export async function markJobPaid(id: string, source: 'Orders' | 'CashLog') {
  if (source === 'Orders') {
    await supabase.from('orders').update({ paid: true }).eq('id', id)
  } else {
    // Get cost_gross and set amount_paid = cost_gross
    const { data } = await supabase.from('cash_log').select('cost_gross').eq('id', id).single()
    if (data) {
      await supabase.from('cash_log').update({ amount_paid: data.cost_gross }).eq('id', id)
    }
  }
  return { success: true, message: 'Paid!' }
}

export async function updateBooking(orderId: string, newDate: string, newNotes: string) {
  await supabase.from('orders').update({
    date: newDate,
    delivery_comments: newNotes,
  }).eq('id', orderId)
  return { success: true, message: 'Updated!' }
}

export async function cancelBooking(orderId: string) {
  await supabase.from('orders').update({ status: 'Cancelled' as any }).eq('id', orderId)
  return { success: true, message: 'Cancelled.' }
}

// ============================================================
// FILE UPLOAD HELPER (Supabase Storage)
// ============================================================

export async function uploadFile(bucket: string, file: File, path: string) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return urlData.publicUrl
}

// ============================================================
// DRIVER: FLEET ISSUE LOGGING (replaces driverLogFleetIssue)
// ============================================================

export async function driverLogFleetIssue(form: {
  driverName: string
  lorryReg: string
  issueType: string
  description: string
  photoUrl?: string
}) {
  const { error } = await supabase.from('fleet_logs').insert({
    lorry_reg: form.lorryReg,
    issue_type: form.issueType,
    description: form.description,
    reported_by: form.driverName,
    photo_url: form.photoUrl || null,
    status: 'Open' as any,
  })

  if (error) throw error
  return { success: true, message: `🔧 Issue reported for ${form.lorryReg}` }
}

// ============================================================
// DRIVER: YARD TIP (replaces driverLogYardTip)
// ============================================================

export async function driverLogYardTip(form: {
  driverName: string
  lorryReg: string
  wasteType: string
  customerName: string
  skipId?: string
  skipSize?: string
}) {
  // Log the active tipper (skip entering yard for weighbridge)
  const { error } = await supabase.from('active_tippers').insert({
    reg: form.lorryReg,
    customer_name: form.customerName || form.driverName,
    waste_type: form.wasteType,
    gross_weight: 0,
    address: 'YARD TIP',
    skip_size: form.skipSize || 'Unknown',
    skip_id: form.skipId || null,
  })

  if (error) throw error
  return { success: true, message: `📥 Yard tip logged for ${form.lorryReg}. Proceed to weighbridge.` }
}

// ============================================================
// DRIVER: BREAK TOGGLE (replaces driverToggleBreak)
// ============================================================

export async function driverToggleBreak(driverName: string, action: 'START' | 'END') {
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()

  const { data: openShift } = await supabase
    .from('shifts')
    .select('*')
    .eq('employee', driverName)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .single()

  if (!openShift) return { success: false, message: '❌ No active shift found.' }

  if (action === 'START') {
    // Store break start in a metadata field; use the break_start column or notes
    await supabase.from('shifts').update({
      notes: `break_start:${now}`,
    }).eq('id', openShift.id)
    return { success: true, message: '☕ Break started.', onBreak: true }
  }

  // END break — calculate accumulated break minutes
  const breakStart = openShift.notes?.match(/break_start:(.+)/)?.[1]
  if (breakStart) {
    const breakDuration = Math.floor((Date.now() - new Date(breakStart).getTime()) / 60000)
    const totalBreak = (openShift.break_mins || 0) + breakDuration

    await supabase.from('shifts').update({
      break_mins: totalBreak,
      notes: null,
    }).eq('id', openShift.id)

    return { success: true, message: `☕ Break ended (${breakDuration} min).`, onBreak: false }
  }

  return { success: false, message: '❌ No break in progress.' }
}

// ============================================================
// DRIVER: UPDATE JOB (replaces driverUpdateJob)
// ============================================================

export async function driverUpdateJob(orderId: string, updates: {
  address?: string
  deliveryComments?: string
  phone?: string
}) {
  const payload: Record<string, any> = {}
  if (updates.address) payload.address = updates.address
  if (updates.deliveryComments) payload.delivery_comments = updates.deliveryComments
  if (updates.phone) payload.phone = updates.phone

  if (Object.keys(payload).length === 0) return { success: false, message: 'Nothing to update' }

  const { error } = await supabase.from('orders').update(payload).eq('id', orderId)
  if (error) throw error
  return { success: true, message: '✅ Job updated.' }
}

// ============================================================
// CUSTOM PRICING (makes custom_pricing table work in calculations)
// ============================================================

export async function getCustomerPrice(customerName: string, skipSize?: string, wasteType?: string): Promise<number | null> {
  let query = supabase
    .from('custom_pricing')
    .select('net_price')
    .ilike('customer_name', customerName.trim())

  if (skipSize) query = query.eq('skip_size', skipSize)
  if (wasteType) query = query.eq('waste_type', wasteType)

  const { data } = await query.limit(1).single()
  return data?.net_price ?? null
}

// ============================================================
// SKIP UTILIZATION ANALYTICS (replaces getSkipUtilizationData)
// ============================================================

export async function getSkipUtilization() {
  const { data: inventory } = await supabase.from('inventory').select('*')
  if (!inventory) return { sizes: [], totals: { total: 0, inUse: 0, available: 0, rate: 0 } }

  const sizeMap: Record<string, { total: number; inUse: number; available: number; damaged: number }> = {}
  for (const skip of inventory) {
    const size = skip.skip_size || 'Unknown'
    if (!sizeMap[size]) sizeMap[size] = { total: 0, inUse: 0, available: 0, damaged: 0 }
    sizeMap[size].total++
    if (skip.status === 'Available') sizeMap[size].available++
    else if (['In Use', 'Delivered'].includes(skip.status as string)) sizeMap[size].inUse++
    else if (skip.status === 'Damaged') sizeMap[size].damaged++
  }

  const sizes = Object.entries(sizeMap).map(([size, data]) => ({
    size,
    ...data,
    utilRate: data.total > 0 ? ((data.inUse / data.total) * 100).toFixed(1) + '%' : '0%',
  }))

  const total = inventory.length
  const inUse = inventory.filter(s => ['In Use', 'Delivered'].includes(s.status as string)).length
  const available = inventory.filter(s => s.status === 'Available').length

  return {
    sizes,
    totals: {
      total,
      inUse,
      available,
      rate: total > 0 ? ((inUse / total) * 100).toFixed(1) + '%' : '0%',
    },
  }
}

// ============================================================
// DATA ARCHIVAL (replaces runSmartArchive + runMassCleanup)
// ============================================================

export async function archiveOldOrders(olderThanDays: number = 365) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  // Move completed orders older than cutoff to archive
  const { data: oldOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'Completed')
    .lte('date', cutoffStr)

  if (!oldOrders?.length) return { success: true, message: 'No orders to archive.', count: 0 }

  // Insert into archive table
  const archiveRows = oldOrders.map(o => ({
    original_id: o.id,
    data: o,
    archived_at: new Date().toISOString(),
  }))

  const { error: insertErr } = await supabase.from('archive_orders').insert(archiveRows)
  if (insertErr) throw insertErr

  // Delete from main orders table
  const ids = oldOrders.map(o => o.id)
  const { error: deleteErr } = await supabase.from('orders').delete().in('id', ids)
  if (deleteErr) throw deleteErr

  return { success: true, message: `Archived ${oldOrders.length} orders older than ${olderThanDays} days.`, count: oldOrders.length }
}

// ============================================================
// LORRY MANAGEMENT
// ============================================================

export async function getLorries() {
  const { data } = await supabase.from('lorries').select('*').order('registration')
  return data ?? []
}

export async function updateLorry(id: string, updates: { status?: string; mileage?: number; mot_due?: string; tax_due?: string }) {
  const { error } = await supabase.from('lorries').update(updates).eq('id', id)
  if (error) throw error
  return { success: true }
}

// ============================================================
// HELPERS
// ============================================================

function getWeekStart() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().split('T')[0]
}
