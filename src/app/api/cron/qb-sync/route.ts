export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createDraftInvoice } from '@/lib/quickbooks'
import { verifyCronSecret } from '@/lib/auth'

export async function GET(req: NextRequest) {
  // Verify cron secret
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get yesterday's completed Invoice-method orders
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]

    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('status', 'Completed')
      .eq('payment_method', 'Invoice')
      .eq('date', dateStr)

    if (!orders || orders.length === 0) {
      return NextResponse.json({ message: 'No orders to sync', synced: 0 })
    }

    const results = []
    for (const order of orders) {
      try {
        const invoice = await createDraftInvoice({
          customer_name: order.customer_name,
          address: order.address,
          skip_size: order.skip_size,
          skip_id: order.skip_id_used || undefined,
          date: order.date,
          id: order.id,
          amount: 0, // Calculate from pricing -- implement as needed
          job_type: order.job_type,
        })
        results.push({ orderId: order.id, status: 'success', invoice })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        results.push({ orderId: order.id, status: 'error', error: message })
      }
    }

    return NextResponse.json({
      message: `Synced ${orders.length} orders`,
      synced: orders.length,
      results,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
