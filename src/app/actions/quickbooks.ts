'use server'

import { createDraftInvoice } from '@/lib/quickbooks'
import { supabaseAdmin } from '@/lib/supabase'
import { withOfficeAction } from '@/lib/office-action'

export async function syncOrderToQuickBooks(orderId: string) {
  try {
    return await withOfficeAction(
    {
      type: 'quickbooks.sync',
      message: `QuickBooks sync for order`,
      entityType: 'order',
      entityId: orderId,
    },
    async () => {
      const { data: order, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (fetchError || !order) throw new Error('Order not found')

      const { data: cashLog } = await supabaseAdmin
        .from('cash_log')
        .select('*')
        .eq('ticket_number', order.skip_id_used || '')
        .maybeSingle()

      const invoice = await createDraftInvoice({
        customer_name: order.customer_name ?? '',
        address: order.address ?? '',
        skip_size: order.skip_size ?? '',
        skip_id: order.skip_id_used || 'N/A',
        date: order.date ?? '',
        id: order.id,
        amount: cashLog?.cost_gross || 0,
      })

      const qbInvoice = invoice as { Id?: string }
      await supabaseAdmin
        .from('orders')
        .update({
          comments: `${order.comments || ''}\n[QB Sync: ${qbInvoice.Id}]`.trim(),
        })
        .eq('id', orderId)

      return { success: true, qbId: qbInvoice.Id }
    }
    )
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'QuickBooks sync failed',
    }
  }
}
