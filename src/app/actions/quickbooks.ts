'use server'

import { createDraftInvoice } from '@/lib/quickbooks'
import { supabaseAdmin } from '@/lib/supabase'

export async function syncOrderToQuickBooks(orderId: string) {
  try {
    // 1. Fetch full order details
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchError || !order) throw new Error('Order not found')

    // 2. Fetch cash log to get the actual cost (where financial data is final)
    const { data: cashLog } = await supabaseAdmin
      .from('cash_log')
      .select('*')
      .eq('ticket_number', order.skip_id_used || '') // Using skip_id_used or other ref
      .single()

    // 3. Prepare data for QB
    const invoice = await createDraftInvoice({
      customer_name: order.customer_name,
      address: order.address,
      skip_size: order.skip_size,
      skip_id: order.skip_id_used || 'N/A',
      date: order.date,
      id: order.id,
      amount: cashLog?.cost_gross || 0 // Default to 0 if not logged yet
    })

    // 4. Update order with QB reference
    const qbInvoice = invoice as Record<string, unknown>
    await supabaseAdmin
      .from('orders')
      .update({ 
        comments: `${order.comments || ''}\n[QB Sync: ${qbInvoice.Id}]`.trim(),
        paid: false // Ensure it's marked as unpaid until QB syncs back
      })
      .eq('id', orderId)

    return { success: true, qbId: qbInvoice.Id }
  } catch (error: unknown) {
    console.error('QB Sync Action Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}
