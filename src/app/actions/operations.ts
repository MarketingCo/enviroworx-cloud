'use server'

import { requireDriverSession, requireOfficeSession } from '@/lib/session'
import * as server from '@/lib/api-server'

export async function assignDriverToJobAction(
  orderId: string,
  driverName: string,
  driverId: string | null
) {
  await requireOfficeSession()
  return server.assignDriverToJob(orderId, driverName, driverId)
}

export async function autoAssignJobsAction(targetDate: string) {
  await requireOfficeSession()
  return server.autoAssignJobs(targetDate)
}

export async function processBookingAction(
  form: Parameters<typeof server.processBooking>[0]
) {
  await requireOfficeSession()
  return server.processBooking(form)
}

export async function logActiveTipperAction(
  form: Parameters<typeof server.logActiveTipper>[0]
) {
  await requireOfficeSession()
  return server.logActiveTipper(form)
}

export async function processWeightLogAction(
  form: Parameters<typeof server.processWeightLog>[0]
) {
  await requireOfficeSession()
  return server.processWeightLog(form)
}

export async function markJobPaidAction(id: string, source: 'Orders' | 'CashLog') {
  await requireOfficeSession()
  return server.markJobPaid(id, source)
}

export async function cancelBookingAction(orderId: string) {
  await requireOfficeSession()
  return server.cancelBooking(orderId)
}

export async function addCustomPriceAction(
  payload: Parameters<typeof server.addCustomPrice>[0]
) {
  await requireOfficeSession()
  return server.addCustomPrice(payload)
}

export async function deleteCustomPriceAction(id: string) {
  await requireOfficeSession()
  return server.deleteCustomPrice(id)
}

export async function updateDriverPinAction(id: string, pin: string) {
  await requireOfficeSession()
  return server.updateDriverPin(id, pin)
}

export async function updateConfigAction(key: string, value: unknown) {
  await requireOfficeSession()
  return server.updateConfig(key, value)
}

export async function completeJobAction(form: Parameters<typeof server.completeJob>[0]) {
  await requireDriverSession()
  return server.completeJob(form)
}

export async function driverAbortJobAction(orderId: string, reason: string) {
  await requireDriverSession()
  return server.driverAbortJob(orderId, reason)
}

export async function clockInOutAction(
  driverName: string,
  pin: string,
  action: 'IN' | 'OUT',
  lorryReg?: string
) {
  await requireDriverSession()
  return server.clockInOut(driverName, pin, action, lorryReg)
}

export async function driverLogFleetIssueAction(
  form: Parameters<typeof server.driverLogFleetIssue>[0]
) {
  await requireDriverSession()
  return server.driverLogFleetIssue(form)
}

export async function driverLogYardTipAction(
  form: Parameters<typeof server.driverLogYardTip>[0]
) {
  await requireDriverSession()
  return server.driverLogYardTip(form)
}

export async function driverToggleBreakAction(driverName: string, action: 'START' | 'END') {
  await requireDriverSession()
  return server.driverToggleBreak(driverName, action)
}

export async function driverUpdateJobAction(
  orderId: string,
  updates: Parameters<typeof server.driverUpdateJob>[1]
) {
  await requireDriverSession()
  return server.driverUpdateJob(orderId, updates)
}
