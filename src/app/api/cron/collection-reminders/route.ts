export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { reportError } from '@/lib/monitor'
import { verifyCronAuth } from '@/lib/auth'
import { supabaseAdmin, safeActivityLog } from '@/lib/supabase'
import { sendSms } from '@/lib/sms'
import { DEFAULT_CONFIG } from '@/lib/config'

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // The cron serves every tenant — each SMS is branded with the
    // owning tenant's company name.
    const { data: tenants } = await supabaseAdmin.from('tenants').select('id, company_name')
    const companyByTenant = new Map((tenants ?? []).map(t => [t.id, t.company_name]))
    const companyFor = (tenantId: string | null) =>
      (tenantId && companyByTenant.get(tenantId)) || DEFAULT_CONFIG.companyName || 'Enviroworx'

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // 1. Booked-collection reminders: SMS customers whose collection is tomorrow
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
      const message = `Hi ${col.customer_name}, this is ${companyFor(col.tenant_id)}. Just a reminder that we are scheduled to collect your skip tomorrow (${tomorrowStr}) at ${col.address}. Please ensure access is clear. Thanks!`
      const res = await sendSms(col.phone, message)
      if (res.success) sent++
    }

    // 2. Overstay reminders: SMS customers whose skip has been out > demurrageDays
    //    Only send once every 7 days (check comments field for last reminder date)
    const overstayCutoff = new Date()
    overstayCutoff.setDate(overstayCutoff.getDate() - (DEFAULT_CONFIG.demurrageDays || 28))
    const cutoffStr = overstayCutoff.toISOString()
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

    const { data: overstays } = await supabaseAdmin
      .from('inventory')
      .select('tenant_id, skip_id, skip_size, customer_name, customer_phone, delivery_address, delivery_date, comments')
      .in('status', ['Delivered', 'In Use'])
      .not('customer_phone', 'is', null)
      .lt('delivery_date', cutoffStr)

    let overstaySent = 0
    for (const skip of overstays || []) {
      if (!skip.customer_phone) continue
      // Skip if already reminded in last 7 days
      if (skip.comments?.includes('[OVERSTAY_SMS:') ) {
        const match = skip.comments.match(/\[OVERSTAY_SMS:(\d{4}-\d{2}-\d{2})/)
        if (match && match[1] > sevenDaysAgo.split('T')[0]) continue
      }
      const days = skip.delivery_date
        ? Math.round((Date.now() - new Date(skip.delivery_date).getTime()) / 86400000)
        : DEFAULT_CONFIG.demurrageDays
      const message =
        `Hi ${skip.customer_name ?? 'there'}, your ${skip.skip_size}yd skip at ${skip.delivery_address ?? 'your site'} has been in position for ${days} days. ` +
        `Please call ${DEFAULT_CONFIG.officePhone} to arrange collection or extend your hire. ${companyFor(skip.tenant_id)}.`
      const res = await sendSms(skip.customer_phone, message)
      if (res.success) {
        overstaySent++
        // Record reminder date in comments to prevent daily repeat
        const tag = `[OVERSTAY_SMS:${new Date().toISOString().split('T')[0]}]`
        const newComments = ((skip.comments || '') + ' ' + tag).trim()
        await supabaseAdmin
          .from('inventory')
          .update({ comments: newComments })
          .eq('tenant_id', skip.tenant_id!)
          .eq('skip_id', skip.skip_id)
      }
    }

    // 3. Permit expiry warnings: surface permits expiring in 7 or 2 days in Activity
    const warnDates = [7, 2].map((days) => {
      const d = new Date()
      d.setDate(d.getDate() + days)
      return { days, date: d.toISOString().split('T')[0] }
    })
    let permitWarnings = 0
    for (const { days, date } of warnDates) {
      const { data: expiring } = await supabaseAdmin
        .from('permits')
        .select('id, location, permit_number, expiry_date, skip_id')
        .eq('expiry_date', date)
        .neq('status', 'Expired')
      for (const permit of expiring ?? []) {
        await safeActivityLog({
          type: 'permit.expiring',
          message: `Permit ${permit.permit_number || ''} at ${permit.location} expires in ${days} days (${permit.expiry_date})`,
          status: 'Warning',
          entityType: 'permit',
          entityId: permit.id,
          metadata: { daysLeft: days, skipId: permit.skip_id },
        })
        permitWarnings++
      }
    }

    await safeActivityLog({
      type: 'SYS',
      message: `Sent ${sent} collection reminders + ${overstaySent} overstay reminders; ${permitWarnings} permit expiry warnings`,
      status: 'Completed'
    })

    return NextResponse.json({ success: true, remindersSent: sent, overstaySent, permitWarnings })
  } catch (error: any) {
    reportError('cron:collection-reminders', error)
    console.error('SMS Reminder Cron Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
