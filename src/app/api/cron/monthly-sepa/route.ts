import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logToDrive } from '@/app/actions/drive'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customStart = searchParams.get('start')
    const customEnd = searchParams.get('end')

    const today = new Date()
    // Default to previous month if no params provided
    const start = customStart ? new Date(customStart).toISOString() : new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString()
    const end = customEnd ? new Date(customEnd).toISOString() : new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59).toISOString()

    // Use the v_unpaid_invoices view which aggregates Orders AND Cash Logs
    const { data: unpaidInvoices, error: vError } = await supabaseAdmin
      .from('v_unpaid_invoices')
      .select('*')
      .gte('date', start.split('T')[0])
      .lte('date', end.split('T')[0])

    if (!unpaidInvoices || unpaidInvoices.length === 0) {
      return NextResponse.json({ message: 'No unpaid invoices for previous month. SEPA Sheets not updated.' })
    }

    for (const inv of unpaidInvoices) {
      await logToDrive({
        date: inv.date || '',
        ticketNumber: inv.skip_id || 'N/A',
        customerName: inv.customer_name || 'Unknown',
        address: inv.address || 'N/A',
        amountPaid: 0, // Invoices in this view are unpaid
        costGross: inv.amount || 0,
        paymentMethod: 'Invoice',
        sheetName: 'SEPA'
      });
    }

    // @ts-ignore
    await supabaseAdmin.from('activity_log').insert({
      type: 'SYS',
      message: `Monthly SEPA Compliance Logged to Google Drive: ${unpaidInvoices.length} items.`,
      status: 'Completed'
    })

    return NextResponse.json({ success: true, count: unpaidInvoices.length })
  } catch (error: any) {
    console.error('SEPA Sheets Cron Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
