'use server'

import { requirePortalSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'

// Identity always comes from the portal session (customer id + name +
// tenant), never from client arguments — a portal user can only ever
// see and act on their own account.

export async function loadPortalCustomer(customerId: string) {
  const session = await requirePortalSession()
  if (session.sub !== customerId) throw new Error('Unauthorized')

  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, phone, email, billing_address, shipping_address, account_balance')
    .eq('tenant_id', session.tenantId)
    .eq('id', session.sub)
    .single()

  if (error || !customer) throw new Error('Customer not found')
  return customer
}

export async function loadPortalOrders(_customerName?: string) {
  const session = await requirePortalSession()

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, date, job_type, skip_size, address, status, skip_id_used, payment_method, paid, delivery_comments')
    .eq('tenant_id', session.tenantId)
    .ilike('customer_name', session.name)
    .order('date', { ascending: false })
    .limit(100)

  return orders ?? []
}

export async function loadPortalCashLogs(_customerName?: string) {
  const session = await requirePortalSession()

  const { data: cashLogs } = await supabaseAdmin
    .from('cash_log')
    .select('id, logged_at, ticket_number, waste_type, net_weight, cost_net, cost_gross, amount_paid, payment_method')
    .eq('tenant_id', session.tenantId)
    .ilike('customer_name', session.name)
    .order('logged_at', { ascending: false })
    .limit(100)

  return cashLogs ?? []
}

export async function updatePortalContact(
  customerId: string,
  updates: { phone: string; email: string; shipping_address: string }
) {
  const session = await requirePortalSession()
  if (session.sub !== customerId) throw new Error('Unauthorized')

  const { error } = await supabaseAdmin
    .from('customers')
    .update({
      phone: updates.phone,
      email: updates.email,
      shipping_address: updates.shipping_address,
    })
    .eq('tenant_id', session.tenantId)
    .eq('id', session.sub)

  if (error) throw error
  return { success: true }
}

export async function submitPortalBookingRequest(form: {
  customerId?: string
  customerName?: string
  phone: string
  jobType: string
  skipSize: string
  address: string
  date: string
  notes?: string
}) {
  const session = await requirePortalSession()
  const { error } = await supabaseAdmin.from('orders').insert({
    tenant_id: session.tenantId,
    date: form.date,
    status: 'Booked' as any,
    job_type: form.jobType as any,
    skip_size: form.skipSize,
    address: form.address,
    customer_id: session.sub,
    customer_name: session.name,
    phone: form.phone,
    payment_method: 'Invoice' as any,
    delivery_comments: form.notes || '[Portal Request]',
  } as any)
  if (error) throw error
  return { success: true }
}

// ── Active hires + collection requests (P3.5) ───────────────────────────

export async function loadPortalActiveHires() {
  const session = await requirePortalSession()
  const { data } = await supabaseAdmin
    .from('inventory')
    .select('id, skip_id, skip_size, delivery_address, delivery_date, status')
    .eq('tenant_id', session.tenantId)
    .ilike('customer_name', session.name)
    .in('status', ['In Use', 'Delivered'])
    .order('delivery_date', { ascending: true })
  return data ?? []
}

export async function requestCollectionAction(inventoryId: string) {
  const session = await requirePortalSession()

  // Re-read the hire server-side so the order is built from our data,
  // not client-supplied fields.
  const { data: hire } = await supabaseAdmin
    .from('inventory')
    .select('skip_id, skip_size, delivery_address')
    .eq('tenant_id', session.tenantId)
    .eq('id', inventoryId)
    .ilike('customer_name', session.name)
    .in('status', ['In Use', 'Delivered'])
    .maybeSingle()
  if (!hire) throw new Error('Hire not found')

  const { data: existing } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('tenant_id', session.tenantId)
    .eq('job_type', 'Collection')
    .in('status', ['Booked', 'Assigned'])
    .eq('skip_id_used', hire.skip_id)
    .limit(1)
  if (existing?.length) throw new Error('A collection for this skip is already booked')

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const date = tomorrow.toISOString().split('T')[0]

  const { data: cust } = await supabaseAdmin
    .from('customers')
    .select('phone')
    .eq('tenant_id', session.tenantId)
    .eq('id', session.sub)
    .maybeSingle()

  const { error } = await supabaseAdmin.from('orders').insert({
    tenant_id: session.tenantId,
    date,
    status: 'Booked' as any,
    job_type: 'Collection' as any,
    skip_size: hire.skip_size,
    skip_id_used: hire.skip_id,
    address: hire.delivery_address || '',
    customer_id: session.sub,
    customer_name: session.name,
    phone: cust?.phone || '',
    payment_method: 'Invoice' as any,
    delivery_comments: `[Portal Request] Collect skip ${hire.skip_id}`,
  } as any)
  if (error) throw error

  const { safeActivityLog } = await import('@/lib/supabase')
  await safeActivityLog({
    type: 'portal.collection_request',
    message: `${session.name} requested collection of skip ${hire.skip_id}`,
    status: 'Completed',
    entityType: 'order',
  })
  return { success: true, date }
}
