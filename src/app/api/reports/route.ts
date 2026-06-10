/**
 * Reports API Route (replaces generateSheetReport from Code.gs)
 * Returns CSV data instead of creating Google Sheets
 * GET /api/reports?type=SEPA&start=2024-01-01&end=2024-12-31
 */
export const dynamic = 'force-dynamic'

import { reportError } from '@/lib/monitor'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { DEFAULT_CONFIG } from '@/lib/config'
import { resolveOfficeSession } from '@/lib/session'
import { getCompanyName } from '@/lib/api-server'

// Programmatic callers authenticated by x-api-key (see middleware) have no
// session — they operate on the original tenant.
const DEFAULT_TENANT_ID = '56ec5b3f-6d42-4672-a98c-d60d9c22f284'

export async function GET(request: Request) {
  // Middleware has already authenticated (office Google session or x-api-key).
  const session = await resolveOfficeSession()
  const tenantId = session?.tenantId ?? DEFAULT_TENANT_ID
  const companyName = await getCompanyName(tenantId)

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!type || !start || !end) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const config = DEFAULT_CONFIG
  let headers: string[] = []
  let rows: any[][] = []

  switch (type) {
    case 'SEPA': {
      headers = ['Date', 'Ticket', 'Customer', 'Lorry Reg', 'Address', 'Waste Type', 'Direction', 'Net Weight (kg)']
      const { data: wlData } = await supabaseAdmin.from('weight_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('logged_at', start)
        .lte('logged_at', end + 'T23:59:59')
        .order('logged_at')
      const data = wlData as any[]

      rows = (data ?? []).map(r => [
        new Date(r.logged_at ?? Date.now()).toLocaleDateString('en-GB'),
        r.ticket_number,
        r.customer_name,
        r.lorry_reg,
        r.address,
        r.waste_type,
        r.direction === 'Off-site' ? 'OUTBOUND' : 'INBOUND',
        Math.abs(r.net_weight || 0),
      ])
      break
    }

    case 'FINANCE': {
      headers = ['Date', 'Ticket', 'Customer', 'Waste Type', 'Net Weight', 'Cost Net', 'Cost Gross', 'Amount Paid', 'Payment Method']
      const { data: finData } = await supabaseAdmin.from('cash_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('logged_at', start)
        .lte('logged_at', end + 'T23:59:59')
        .order('logged_at')

      rows = (finData ?? []).map(r => [
        new Date(r.logged_at ?? Date.now()).toLocaleDateString('en-GB'),
        r.ticket_number, r.customer_name, r.waste_type,
        r.net_weight, r.cost_net, r.cost_gross, r.amount_paid, r.payment_method,
      ])
      break
    }

    case 'DRIVER_MANIFEST': {
      headers = ['Driver', 'Date', 'Customer', 'Address', 'Job Type', 'Size', 'Skip ID']
      const { data } = await supabaseAdmin.from('orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('date', start)
        .lte('date', end)
        .eq('status', 'Completed')
        .order('driver_name')

      rows = (data ?? []).map(r => [
        r.driver_name || 'Unassigned',
        r.date, r.customer_name, r.address, r.job_type, r.skip_size, r.skip_id_used,
      ])
      break
    }

    case 'QUICKBOOKS': {
      headers = ['Customer', 'Invoice Date', 'Description', 'Item', 'Net Amount', 'VAT', 'Total Gross']
      const { data: orders } = await supabaseAdmin.from('orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('date', start).lte('date', end)
        .eq('status', 'Completed')
        .eq('payment_method', 'Invoice')
        .eq('paid', false)

      const { data: cashLogs } = await supabaseAdmin.from('cash_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('logged_at', start).lte('logged_at', end + 'T23:59:59')
        .eq('payment_method', 'Invoice')

      for (const o of orders ?? []) {
        const skipSize = o.skip_size?.replace(/\D/g, '') ?? ''
        const net = config.pricesSkip[skipSize] || 0
        const vat = net * config.vatRate
        rows.push([
          o.customer_name, o.date,
          `Skip ID: ${o.skip_id_used || 'N/A'} at ${o.address}`,
          `${o.skip_size}yd`, net.toFixed(2), vat.toFixed(2), (net + vat).toFixed(2),
        ])
      }

      for (const cl of (cashLogs ?? []).filter(c => !c.amount_paid || c.amount_paid < (c.cost_gross || 0))) {
        const net = cl.cost_net || 0
        const gross = cl.cost_gross || 0
        rows.push([
          cl.customer_name, new Date(cl.logged_at ?? Date.now()).toLocaleDateString('en-GB'),
          `Weighbridge Tip: ${cl.ticket_number} (${cl.waste_type})`,
          'Weighbridge Tip', net.toFixed(2), (gross - net).toFixed(2), gross.toFixed(2),
        ])
      }
      break
    }

    case 'ASSETS': {
      headers = ['Skip ID', 'Size', 'Status', 'Address', 'Customer', 'Days on Hire']
      const { data } = await supabaseAdmin.from('inventory')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['Delivered', 'In Use'])

      rows = (data ?? []).map(r => {
        const days = r.delivery_date ? Math.floor((Date.now() - new Date(r.delivery_date).getTime()) / 86400000) : 0
        return [r.skip_id, r.skip_size, r.status, r.delivery_address, r.customer_name, days]
      })
      break
    }
  }

  // Build CSV
  const csvLines = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
  ]
  const csv = csvLines.join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${companyName.replace(/[^\w-]/g, '_')}_${type}_${start}_${end}.csv"`,
    },
  })
}
