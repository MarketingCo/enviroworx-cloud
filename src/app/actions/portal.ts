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
