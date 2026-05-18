/**
 * FLEET MANAGEMENT
 * + LORRY MANAGEMENT
 * + SHIFTS & TIME TRACKING (replaces verifyPINAndClock)
 * + DRIVER: FLEET ISSUE LOGGING (replaces driverLogFleetIssue)
 * + DRIVER: YARD TIP (replaces driverLogYardTip)
 * + DRIVER: BREAK TOGGLE (replaces driverToggleBreak)
 */
import { supabase } from '../supabase'

// ── Lorry Management ─────────────────────────────────────────

export async function getLorries() {
  const { data } = await supabase.from('lorries').select('*').order('registration')
  return data ?? []
}

export async function getDriversList() {
  const { data } = await supabase.from('drivers').select('*').order('name')
  return data ?? []
}

export async function updateDriverPin(id: string, pin: string) {
  const { error } = await supabase.from('drivers').update({ pin }).eq('id', id)
  if (error) throw error
  return { success: true }
}

export async function updateLorry(id: string, updates: { status?: string; mileage?: number; mot_due?: string; tax_due?: string }) {
  const { error } = await supabase.from('lorries').update(updates).eq('id', id)
  if (error) throw error
  return { success: true }
}

// ── Shifts & Time Tracking ───────────────────────────────────

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

// ── Driver: Fleet Issue Logging ──────────────────────────────

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
    status: 'Open',
  })

  if (error) throw error
  return { success: true, message: `🔧 Issue reported for ${form.lorryReg}` }
}

// ── Driver: Yard Tip ─────────────────────────────────────────

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

// ── Driver: Break Toggle ─────────────────────────────────────

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
