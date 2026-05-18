/**
 * DISPATCH (replaces dispatchJobs filtering)
 * + WEIGHBRIDGE operations (logActiveTipper, processWeightLog, etc.)
 * + FILE UPLOAD helper
 */
import { supabase } from '../supabase'
import { DEFAULT_CONFIG } from '../config'
import { logToDrive } from '@/app/actions/drive'
import type { Database } from '../database.types'
import { getCustomerPrice } from './config'

type OrderRow = Database['public']['Tables']['orders']['Row']

// ── Dispatch Job Management ──────────────────────────────────

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
  const assignments: { job: OrderRow; driverName: string; driverId: string }[] = []

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
      status: 'Assigned'
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

// ── Driver Job Management ────────────────────────────────────

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
      const skipQuery = supabase
        .from('inventory')
        .select('skip_id')
        .in('status', ['Delivered', 'In Use'])
      // Use customer_id FK when available (Phase 9), fallback to ilike on name
      if (job.customer_id) {
        skipQuery.eq('customer_id', job.customer_id)
      } else {
        skipQuery.ilike('customer_name', job.customer_name)
      }
      const { data: skip } = await skipQuery.limit(1).single()
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
    status: 'Completed',
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
        status: 'In Use',
        delivery_address: form.address,
        delivery_date: new Date().toISOString(),
        customer_name: form.customerName,
      }).eq('id', skip.id)
    } else if (['Collection', 'Wait & Load', 'Cage Load'].includes(form.jobType)) {
      await supabase.from('inventory').update({
        status: 'Available',
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
    status: 'Aborted',
    delivery_comments: reason,
  }).eq('id', orderId)
  return { success: true }
}

export async function driverUpdateJob(orderId: string, updates: {
  address?: string
  deliveryComments?: string
  phone?: string
}) {
  const payload: Record<string, string> = {}
  if (updates.address) payload.address = updates.address
  if (updates.deliveryComments) payload.delivery_comments = updates.deliveryComments
  if (updates.phone) payload.phone = updates.phone

  if (Object.keys(payload).length === 0) return { success: false, message: 'Nothing to update' }

  const { error } = await supabase.from('orders').update(payload).eq('id', orderId)
  if (error) throw error
  return { success: true, message: '✅ Job updated.' }
}

// ── Weighbridge Operations ───────────────────────────────────

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
    waste_type: form.wasteType,
    gross_weight: gross,
    tare_weight: tare,
    direction: form.direction,
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
    payment_method: (form.paymentMethod || 'Invoice') as Database['public']['Enums']['payment_method'],
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
    }).catch(console.error)
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
        status: 'Available',
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

// ── Live Weighbridge ─────────────────────────────────────────

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

// ── File Upload Helper ───────────────────────────────────────

export async function uploadFile(bucket: string, file: File, path: string) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return urlData.publicUrl
}
