'use server'

import { sendSms } from '@/lib/sms'
import { supabaseAdmin, safeActivityLog } from '@/lib/supabase'

export async function abortJobWithNotification(orderId: string, reason: string) {
  try {
    // 1. Update order status
    const { data: order, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'Aborted' as any,
        delivery_comments: reason,
      })
      .eq('id', orderId)
      .select('*')
      .single()

    if (updateError || !order) throw new Error('Failed to abort job')

    // 2. Send SMS if reason is 'No Access' related or just always send for transparency
    if (order.phone) {
      const message = `Hi ${order.customer_name}, Enviroworx was unable to complete your ${order.job_type} today at ${order.address}. Reason: ${reason}. Please contact the office to reschedule. Thanks!`
      await sendSms(order.phone, message)
    }

    // 3. Log to activity_log
    await safeActivityLog({
      type: 'SYS',
      message: `Job ${orderId} aborted by driver. SMS sent to customer.`,
      status: 'Completed'
    })

    return { success: true }
  } catch (error: any) {
    console.error('Abort Notification Error:', error)
    return { success: false, error: error.message }
  }
}
