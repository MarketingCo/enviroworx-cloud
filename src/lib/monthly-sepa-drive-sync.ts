import { supabaseAdmin, safeActivityLog } from '@/lib/supabase'
import { logToDrive } from '@/app/actions/drive'

/**
 * Push unpaid invoices in the date range to the SEPA Google Sheet (via Drive API).
 * Used by Vercel cron (Bearer CRON_SECRET) and by the office Reports tab (server action).
 */
export async function runMonthlySepaDriveSync(startDate: string, endDate: string): Promise<{
  success: boolean
  count?: number
  message?: string
}> {
  const start = new Date(startDate).toISOString()
  const end = new Date(endDate).toISOString()

  const { data: unpaidInvoices, error: vError } = await supabaseAdmin
    .from('v_unpaid_invoices')
    .select('*')
    .gte('date', start.split('T')[0])
    .lte('date', end.split('T')[0])

  if (vError) {
    console.error('runMonthlySepaDriveSync:', vError)
    return { success: false, message: vError.message }
  }

  if (!unpaidInvoices || unpaidInvoices.length === 0) {
    return {
      success: false,
      message: 'No unpaid invoices for this period. SEPA sheet not updated.',
    }
  }

  for (const inv of unpaidInvoices) {
    await logToDrive({
      date: inv.date || '',
      ticketNumber: inv.skip_id || 'N/A',
      customerName: inv.customer_name || 'Unknown',
      address: inv.address || 'N/A',
      amountPaid: 0,
      costGross: inv.amount || 0,
      paymentMethod: 'Invoice',
      sheetName: 'SEPA',
    })
  }

  await safeActivityLog({
    type: 'SYS',
    message: `Monthly SEPA Compliance Logged to Google Drive: ${unpaidInvoices.length} items.`,
    status: 'Completed',
  })

  return { success: true, count: unpaidInvoices.length }
}
