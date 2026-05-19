export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin, safeActivityLog } from '@/lib/supabase'
import { sendSms } from '@/lib/sms'
import { verifyCronSecret } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  if (!verifyCronSecret(req)) {
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
      .eq('date', tomorrowStr!)
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('SMS Reminder Cron Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
