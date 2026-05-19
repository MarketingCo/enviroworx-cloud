import { DEFAULT_CONFIG } from './config'
import { supabaseAdmin } from './supabase'

type OrderRow = {
  id: string
  status: string | null
  paid: boolean | null
  payment_method: string | null
  skip_size: string | null
}

type CashLogRow = {
  id: string
  payment_method: string | null
  amount_paid: number | null
  cost_gross: number | null
}

/** Server-side outstanding balance (matches customer portal logic). */
export async function computeCustomerOutstanding(customerId: string, customerName: string) {
  const [{ data: orders }, { data: cashLogs }] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select('id, status, paid, payment_method, skip_size')
      .eq('customer_id', customerId),
    supabaseAdmin
      .from('cash_log')
      .select('id, payment_method, amount_paid, cost_gross')
      .ilike('customer_name', customerName),
  ])

  let owed = 0
  const unpaidOrderIds: string[] = []
  const unpaidCashLogIds: string[] = []

  for (const o of (orders ?? []) as OrderRow[]) {
    if (o.status === 'Completed' && !o.paid && o.payment_method === 'Invoice') {
      const size = o.skip_size?.replace(/\D/g, '') ?? ''
      owed += (DEFAULT_CONFIG.pricesSkip[size] || 0) * (1 + DEFAULT_CONFIG.vatRate)
      unpaidOrderIds.push(o.id)
    }
  }

  for (const cl of (cashLogs ?? []) as CashLogRow[]) {
    if (cl.payment_method === 'Invoice' && (cl.amount_paid || 0) < (cl.cost_gross || 0)) {
      owed += (cl.cost_gross || 0) - (cl.amount_paid || 0)
      unpaidCashLogIds.push(cl.id)
    }
  }

  return {
    owed: Math.round(owed * 100) / 100,
    unpaidOrderIds,
    unpaidCashLogIds,
  }
}
