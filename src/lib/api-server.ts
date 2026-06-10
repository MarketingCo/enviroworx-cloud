/**
 * SERVER API LAYER (service role)
 *
 * Every function takes a required `tenantId` — always derived from the
 * caller's session (see operations.ts / office-data.ts), never from
 * client input. Because these run with the service role (RLS bypassed),
 * the tenant filter on every query is the isolation boundary.
 */
import 'server-only'
import { supabaseAdmin as supabase } from './supabase'
import { sendSms } from './sms'
import { DEFAULT_CONFIG } from './config'
import { logToDrive } from '@/app/actions/drive'

export async function getCompanyName(tenantId: string): Promise<string> {
  const { data } = await supabase
    .from('config')
    .select('value')
    .eq('tenant_id', tenantId)
    .eq('key', 'company_name')
    .maybeSingle()
  return (data?.value as string) || DEFAULT_CONFIG.companyName || 'Enviroworx'
}

// ============================================================
// DISPATCH
// ============================================================

export async function getDispatchJobs(tenantId: string, targetDate: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customer:customers(name, phone, billing_address)')
    .eq('tenant_id', tenantId)
    .eq('date', targetDate)
    .not('status', 'in', '("Completed","Cancelled")')
    .order('driver_name', { ascending: true, nullsFirst: true })

  if (error) throw error
  return data ?? []
}

export async function assignDriverToJob(
  tenantId: string,
  orderId: string,
  driverName: string,
  driverId: string | null
) {
  const { error } = await supabase
    .from('orders')
    .update({
      driver_name: driverName || null,
      driver_id: driverId,
      status: driverName ? 'Assigned' : 'Booked',
    })
    .eq('tenant_id', tenantId)
    .eq('id', orderId)

  if (error) throw error

  if (driverName) {
    const { data: order } = await supabase
      .from('orders')
      .select('phone')
      .eq('tenant_id', tenantId)
      .eq('id', orderId)
      .maybeSingle()
    if (order?.phone) {
      const companyName = await getCompanyName(tenantId)
      await sendSms(
        order.phone,
        `${companyName}: Your skip is on the route plan today. Driver: ${driverName}`
      )
    }
  }
  return { success: true }
}

export async function autoAssignJobs(tenantId: string, targetDate: string) {
  const { data: unassigned } = await supabase
    .from('orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('date', targetDate)
    .is('driver_name', null)
    .in('status', ['Booked', 'Aborted'])
    .order('address')

  const { data: drivers } = await supabase
    .from('drivers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'Available')
  const { data: combos } = await supabase
    .from('skip_combos')
    .select('combination')
    .eq('tenant_id', tenantId)

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
      status: 'Assigned' as any,
    }).eq('tenant_id', tenantId).eq('id', job.id)
  ))

  const companyName = await getCompanyName(tenantId)
  const smsPromises = assignments
    .filter(({ job }) => job.phone)
    .map(({ job, driverName }) =>
      sendSms(
        job.phone,
        `${companyName}: Your ${job.job_type?.toLowerCase() || 'job'} is scheduled for ${targetDate}. Driver: ${driverName}. Reply STOP to opt out.`
      ).catch(() => {})
    )
  await Promise.all(smsPromises)

  return { success: true, message: `Assigned ${assignedCount} jobs.` }
}

// ============================================================
// BOOKINGS
// ============================================================

export async function processBooking(form: {
  tenantId: string
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
  const tenantId = form.tenantId

  // Auto-create customer if not exists (scoped to tenant)
  let { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('name', form.customerName.trim())
    .limit(1)
    .maybeSingle()

  if (!customer) {
    const { data: newCust } = await supabase
      .from('customers')
      .insert({
        tenant_id: tenantId,
        name: form.customerName.trim(),
        phone: form.phone,
        shipping_address: form.address,
      } as any)
      .select('id')
      .single()
    customer = newCust
  }

  // Check custom pricing for this customer/skip size
  const customSkipPrice = await getCustomerPrice(tenantId, form.customerName.trim(), form.skipSize)
  const effectivePrice = form.calculatedPrice || (customSkipPrice !== null ? String(customSkipPrice) : null)

  let notes = form.deliveryComments || ''
  if (effectivePrice) notes += ` [Net: £${effectivePrice}${customSkipPrice !== null ? ' (Custom)' : ''}]`
  if (form.permitCheck) notes += ` [Permit: ${form.permitWeeks || 1} Wk]`

  const { error } = await supabase.from('orders').insert({
    tenant_id: tenantId,
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
  } as any)

  if (error) throw error
  return { success: true, message: '✅ Job Booked!' }
}

// ============================================================
// SKIP MAP — place / move / collect a skip pin on the office map
// ============================================================

/** Drop or update a skip pin at given coordinates. Upserts by (tenant, skip_id). */
export async function placeSkipOnMap(form: {
  tenantId: string
  skipId?: string
  skipSize: string
  customerName: string
  customerPhone?: string
  address?: string
  latitude: number
  longitude: number
  deliveryDate?: string
  comments?: string
}) {
  if (!form.skipSize) return { success: false, message: '❌ Select a skip size' }
  if (typeof form.latitude !== 'number' || typeof form.longitude !== 'number') {
    return { success: false, message: '❌ Missing map location' }
  }

  // Reuse an existing skip number if given, otherwise generate a stable one.
  const skipId =
    form.skipId?.trim() ||
    `MAP-${form.skipSize}-${Date.now().toString(36).toUpperCase()}`

  const { error } = await supabase.from('inventory').upsert(
    {
      tenant_id: form.tenantId,
      skip_id: skipId,
      skip_size: form.skipSize,
      customer_name: form.customerName?.trim() || null,
      customer_phone: form.customerPhone?.trim() || null,
      delivery_address: form.address?.trim() || null,
      delivery_date: form.deliveryDate || new Date().toISOString(),
      latitude: form.latitude,
      longitude: form.longitude,
      comments: form.comments?.trim() || null,
      status: 'In Use' as any,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: 'tenant_id,skip_id' }
  )

  if (error) throw error
  return { success: true, skipId, message: `📍 Skip ${skipId} placed` }
}

/** Reposition an existing skip pin (used when a marker is dragged). */
export async function moveSkipLocation(tenantId: string, id: string, latitude: number, longitude: number) {
  const { error } = await supabase
    .from('inventory')
    .update({ latitude, longitude, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
  return { success: true }
}

/** Mark a skip collected — clears it off the map and frees it. */
export async function collectSkipFromMap(tenantId: string, id: string) {
  const { error } = await supabase
    .from('inventory')
    .update({
      status: 'Available' as any,
      latitude: null,
      longitude: null,
      customer_name: null,
      customer_phone: null,
      delivery_address: null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
  return { success: true, message: '✅ Skip collected' }
}

// ============================================================
// WEIGHBRIDGE
// ============================================================

export async function logActiveTipper(form: {
  tenantId: string
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
    tenant_id: form.tenantId,
    reg: form.lorryReg,
    customer_name: form.customerName,
    waste_type: form.wasteType,
    gross_weight: form.grossWeight,
    address: form.address || 'Unknown',
    skip_size: form.skipSize,
    skip_id: form.skipId || null,
  } as any)

  if (error) throw error
  return { success: true, message: `📥 Truck ${form.lorryReg} logged IN.` }
}

export async function processWeightLog(form: {
  tenantId: string
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
  ewcCodeId?: string
  ewcCode?: string
}) {
  if (form.wasteType === 'TBC') return { success: false, message: '❌ ERROR: Waste Type Required!' }

  const tenantId = form.tenantId
  const gross = form.grossWeight || 0
  const tare = form.tareWeight || 0
  const net = Math.abs(gross - tare)
  const config = DEFAULT_CONFIG

  // Calculate cost — check custom pricing first
  let costNet = form.costNet ?? 0
  if (!form.costNet) {
    const customPrice = await getCustomerPrice(tenantId, form.customerName, undefined, form.wasteType)
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
  const { data: weightLog, error: wlError } = await supabase
    .from('weight_logs')
    .insert({
      tenant_id: tenantId,
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
      ewc_code_id: form.ewcCodeId || null,
      ewc_code: form.ewcCode || null,
    } as any)
    .select('ticket_number, id')
    .single()

  if (wlError) throw wlError

  // Insert cash log
  await supabase.from('cash_log').insert({
    tenant_id: tenantId,
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
  } as any)

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
    tenant_id: tenantId,
    weight_kg: gross,
    description: `${form.customerName} - ${form.wasteType} (Ticket ${weightLog.ticket_number})`,
    reg_number: form.lorryReg,
  } as any)

  // Delete tipper from holding pen if applicable
  if (form.tipperRowIndex) {
    await supabase
      .from('active_tippers')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', form.tipperRowIndex)
  }

  // Update inventory if skip returned
  let inventoryMessage = ''
  if (form.skipId) {
    const { data: skip } = await supabase
      .from('inventory')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('skip_id', form.skipId.trim())
      .limit(1)
      .maybeSingle()

    if (skip) {
      await supabase.from('inventory').update({
        status: 'Available' as any,
        delivery_address: null,
        delivery_date: null,
        customer_name: null,
      }).eq('tenant_id', tenantId).eq('id', skip.id)
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

export async function getStoredTare(tenantId: string, reg: string, skipSize: string) {
  const { data } = await supabase
    .from('tare_weights')
    .select('tare_weight')
    .eq('tenant_id', tenantId)
    .ilike('lorry_registration', reg.replace(/\s+/g, ''))
    .ilike('skip_size', skipSize)
    .limit(1)
    .maybeSingle()
  return data?.tare_weight ?? null
}

// ============================================================
// DRIVER APP
// ============================================================

export async function getDriverJobs(tenantId: string, driverName: string) {
  const today = new Date().toISOString().split('T')[0]

  const { data: jobs } = await supabase
    .from('orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('driver_name', driverName)
    .lte('date', today)
    .in('status', ['Booked', 'Assigned', 'Out for Delivery'])
    .order('route_order', { ascending: true, nullsFirst: false })
    .order('address')

  const { data: fuelCards } = await supabase
    .from('fuel_cards')
    .select('*')
    .eq('tenant_id', tenantId)

  // For collections, look up the skip currently at the customer
  const enrichedJobs = await Promise.all((jobs ?? []).map(async (job) => {
    let hint = ''
    if (job.job_type === 'Collection' || job.job_type === 'Exchange') {
      const { data: skip } = await supabase
        .from('inventory')
        .select('skip_id')
        .eq('tenant_id', tenantId)
        .ilike('customer_name', job.customer_name ?? '')
        .in('status', ['Delivered', 'In Use'])
        .limit(1)
        .maybeSingle()
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

export async function completeJob(tenantId: string, form: {
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
  }).eq('tenant_id', tenantId).eq('id', form.orderId)

  // Update inventory
  const { data: skip } = await supabase
    .from('inventory')
    .select('id, skip_size')
    .eq('tenant_id', tenantId)
    .ilike('skip_id', sid)
    .limit(1)
    .maybeSingle()

  if (skip) {
    if (form.jobType === 'Delivery' || form.jobType === 'Exchange') {
      await supabase.from('inventory').update({
        status: 'In Use' as any,
        delivery_address: form.address,
        delivery_date: new Date().toISOString(),
        customer_name: form.customerName,
      }).eq('tenant_id', tenantId).eq('id', skip.id)
    } else if (['Collection', 'Wait & Load', 'Cage Load'].includes(form.jobType)) {
      await supabase.from('inventory').update({
        status: 'Available' as any,
        delivery_address: null,
        delivery_date: null,
        customer_name: null,
      }).eq('tenant_id', tenantId).eq('id', skip.id)
    }
  }

  return { success: true, message: 'Job Synced.' }
}

export async function driverAbortJob(tenantId: string, orderId: string, reason: string) {
  await supabase.from('orders').update({
    status: 'Aborted' as any,
    delivery_comments: reason,
  }).eq('tenant_id', tenantId).eq('id', orderId)
  return { success: true }
}

// ============================================================
// SHIFTS & TIME TRACKING
// ============================================================

export async function clockInOut(
  tenantId: string,
  driverName: string,
  pin: string,
  action: 'IN' | 'OUT',
  lorryReg?: string
) {
  // Verify PIN (scoped to tenant)
  const { data: driver } = await supabase
    .from('drivers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('name', driverName)
    .eq('pin_code', pin)
    .limit(1)
    .maybeSingle()

  if (!driver) return { success: false, message: '❌ Invalid PIN for ' + driverName }

  if (action === 'IN') {
    const { data: shift } = await supabase.from('shifts').insert({
      tenant_id: tenantId,
      employee: driverName,
      shift_date: new Date().toISOString().split('T')[0],
      role_or_lorry: lorryReg || 'Driver',
      clock_in: new Date().toISOString(),
    } as any).select('id').single()

    return { success: true, shiftId: shift?.id, driverName, message: `👋 Welcome ${driverName}. Clocked IN.` }
  }

  // Clock OUT - find open shift
  const { data: openShift } = await supabase
    .from('shifts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('employee', driverName)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle()

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
    }).eq('tenant_id', tenantId).eq('id', openShift.id)
  }

  return { success: true, message: `🚪 Goodbye ${driverName}. Clocked OUT.` }
}

export async function driverToggleBreak(tenantId: string, driverName: string, action: 'START' | 'END') {
  const now = new Date().toISOString()

  const { data: openShift } = await supabase
    .from('shifts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('employee', driverName)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!openShift) return { success: false, message: '❌ No active shift found.' }

  if (action === 'START') {
    await supabase.from('shifts').update({
      notes: `break_start:${now}`,
    }).eq('tenant_id', tenantId).eq('id', openShift.id)
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
    }).eq('tenant_id', tenantId).eq('id', openShift.id)

    return { success: true, message: `☕ Break ended (${breakDuration} min).`, onBreak: false }
  }

  return { success: false, message: '❌ No break in progress.' }
}

// ============================================================
// MISC OPERATIONS
// ============================================================

export async function markJobPaid(tenantId: string, id: string, source: 'Orders' | 'CashLog') {
  if (source === 'Orders') {
    await supabase.from('orders').update({ paid: true }).eq('tenant_id', tenantId).eq('id', id)
  } else {
    // Get cost_gross and set amount_paid = cost_gross
    const { data } = await supabase
      .from('cash_log')
      .select('cost_gross')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle()
    if (data) {
      await supabase
        .from('cash_log')
        .update({ amount_paid: data.cost_gross })
        .eq('tenant_id', tenantId)
        .eq('id', id)
    }
  }
  return { success: true, message: 'Paid!' }
}

export async function cancelBooking(tenantId: string, orderId: string) {
  await supabase
    .from('orders')
    .update({ status: 'Cancelled' as any })
    .eq('tenant_id', tenantId)
    .eq('id', orderId)
  return { success: true, message: 'Cancelled.' }
}

// ============================================================
// DRIVER: FLEET ISSUE LOGGING
// ============================================================

export async function driverLogFleetIssue(tenantId: string, form: {
  driverName: string
  lorryReg: string
  issueType: string
  description: string
  photoUrl?: string
}) {
  const { error } = await supabase.from('fleet_logs').insert({
    tenant_id: tenantId,
    lorry_reg: form.lorryReg,
    issue_type: form.issueType,
    description: form.description,
    reported_by: form.driverName,
    photo_url: form.photoUrl || null,
    status: 'Open' as any,
  } as any)

  if (error) throw error
  return { success: true, message: `🔧 Issue reported for ${form.lorryReg}` }
}

// ============================================================
// DRIVER: YARD TIP
// ============================================================

export async function driverLogYardTip(tenantId: string, form: {
  driverName: string
  lorryReg: string
  wasteType: string
  customerName: string
  skipId?: string
  skipSize?: string
}) {
  // Log the active tipper (skip entering yard for weighbridge)
  const { error } = await supabase.from('active_tippers').insert({
    tenant_id: tenantId,
    reg: form.lorryReg,
    customer_name: form.customerName || form.driverName,
    waste_type: form.wasteType,
    gross_weight: 0,
    address: 'YARD TIP',
    skip_size: form.skipSize || 'Unknown',
    skip_id: form.skipId || null,
  } as any)

  if (error) throw error
  return { success: true, message: `📥 Yard tip logged for ${form.lorryReg}. Proceed to weighbridge.` }
}

// ============================================================
// DRIVER: UPDATE JOB
// ============================================================

export async function driverUpdateJob(tenantId: string, orderId: string, updates: {
  address?: string
  deliveryComments?: string
  phone?: string
  status?: string
}) {
  const payload: Record<string, any> = {}
  if (updates.address) payload.address = updates.address
  if (updates.deliveryComments) payload.delivery_comments = updates.deliveryComments
  if (updates.phone) payload.phone = updates.phone
  if (updates.status) payload.status = updates.status

  if (Object.keys(payload).length === 0) return { success: false, message: 'Nothing to update' }

  const { error } = await supabase
    .from('orders')
    .update(payload)
    .eq('tenant_id', tenantId)
    .eq('id', orderId)
  if (error) throw error
  return { success: true, message: '✅ Job updated.' }
}

// ============================================================
// CUSTOM PRICING
// ============================================================

export async function getCustomPricingList(tenantId: string) {
  const { data } = await supabase
    .from('custom_pricing')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('customer_name')
  return data ?? []
}

export async function addCustomPrice(
  tenantId: string,
  payload: { customer_name: string; skip_size?: string; waste_type?: string; net_price: number }
) {
  const { error } = await supabase
    .from('custom_pricing')
    .insert({ ...payload, tenant_id: tenantId } as any)
  if (error) throw error
  return { success: true }
}

export async function deleteCustomPrice(tenantId: string, id: string) {
  const { error } = await supabase
    .from('custom_pricing')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
  return { success: true }
}

export async function getCustomerPrice(
  tenantId: string,
  customerName: string,
  skipSize?: string,
  wasteType?: string
): Promise<number | null> {
  let query = supabase
    .from('custom_pricing')
    .select('net_price')
    .eq('tenant_id', tenantId)
    .ilike('customer_name', customerName.trim())

  if (skipSize) query = query.eq('skip_size', skipSize)
  if (wasteType) query = query.eq('waste_type', wasteType)

  const { data } = await query.limit(1).maybeSingle()
  return data?.net_price ?? null
}

// ============================================================
// SKIP UTILIZATION ANALYTICS
// ============================================================

export async function getSkipUtilization(tenantId: string) {
  const { data: inventory } = await supabase
    .from('inventory')
    .select('*')
    .eq('tenant_id', tenantId)
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
// DATA ARCHIVAL
// ============================================================

export async function archiveOldOrders(tenantId: string, olderThanDays: number = 365) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  // Move completed orders older than cutoff to archive
  const { data: oldOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'Completed')
    .lte('date', cutoffStr)

  if (!oldOrders?.length) return { success: true, message: 'No orders to archive.', count: 0 }

  // Insert into archive table
  const archiveRows = oldOrders.map(o => ({
    tenant_id: tenantId,
    original_id: o.id,
    data: o,
    archived_at: new Date().toISOString(),
  }))

  const { error: insertErr } = await supabase.from('archive_orders').insert(archiveRows as any)
  if (insertErr) throw insertErr

  // Delete from main orders table
  const ids = oldOrders.map(o => o.id)
  const { error: deleteErr } = await supabase
    .from('orders')
    .delete()
    .eq('tenant_id', tenantId)
    .in('id', ids)
  if (deleteErr) throw deleteErr

  return { success: true, message: `Archived ${oldOrders.length} orders older than ${olderThanDays} days.`, count: oldOrders.length }
}

// ============================================================
// FLEET MANAGEMENT
// ============================================================

export async function getLorries(tenantId: string) {
  const { data } = await supabase
    .from('lorries')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('registration')
  return data ?? []
}

/** Driver list for office UI — deliberately excludes pin_code. */
export async function getDriversList(tenantId: string) {
  const { data } = await supabase
    .from('drivers')
    .select('id, name, phone, status, created_at, updated_at, tenant_id')
    .eq('tenant_id', tenantId)
    .order('name')
  return data ?? []
}

export async function updateDriverPin(tenantId: string, id: string, pin: string) {
  const { error } = await supabase
    .from('drivers')
    .update({ pin_code: pin })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
  return { success: true }
}

export async function updateConfig(tenantId: string, key: string, value: any) {
  const { error } = await supabase
    .from('config')
    .upsert(
      { tenant_id: tenantId, key, value, updated_at: new Date().toISOString() } as any,
      { onConflict: 'key,tenant_id' }
    )
  if (error) throw error
  return { success: true }
}

export async function updateLorry(
  tenantId: string,
  id: string,
  updates: { status?: string; mileage?: number; mot_due?: string; tax_due?: string }
) {
  const { error } = await supabase
    .from('lorries')
    .update(updates)
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
  return { success: true }
}

// ============================================================
// OVERSTAY SMS
// ============================================================

export async function sendOverstaySms(tenantId: string, skipId: string) {
  const { data: skip, error } = await supabase
    .from('inventory')
    .select('skip_id, skip_size, customer_name, customer_phone, delivery_address, delivery_date, comments')
    .eq('tenant_id', tenantId)
    .eq('skip_id', skipId)
    .limit(1)
    .maybeSingle()
  if (error || !skip) return { success: false, message: 'Skip not found' }
  if (!skip.customer_phone) return { success: false, message: 'No phone number for this customer' }
  const days = skip.delivery_date
    ? Math.round((Date.now() - new Date(skip.delivery_date).getTime()) / 86400000)
    : null
  const companyName = await getCompanyName(tenantId)
  const daysText = days !== null ? ` for ${days} days` : ''
  const message =
    `Hi ${skip.customer_name ?? 'there'}, your ${skip.skip_size}yd skip at ${skip.delivery_address ?? 'your site'} has been in position${daysText}. ` +
    `Please call ${DEFAULT_CONFIG.officePhone} to arrange collection or extend your hire. ${companyName}.`
  const res = await sendSms(skip.customer_phone, message)
  if (!res.success) return { success: false, message: 'SMS failed to send' }
  return { success: true, message: `SMS sent to ${skip.customer_phone}` }
}
