export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/auth'
import { supabaseAdmin, safeActivityLog } from '@/lib/supabase'
import { sendSms } from '@/lib/sms'

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // Find collections scheduled for tomorrow
    const { data: collections, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('date', tomorrowStr)
      .eq('job_type', 'Collection')
      .neq('status', 'Cancelled')
      .neq('status', 'Aborted')

    if (error) throw error

    let sent = 0
    for (const col of collections || []) {
      if (!col.phone) continue

      const message = `Hi ${col.customer_name}, this is Enviroworx. Just a reminder that we are scheduled to collect your skip tomorrow (${tomorrowStr}) at ${col.address}. Please ensure access is clear. Thanks!`
      
      const res = await sendSms(col.phone, message)
      if (res.success) sent++
    }

    // Log the activity
    await safeActivityLog({
      type: 'SYS',
      message: `Sent ${sent} collection reminders for ${tomorrowStr}`,
      status: 'Completed'
    })

    return NextResponse.json({ success: true, remindersSent: sent })
  } catch (error: any) {
    console.error('SMS Reminder Cron Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
