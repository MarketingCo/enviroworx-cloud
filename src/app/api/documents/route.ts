/**
 * Document Generation API Route (replaces doGenerateWTN / doGenerateDTN from Code.gs)
 * Generates WTN (Waste Transfer Note) and DTN (Duty of Care Transfer Note) as PDF
 *
 * GET /api/documents?type=WTN&ticketNumber=ENV-12345
 * GET /api/documents?type=DTN&orderId=abc-123
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { WASTE_CODES, DEFAULT_CONFIG } from '@/lib/config'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (type === 'WTN') return generateWTN(searchParams)
  if (type === 'DTN') return generateDTN(searchParams)
  return NextResponse.json({ error: 'Invalid type. Use WTN or DTN.' }, { status: 400 })
}

async function generateWTN(params: URLSearchParams) {
  const ticketNumber = params.get('ticketNumber')
  if (!ticketNumber) return NextResponse.json({ error: 'Missing ticketNumber' }, { status: 400 })

  // Fetch weight log + cash log for this ticket
  const { data: wl } = await supabaseAdmin.from('weight_logs')
    .select('*')
    .eq('ticket_number', ticketNumber)
    .single()

  if (!wl) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const { data: cl } = await supabaseAdmin.from('cash_log')
    .select('*')
    .eq('ticket_number', ticketNumber)
    .single()

  const ewcCode = WASTE_CODES[wl.waste_type] || '20 03 01'
  const net = Math.abs((wl.gross_weight || 0) - (wl.tare_weight || 0))
  const date = new Date(wl.logged_at || wl.created_at).toLocaleDateString('en-GB')

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #333; margin: 0; padding: 20px; }
  h1 { color: #059669; font-size: 20px; margin-bottom: 5px; }
  h2 { color: #333; font-size: 14px; margin: 15px 0 8px 0; border-bottom: 2px solid #059669; padding-bottom: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #059669; padding-bottom: 15px; margin-bottom: 15px; }
  .company { font-size: 10px; color: #666; }
  .ticket-num { font-size: 18px; font-weight: bold; color: #059669; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; }
  .field { background: #f8f8f8; padding: 8px 12px; border-radius: 4px; border-left: 3px solid #059669; }
  .field-label { font-size: 9px; color: #888; text-transform: uppercase; font-weight: bold; }
  .field-value { font-size: 12px; font-weight: bold; margin-top: 2px; }
  .weights { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .weight-box { text-align: center; padding: 12px; background: #f0fdf4; border: 1px solid #059669; border-radius: 6px; }
  .weight-box .value { font-size: 20px; font-weight: bold; color: #059669; }
  .weight-box .label { font-size: 9px; color: #666; text-transform: uppercase; }
  .footer { margin-top: 30px; font-size: 9px; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
  .sig-box { border: 1px solid #ddd; padding: 15px; border-radius: 6px; }
  .sig-line { border-bottom: 1px solid #333; margin-top: 30px; }
  .sig-label { font-size: 9px; color: #888; margin-top: 4px; }
</style></head><body>
  <div class="header">
    <div>
      <h1>WASTE TRANSFER NOTE</h1>
      <div class="company">
        Enviroworx Ltd | Waste Carrier Licence: CBDU______<br>
        Site: ______ | Tel: ${DEFAULT_CONFIG.officePhone}
      </div>
    </div>
    <div style="text-align:right">
      <div class="ticket-num">${ticketNumber}</div>
      <div style="font-size:10px;color:#666">Date: ${date}</div>
    </div>
  </div>

  <h2>Transfer Details</h2>
  <div class="grid">
    <div class="field"><div class="field-label">Customer / Transferor</div><div class="field-value">${wl.customer_name}</div></div>
    <div class="field"><div class="field-label">Carrier Vehicle</div><div class="field-value">${wl.lorry_reg}</div></div>
    <div class="field"><div class="field-label">Collection Address</div><div class="field-value">${wl.address || 'N/A'}</div></div>
    <div class="field"><div class="field-label">Direction</div><div class="field-value">${wl.direction || 'On-site'}</div></div>
    <div class="field"><div class="field-label">Waste Description</div><div class="field-value">${wl.waste_type}</div></div>
    <div class="field"><div class="field-label">EWC Code</div><div class="field-value">${ewcCode}</div></div>
    <div class="field"><div class="field-label">Skip Size</div><div class="field-value">${wl.skip_size || 'N/A'}</div></div>
    <div class="field"><div class="field-label">Skip ID</div><div class="field-value">${wl.skip_id || 'N/A'}</div></div>
  </div>

  <h2>Weight Record</h2>
  <div class="weights">
    <div class="weight-box"><div class="value">${(wl.gross_weight || 0).toLocaleString()}</div><div class="label">Gross (kg)</div></div>
    <div class="weight-box"><div class="value">${(wl.tare_weight || 0).toLocaleString()}</div><div class="label">Tare (kg)</div></div>
    <div class="weight-box"><div class="value">${net.toLocaleString()}</div><div class="label">Net Weight (kg)</div></div>
  </div>

  ${cl ? `
  <h2>Charges</h2>
  <div class="grid">
    <div class="field"><div class="field-label">Net Cost</div><div class="field-value">£${(cl.cost_net || 0).toFixed(2)}</div></div>
    <div class="field"><div class="field-label">Gross Cost (inc. VAT)</div><div class="field-value">£${(cl.cost_gross || 0).toFixed(2)}</div></div>
    <div class="field"><div class="field-label">Payment Method</div><div class="field-value">${cl.payment_method || 'N/A'}</div></div>
    <div class="field"><div class="field-label">Amount Paid</div><div class="field-value">£${(cl.amount_paid || 0).toFixed(2)}</div></div>
  </div>` : ''}

  <h2>Signatures</h2>
  <div class="sig-grid">
    <div class="sig-box">
      <strong>Transferor (Customer)</strong>
      <div class="sig-line"></div>
      <div class="sig-label">Signature & Date</div>
      <div class="sig-line" style="margin-top:20px"></div>
      <div class="sig-label">Print Name</div>
    </div>
    <div class="sig-box">
      <strong>Transferee (Enviroworx)</strong>
      <div class="sig-line"></div>
      <div class="sig-label">Signature & Date</div>
      <div class="sig-line" style="margin-top:20px"></div>
      <div class="sig-label">Print Name</div>
    </div>
  </div>

  ${wl.notes ? `<h2>Notes</h2><p>${wl.notes}</p>` : ''}

  <div class="footer">
    Enviroworx Ltd — Waste Transfer Note generated ${new Date().toISOString()}<br>
    This document satisfies the requirements of Section 34 of the Environmental Protection Act 1990 and the Environmental Protection (Duty of Care) Regulations 1991.
  </div>
</body></html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `inline; filename="WTN_${ticketNumber}.html"`,
    },
  })
}

async function generateDTN(params: URLSearchParams) {
  const orderId = params.get('orderId')
  if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })

  const { data: order } = await supabaseAdmin.from('orders')
    .select('*, customer:customers(name, phone, billing_address)')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const date = new Date(order.date).toLocaleDateString('en-GB')

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #333; margin: 0; padding: 20px; }
  h1 { color: #059669; font-size: 20px; margin-bottom: 5px; }
  h2 { color: #333; font-size: 14px; margin: 15px 0 8px 0; border-bottom: 2px solid #059669; padding-bottom: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #059669; padding-bottom: 15px; margin-bottom: 15px; }
  .company { font-size: 10px; color: #666; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; }
  .field { background: #f8f8f8; padding: 8px 12px; border-radius: 4px; border-left: 3px solid #059669; }
  .field-label { font-size: 9px; color: #888; text-transform: uppercase; font-weight: bold; }
  .field-value { font-size: 12px; font-weight: bold; margin-top: 2px; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
  .sig-box { border: 1px solid #ddd; padding: 15px; border-radius: 6px; }
  .sig-line { border-bottom: 1px solid #333; margin-top: 30px; }
  .sig-label { font-size: 9px; color: #888; margin-top: 4px; }
  .footer { margin-top: 30px; font-size: 9px; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
  .highlight { background: #f0fdf4; padding: 12px; border: 1px solid #059669; border-radius: 6px; text-align: center; }
  .highlight .value { font-size: 24px; font-weight: bold; color: #059669; }
  .highlight .label { font-size: 10px; color: #666; }
</style></head><body>
  <div class="header">
    <div>
      <h1>DRIVER TRANSFER NOTE</h1>
      <div class="company">
        Enviroworx Ltd | Waste Carrier Licence: CBDU______<br>
        Site: ______ | Tel: ${DEFAULT_CONFIG.officePhone}
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:14px;font-weight:bold;color:#059669">${order.job_type}</div>
      <div style="font-size:10px;color:#666">Date: ${date}</div>
    </div>
  </div>

  <h2>Job Details</h2>
  <div class="grid">
    <div class="field"><div class="field-label">Customer</div><div class="field-value">${order.customer_name}</div></div>
    <div class="field"><div class="field-label">Phone</div><div class="field-value">${order.phone || 'N/A'}</div></div>
    <div class="field"><div class="field-label">Address</div><div class="field-value">${order.address}</div></div>
    <div class="field"><div class="field-label">Job Type</div><div class="field-value">${order.job_type}</div></div>
    <div class="field"><div class="field-label">Skip Size</div><div class="field-value">${order.skip_size}yd</div></div>
    <div class="field"><div class="field-label">Skip ID Used</div><div class="field-value">${order.skip_id_used || 'TBC'}</div></div>
    <div class="field"><div class="field-label">Driver</div><div class="field-value">${order.driver_name || 'Unassigned'}</div></div>
    <div class="field"><div class="field-label">Status</div><div class="field-value">${order.status}</div></div>
  </div>

  ${order.delivery_comments ? `
  <h2>Delivery Notes</h2>
  <p style="background:#fffbeb;padding:10px;border-left:3px solid #f59e0b;border-radius:4px">${order.delivery_comments}</p>
  ` : ''}

  <h2>Customer Acknowledgement</h2>
  <p style="color:#666;font-size:10px;margin-bottom:15px">
    I acknowledge receipt of the skip described above at the address listed. I accept responsibility for ensuring the skip is used in accordance with Enviroworx terms and conditions.
    Overfilling, hazardous waste, or prohibited materials will incur additional charges.
  </p>

  <div class="sig-grid">
    <div class="sig-box">
      <strong>Customer / Site Contact</strong>
      <div class="sig-line"></div>
      <div class="sig-label">Signature & Date</div>
      <div class="sig-line" style="margin-top:20px"></div>
      <div class="sig-label">Print Name</div>
    </div>
    <div class="sig-box">
      <strong>Driver</strong>
      <div class="sig-line"></div>
      <div class="sig-label">Signature & Date</div>
      <div class="sig-line" style="margin-top:20px"></div>
      <div class="sig-label">Print Name</div>
    </div>
  </div>

  <div class="footer">
    Enviroworx Ltd — Driver Transfer Note generated ${new Date().toISOString()}<br>
    Skip hire subject to standard terms and conditions. Maximum hire period ${DEFAULT_CONFIG.demurrageDays} days before demurrage charges apply.
  </div>
</body></html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `inline; filename="DTN_${orderId}.html"`,
    },
  })
}
