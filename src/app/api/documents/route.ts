/**
 * Document Generation API Route (replaces doGenerateWTN / doGenerateDTN from Code.gs)
 * Generates WTN (Waste Transfer Note) and DTN (Duty of Care Transfer Note) as PDF
 *
 * GET /api/documents?type=WTN&ticketNumber=ENV-12345
 * GET /api/documents?type=DTN&orderId=abc-123
 * GET /api/documents?type=INVOICE&orderId=abc-123
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { WASTE_CODES, DEFAULT_CONFIG } from '@/lib/config'
import { isAuthorized, unauthorized } from '@/lib/api-auth'

export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorized()

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (type === 'WTN') return generateWTN(searchParams)
  if (type === 'DTN') return generateDTN(searchParams)
  if (type === 'INVOICE') return generateInvoice(searchParams)
  return NextResponse.json({ error: 'Invalid type. Use WTN, DTN, or INVOICE.' }, { status: 400 })
}

async function generateWTN(params: URLSearchParams) {
  const ticketNumber = params.get('ticketNumber')
  if (!ticketNumber) return NextResponse.json({ error: 'Missing ticketNumber' }, { status: 400 })

  // Fetch weight log + cash log for this ticket
  const { data: wlRaw } = await supabaseAdmin.from('weight_logs')
    .select('*')
    .eq('ticket_number', ticketNumber)
    .single()

  if (!wlRaw) return NextResponse.json({ error: 'Weight log not found' }, { status: 404 })

  // Build WTN data
  const wtn = {
    ticketNumber: wlRaw.ticket_number,
    date: wlRaw.logged_at?.split('T')[0],
    producer: wlRaw.customer_name || 'Unknown',
    producerAddress: wlRaw.address || 'N/A',
    carrier: 'Enviroworx Ltd',
    carrierAddress: DEFAULT_CONFIG.officeAddress,
    wasteDescription: wlRaw.waste_type || 'Mixed Construction',
    ewcCode: WASTE_CODES[wlRaw.waste_type || ''] || '17 09 04',
    container: wlRaw.skip_size ? `${wlRaw.skip_size} yard skip` : 'Skip',
    grossWeight: wlRaw.gross_weight || 0,
    tareWeight: 0,
    netWeight: wlRaw.net_weight || 0,
    registrationNumber: wlRaw.lorry_reg || 'TBC',
    vatNumber: DEFAULT_CONFIG.vatNumber,
  }

  // Return as JSON for frontend PDF rendering
  return NextResponse.json(wtn)
}

async function generateDTN(params: URLSearchParams) {
  const orderId = params.get('orderId')
  if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })

  const { data: order } = await supabaseAdmin.from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const dtn = {
    transferDate: order.date || new Date().toISOString().split('T')[0],
    wasteProducer: order.customer_name,
    producerAddress: order.address,
    wasteDescription: (order as any).waste_type || 'Mixed Construction',
    ewcCode: WASTE_CODES[(order as any).waste_type || ''] || '17 09 04',
    container: order.skip_size ? `${order.skip_size} yard skip` : 'Skip',
    carrier: 'Enviroworx Ltd',
    carrierAddress: DEFAULT_CONFIG.officeAddress,
    registrationNumber: (order as any).lorry_reg || 'TBC',
    consignee: 'Transfer Station',
    specialHandling: '',
   HazWaste: false,
  }

  return NextResponse.json(dtn)
}

async function generateInvoice(params: URLSearchParams) {
  const orderId = params.get('orderId')
  if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })

  const { data: order } = await supabaseAdmin.from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const vatRate = DEFAULT_CONFIG.vatRate
  const netAmount = (order as any).cost_net || 0
  const vatAmount = netAmount * vatRate
  const grossAmount = netAmount + vatAmount

  const invoice = {
    invoiceNumber: (order as any).invoice_number || `INV-${orderId.slice(0, 8).toUpperCase()}`,
    date: order.date || new Date().toISOString().split('T')[0],
    customerName: order.customer_name,
    customerAddress: order.address,
    description: `${order.job_type || 'Delivery'} - ${order.skip_size || ''} yard skip${(order as any).waste_type ? ` (${(order as any).waste_type})` : ''}`,
    netAmount,
    vatRate,
    vatAmount,
    grossAmount,
    paymentMethod: order.payment_method || 'Invoice',
    paid: order.paid || false,
    vatNumber: DEFAULT_CONFIG.vatNumber,
    companyAddress: DEFAULT_CONFIG.officeAddress,
    bankName: DEFAULT_CONFIG.bankName,
    sortCode: DEFAULT_CONFIG.sortCode,
    accountNumber: DEFAULT_CONFIG.accountNumber,
  }

  return NextResponse.json(invoice)
}
