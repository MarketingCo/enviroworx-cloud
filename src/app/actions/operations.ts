'use server'

import { requireDriverSession } from '@/lib/session'
import { withOfficeAction } from '@/lib/office-action'
import { writeAudit, auditFromSession } from '@/lib/audit'
import { toActionError } from '@/lib/action-errors'
import * as server from '@/lib/api-server'

export async function assignDriverToJobAction(
  orderId: string,
  driverName: string,
  driverId: string | null
) {
  return withOfficeAction(
    {
      type: 'dispatch.assign',
      message: `Assigned ${driverName} to job`,
      entityType: 'order',
      entityId: orderId,
      metadata: { driverName, driverId },
    },
    (session) => server.assignDriverToJob(session.tenantId, orderId, driverName, driverId)
  )
}

export async function autoAssignJobsAction(targetDate: string) {
  return withOfficeAction(
    {
      type: 'dispatch.auto_assign',
      message: `Auto-assign jobs for ${targetDate}`,
      metadata: { targetDate },
    },
    (session) => server.autoAssignJobs(session.tenantId, targetDate)
  )
}

export async function processBookingAction(
  form: Omit<Parameters<typeof server.processBooking>[0], 'tenantId'>
) {
  return withOfficeAction(
    {
      type: 'booking.create',
      message: `Booking: ${form.customerName} — ${form.jobType}`,
      entityType: 'customer',
      metadata: { jobType: form.jobType, address: form.address },
    },
    (session) => server.processBooking({ ...form, tenantId: session.tenantId })
  )
}

export async function logActiveTipperAction(
  form: Omit<Parameters<typeof server.logActiveTipper>[0], 'tenantId'>
) {
  return withOfficeAction(
    { type: 'weighbridge.tipper', message: `Tipper log: ${form.customerName}` },
    (session) => server.logActiveTipper({ ...form, tenantId: session.tenantId })
  )
}

export async function placeSkipOnMapAction(
  form: Omit<Parameters<typeof server.placeSkipOnMap>[0], 'tenantId'>
) {
  return withOfficeAction(
    {
      type: 'skip.place',
      message: `Placed ${form.skipSize}yd skip${form.customerName ? ` for ${form.customerName}` : ''}`,
      entityType: 'inventory',
      entityId: form.skipId,
      metadata: { skipSize: form.skipSize, address: form.address },
    },
    (session) => server.placeSkipOnMap({ ...form, tenantId: session.tenantId })
  )
}

export async function moveSkipLocationAction(id: string, latitude: number, longitude: number) {
  return withOfficeAction(
    { type: 'skip.move', message: 'Moved skip pin', entityType: 'inventory', entityId: id },
    (session) => server.moveSkipLocation(session.tenantId, id, latitude, longitude)
  )
}

export async function collectSkipFromMapAction(id: string) {
  return withOfficeAction(
    { type: 'skip.collect', message: 'Collected skip', entityType: 'inventory', entityId: id },
    (session) => server.collectSkipFromMap(session.tenantId, id)
  )
}

export async function processWeightLogAction(
  form: Omit<Parameters<typeof server.processWeightLog>[0], 'tenantId'>
) {
  return withOfficeAction(
    {
      type: 'weighbridge.weight',
      message: `Weighbridge: ${form.customerName}`,
      metadata: { grossWeight: form.grossWeight, customerName: form.customerName },
    },
    (session) => server.processWeightLog({ ...form, tenantId: session.tenantId })
  )
}

export async function markJobPaidAction(id: string, source: 'Orders' | 'CashLog') {
  return withOfficeAction(
    {
      type: 'finance.mark_paid',
      message: `Marked paid (${source})`,
      entityType: source === 'Orders' ? 'order' : 'cash_log',
      entityId: id,
    },
    (session) => server.markJobPaid(session.tenantId, id, source)
  )
}

export async function cancelBookingAction(orderId: string) {
  return withOfficeAction(
    {
      type: 'booking.cancel',
      message: 'Booking cancelled',
      entityType: 'order',
      entityId: orderId,
    },
    (session) => server.cancelBooking(session.tenantId, orderId)
  )
}

export async function addCustomPriceAction(
  payload: Parameters<typeof server.addCustomPrice>[1]
) {
  return withOfficeAction(
    {
      type: 'settings.custom_price_add',
      message: `Custom price: ${payload.customer_name}`,
    },
    (session) => server.addCustomPrice(session.tenantId, payload)
  )
}

export async function deleteCustomPriceAction(id: string) {
  return withOfficeAction(
    {
      type: 'settings.custom_price_delete',
      message: 'Custom price removed',
      entityType: 'custom_pricing',
      entityId: id,
    },
    (session) => server.deleteCustomPrice(session.tenantId, id)
  )
}

export async function updateDriverPinAction(id: string, pin: string) {
  return withOfficeAction(
    {
      type: 'settings.driver_pin',
      message: 'Driver PIN updated',
      entityType: 'driver',
      entityId: id,
    },
    (session) => server.updateDriverPin(session.tenantId, id, pin)
  )
}

export async function updateConfigAction(key: string, value: unknown) {
  return withOfficeAction(
    {
      type: 'settings.config',
      message: `Config updated: ${key}`,
      metadata: { key },
    },
    (session) => server.updateConfig(session.tenantId, key, value)
  )
}

export async function updateLorryAction(
  id: string,
  updates: Parameters<typeof server.updateLorry>[2]
) {
  return withOfficeAction(
    {
      type: 'fleet.lorry_update',
      message: 'Lorry updated',
      entityType: 'lorry',
      entityId: id,
      metadata: { ...updates },
    },
    (session) => server.updateLorry(session.tenantId, id, updates)
  )
}

/** Driver app: jobs for the signed-in driver (identity comes from the session). */
export async function getDriverJobsAction() {
  const session = await requireDriverSession()
  return server.getDriverJobs(session.tenantId, session.name)
}

export async function completeJobAction(form: Parameters<typeof server.completeJob>[1]) {
  const session = await requireDriverSession()
  try {
    const result = await server.completeJob(session.tenantId, form)
    await writeAudit(
      auditFromSession(session, {
        type: 'driver.complete',
        message: `Completed job at ${form.address}`,
        entityType: 'order',
        entityId: form.orderId,
        metadata: { skipId: form.skipId, jobType: form.jobType },
      })
    )
    return result
  } catch (error) {
    throw toActionError(error)
  }
}

export async function driverAbortJobAction(orderId: string, reason: string) {
  const session = await requireDriverSession()
  try {
    const result = await server.driverAbortJob(session.tenantId, orderId, reason)
    await writeAudit(
      auditFromSession(session, {
        type: 'driver.abort',
        message: `Aborted job: ${reason}`,
        entityType: 'order',
        entityId: orderId,
      })
    )
    return result
  } catch (error) {
    throw toActionError(error)
  }
}

export async function clockInOutAction(
  driverName: string,
  pin: string,
  action: 'IN' | 'OUT',
  lorryReg?: string
) {
  const session = await requireDriverSession()
  try {
    const result = await server.clockInOut(session.tenantId, driverName, pin, action, lorryReg)
    await writeAudit(
      auditFromSession(session, {
        type: action === 'IN' ? 'driver.clock_in' : 'driver.clock_out',
        message: `${driverName} clocked ${action}`,
        metadata: { lorryReg },
      })
    )
    return result
  } catch (error) {
    throw toActionError(error)
  }
}

export async function driverLogFleetIssueAction(
  form: Parameters<typeof server.driverLogFleetIssue>[1]
) {
  const session = await requireDriverSession()
  try {
    const result = await server.driverLogFleetIssue(session.tenantId, form)
    await writeAudit(
      auditFromSession(session, {
        type: 'driver.fleet_issue',
        message: 'Fleet issue logged',
      })
    )
    return result
  } catch (error) {
    throw toActionError(error)
  }
}

export async function driverLogYardTipAction(
  form: Parameters<typeof server.driverLogYardTip>[1]
) {
  const session = await requireDriverSession()
  try {
    const result = await server.driverLogYardTip(session.tenantId, form)
    await writeAudit(
      auditFromSession(session, {
        type: 'driver.yard_tip',
        message: 'Yard tip logged',
      })
    )
    return result
  } catch (error) {
    throw toActionError(error)
  }
}

export async function driverToggleBreakAction(driverName: string, action: 'START' | 'END') {
  const session = await requireDriverSession()
  try {
    const result = await server.driverToggleBreak(session.tenantId, driverName, action)
    await writeAudit(
      auditFromSession(session, {
        type: 'driver.break',
        message: `Break ${action}`,
        metadata: { driverName },
      })
    )
    return result
  } catch (error) {
    throw toActionError(error)
  }
}

export async function driverUpdateJobAction(
  orderId: string,
  updates: Parameters<typeof server.driverUpdateJob>[2]
) {
  const session = await requireDriverSession()
  try {
    const result = await server.driverUpdateJob(session.tenantId, orderId, updates)
    await writeAudit(
      auditFromSession(session, {
        type: 'driver.job_update',
        message: updates.status ? `Status → ${updates.status}` : 'Job updated',
        entityType: 'order',
        entityId: orderId,
        metadata: { ...updates },
      })
    )
    return result
  } catch (error) {
    throw toActionError(error)
  }
}

export async function driverOnSiteAction(orderId: string, customerPhone?: string | null) {
  const session = await requireDriverSession()
  try {
    const result = await server.driverUpdateJob(session.tenantId, orderId, { status: 'On Site' })
    if (customerPhone) {
      const { sendSms } = await import('@/lib/sms')
      const companyName = await server.getCompanyName(session.tenantId)
      await sendSms(customerPhone, `${companyName}: your driver has arrived on site.`)
    }
    await writeAudit(
      auditFromSession(session, {
        type: 'driver.on_site',
        message: 'Driver on site',
        entityType: 'order',
        entityId: orderId,
      })
    )
    return result
  } catch (error) {
    throw toActionError(error)
  }
}

export async function sendOverstaySmsAction(skipId: string) {
  return withOfficeAction(
    { type: 'skip.overstay_sms', message: `Overstay SMS sent for skip ${skipId}`, entityType: 'inventory', entityId: skipId },
    (session) => server.sendOverstaySms(session.tenantId, skipId)
  )
}
