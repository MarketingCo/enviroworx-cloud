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
    () => server.assignDriverToJob(orderId, driverName, driverId)
  )
}

export async function autoAssignJobsAction(targetDate: string) {
  return withOfficeAction(
    {
      type: 'dispatch.auto_assign',
      message: `Auto-assign jobs for ${targetDate}`,
      metadata: { targetDate },
    },
    () => server.autoAssignJobs(targetDate)
  )
}

export async function processBookingAction(
  form: Parameters<typeof server.processBooking>[0]
) {
  return withOfficeAction(
    {
      type: 'booking.create',
      message: `Booking: ${form.customerName} — ${form.jobType}`,
      entityType: 'customer',
      metadata: { jobType: form.jobType, address: form.address },
    },
    () => server.processBooking(form)
  )
}

export async function logActiveTipperAction(
  form: Parameters<typeof server.logActiveTipper>[0]
) {
  return withOfficeAction(
    { type: 'weighbridge.tipper', message: `Tipper log: ${form.customerName}` },
    () => server.logActiveTipper(form)
  )
}

export async function processWeightLogAction(
  form: Parameters<typeof server.processWeightLog>[0]
) {
  return withOfficeAction(
    {
      type: 'weighbridge.weight',
      message: `Weighbridge: ${form.customerName}`,
      metadata: { grossWeight: form.grossWeight, customerName: form.customerName },
    },
    () => server.processWeightLog(form)
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
    () => server.markJobPaid(id, source)
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
    () => server.cancelBooking(orderId)
  )
}

export async function addCustomPriceAction(
  payload: Parameters<typeof server.addCustomPrice>[0]
) {
  return withOfficeAction(
    {
      type: 'settings.custom_price_add',
      message: `Custom price: ${payload.customer_name}`,
    },
    () => server.addCustomPrice(payload)
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
    () => server.deleteCustomPrice(id)
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
    () => server.updateDriverPin(id, pin)
  )
}

export async function updateConfigAction(key: string, value: unknown) {
  return withOfficeAction(
    {
      type: 'settings.config',
      message: `Config updated: ${key}`,
      metadata: { key },
    },
    () => server.updateConfig(key, value)
  )
}

export async function completeJobAction(form: Parameters<typeof server.completeJob>[0]) {
  const session = await requireDriverSession()
  try {
    const result = await server.completeJob(form)
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
    const result = await server.driverAbortJob(orderId, reason)
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
    const result = await server.clockInOut(driverName, pin, action, lorryReg)
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
  form: Parameters<typeof server.driverLogFleetIssue>[0]
) {
  const session = await requireDriverSession()
  try {
    const result = await server.driverLogFleetIssue(form)
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
  form: Parameters<typeof server.driverLogYardTip>[0]
) {
  const session = await requireDriverSession()
  try {
    const result = await server.driverLogYardTip(form)
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
    const result = await server.driverToggleBreak(driverName, action)
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
  updates: Parameters<typeof server.driverUpdateJob>[1]
) {
  const session = await requireDriverSession()
  try {
    const result = await server.driverUpdateJob(orderId, updates)
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
    const result = await server.driverUpdateJob(orderId, { status: 'On Site' })
    if (customerPhone) {
      const { sendSms } = await import('@/lib/sms')
      await sendSms(customerPhone, 'Enviroworx: your driver has arrived on site.')
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
