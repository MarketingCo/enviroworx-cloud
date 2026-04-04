import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logToDrive } from '@/app/actions/drive'

export async function GET() {
  try {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString()
    const end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59).toISOString()

    const { data: cashLogs, error: cError } = await supabaseAdmin.from('cash_log')
      .select('*')
      .gte('logged_at', start)
      .lte('logged_at', end)
      .eq('payment_method', 'Invoice')

    if (cError) throw cError

    const unpaidCashLogs = (cashLogs || []).filter(c => (c.amount_paid || 0) < (c.cost_gross || 0))

    if (unpaidCashLogs.length === 0) {
      return NextResponse.json({ message: 'No unpaid invoices for previous month. SEPA Sheets not updated.' })
    }

    for (const cl of unpaidCashLogs) {
      await logToDrive({
        date: new Date(cl.logged_at || '').toLocaleDateString('en-GB'),
        ticketNumber: cl.ticket_number || 'N/A',
        customerName: cl.customer_name,
        address: cl.address || 'Yard',
        amountPaid: cl.amount_paid || 0,
        costGross: cl.cost_gross || 0,
        paymentMethod: 'Invoice',
        sheetName: 'SEPA'
      });
    }

    // @ts-ignore
    await supabaseAdmin.from('activity_log').insert({
      type: 'SYS',
      message: `Monthly SEPA Compliance Logged to Google Drive: ${unpaidCashLogs.length} items.`,
      status: 'Completed'
    })

    return NextResponse.json({ success: true, count: unpaidCashLogs.length })
  } catch (error: any) {
    console.error('SEPA Sheets Cron Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
