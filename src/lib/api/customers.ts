/**
 * CUSTOMERS (replaces customer search + add + timeline)
 */
import { supabase } from '../supabase'
import { DEFAULT_CONFIG } from '../config'

export async function searchCustomers(query: string) {
  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, billing_address, account_balance, updated_at')
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

export async function getCustomerTimeline(customerName: string, customerId?: string) {
  const config = DEFAULT_CONFIG

  // Always use customer_id FK join (Phase 9 migration complete)
  const ordersQuery = supabase.from('orders').select('*')
    .eq('status', 'Completed')
    .eq('customer_id', customerId ?? '')
    .order('date', { ascending: false })
    .limit(50)
  const cashLogQuery = supabase.from('cash_log').select('*')
    .eq('customer_id', customerId ?? '')
    .order('logged_at', { ascending: false })
    .limit(50)

  const [{ data: orders }, { data: cashLogs }] = await Promise.all([
    ordersQuery,
    cashLogQuery,
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
