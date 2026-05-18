/**
 * BOOKINGS (replaces processBooking)
 */
import { supabase } from '../supabase'
import type { Database } from '../database.types'
import { getCustomerPrice } from './config'

type OrderRow = Database['public']['Tables']['orders']['Row']

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
    status: 'Booked',
    skip_size: form.skipSize,
    job_type: form.jobType as Database['public']['Enums']['job_type'],
    address: form.address,
    customer_id: customer?.id,
    customer_name: form.customerName.trim(),
    phone: form.phone,
    payment_method: form.paymentMethod as Database['public']['Enums']['payment_method'],
    delivery_comments: notes.trim(),
  })

  if (error) throw error
  return { success: true, message: '✅ Job Booked!' }
}

export async function updateBooking(orderId: string, newDate: string, newNotes: string) {
  await supabase.from('orders').update({
    date: newDate,
    delivery_comments: newNotes,
  }).eq('id', orderId)
  return { success: true, message: 'Updated!' }
}

export async function cancelBooking(orderId: string) {
  await supabase.from('orders').update({ status: 'Cancelled' }).eq('id', orderId)
  return { success: true, message: 'Cancelled.' }
}
