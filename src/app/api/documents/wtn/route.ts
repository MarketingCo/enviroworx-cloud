/**
 * Waste Transfer Note document generator
 * GET /api/documents/wtn?id=<wtn_id>
 * Returns printable A4 HTML for a stored WTN record.
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { DEFAULT_CONFIG } from '@/lib/config'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
  }

  const { data: wtn, error } = await supabaseAdmin
    .from('waste_transfer_notes')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !wtn) {
    return NextResponse.json({ error: 'WTN not found' }, { status: 404 })
  }

  const date = new Date(wtn.transfer_date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const qty =
    wtn.quantity_kg != null
      ? `${Number(wtn.quantity_kg).toLocaleString('en-GB')} kg`
      : wtn.quantity_description || 'N/A'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Waste Transfer Note ${wtn.wtn_number}</title>
  <style>
    /* ── Print / A4 setup ── */
    @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; }
    @media print {
      body { background: #fff !important; }
      .no-print { display: none !important; }
    }
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #222;
      background: #f5f5f5;
      padding: 20px;
    }
    .page {
      background: #fff;
      max-width: 760px;
      margin: 0 auto;
      padding: 24px 28px 32px;
      border: 1px solid #ccc;
      box-shadow: 0 2px 12px rgba(0,0,0,.10);
    }
    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #000;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .doc-title { font-size: 20px; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; }
    .doc-subtitle { font-size: 10px; color: #555; margin-top: 2px; }
    .wtn-badge { font-size: 22px; font-weight: 900; text-align: right; letter-spacing: .02em; }
    .wtn-date  { font-size: 10px; color: #555; text-align: right; margin-top: 2px; }
    /* ── Sections ── */
    .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .08em;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
      margin: 14px 0 8px;
    }
    /* ── Two-column grid ── */
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .field { background: #f9f9f9; border: 1px solid #ddd; border-radius: 3px; padding: 6px 10px; }
    .field-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #777; margin-bottom: 2px; }
    .field-value { font-size: 11.5px; font-weight: 600; min-height: 16px; }
    /* ── Weight boxes ── */
    .weight-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 4px; }
    .weight-box { border: 1.5px solid #000; border-radius: 4px; padding: 8px; text-align: center; }
    .weight-box .value { font-size: 18px; font-weight: 900; }
    .weight-box .label { font-size: 9px; text-transform: uppercase; color: #555; margin-top: 2px; }
    /* ── Legal note ── */
    .legal {
      border: 1px solid #bbb;
      border-radius: 3px;
      background: #f9f9f9;
      padding: 8px 10px;
      font-size: 9.5px;
      color: #444;
      margin-top: 14px;
      line-height: 1.5;
    }
    /* ── Signatures ── */
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 14px; }
    .sig-box { border: 1px solid #bbb; border-radius: 4px; padding: 14px; }
    .sig-party { font-size: 11px; font-weight: 700; margin-bottom: 10px; }
    .sig-line { border-bottom: 1px solid #222; margin: 18px 0 3px; }
    .sig-hint { font-size: 8.5px; color: #888; }
    /* ── Footer ── */
    .footer {
      margin-top: 18px;
      font-size: 8.5px;
      color: #888;
      border-top: 1px solid #ddd;
      padding-top: 8px;
      text-align: center;
      line-height: 1.6;
    }
    /* ── Print button (screen only) ── */
    .print-btn {
      display: block;
      margin: 16px auto 0;
      padding: 10px 32px;
      background: #000;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: .05em;
    }
    .print-btn:hover { background: #333; }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="doc-title">Waste Transfer Note</div>
      <div class="doc-subtitle">
        Enviroworx Ltd &nbsp;|&nbsp; Waste Carrier Licence: ${DEFAULT_CONFIG.officePhone ? 'CBDU______' : 'CBDU______'}<br>
        ${DEFAULT_CONFIG.officeAddress || 'Edinburgh, Scotland'} &nbsp;|&nbsp; Tel: ${DEFAULT_CONFIG.officePhone}
      </div>
    </div>
    <div>
      <div class="wtn-badge">${wtn.wtn_number}</div>
      <div class="wtn-date">Transfer Date: ${date}</div>
    </div>
  </div>

  <!-- Parties -->
  <div class="section-title">Parties to the Transfer</div>
  <div class="grid2">
    <div>
      <div class="field">
        <div class="field-label">Transferor (Waste Producer / Holder)</div>
        <div class="field-value">${wtn.transferor_name}</div>
      </div>
      <div class="field" style="margin-top:6px">
        <div class="field-label">Transferor Address</div>
        <div class="field-value">${wtn.transferor_address || '—'}</div>
      </div>
      <div class="field" style="margin-top:6px">
        <div class="field-label">Transferor Registration / Licence No.</div>
        <div class="field-value">${wtn.transferor_registration || '_______________'}</div>
      </div>
    </div>
    <div>
      <div class="field">
        <div class="field-label">Transferee (Waste Carrier / Broker)</div>
        <div class="field-value">${wtn.transferee_name}</div>
      </div>
      <div class="field" style="margin-top:6px">
        <div class="field-label">Transferee Address</div>
        <div class="field-value">${wtn.transferee_address || DEFAULT_CONFIG.officeAddress}</div>
      </div>
      <div class="field" style="margin-top:6px">
        <div class="field-label">Carrier Licence / Registration No.</div>
        <div class="field-value">${wtn.transferee_registration || 'CBDU______'}</div>
      </div>
    </div>
  </div>

  <!-- Waste Description -->
  <div class="section-title">Waste Details</div>
  <div class="grid2">
    <div class="field">
      <div class="field-label">Waste Description</div>
      <div class="field-value">${wtn.waste_description}</div>
    </div>
    <div class="field">
      <div class="field-label">EWC Code (European Waste Catalogue)</div>
      <div class="field-value">${wtn.ewc_code || '— (not specified)'}</div>
    </div>
    <div class="field">
      <div class="field-label">Quantity / Weight</div>
      <div class="field-value">${qty}</div>
    </div>
    <div class="field">
      <div class="field-label">Vehicle Registration</div>
      <div class="field-value">${wtn.vehicle_reg || '—'}</div>
    </div>
    <div class="field">
      <div class="field-label">SIC Code (Standard Industrial Classification)</div>
      <div class="field-value">38110 — Collection of non-hazardous waste</div>
    </div>
    <div class="field">
      <div class="field-label">Hazardous?</div>
      <div class="field-value">No</div>
    </div>
  </div>

  ${wtn.notes ? `
  <div class="section-title">Additional Notes</div>
  <div class="field"><div class="field-value">${wtn.notes}</div></div>
  ` : ''}

  <!-- Legal Notice -->
  <div class="legal">
    <strong>Duty of Care Declaration:</strong> This Waste Transfer Note is produced in accordance with Section 34 of the
    Environmental Protection Act 1990 and the Environmental Protection (Duty of Care) Regulations 1991 (as amended).
    Both parties confirm that the waste described herein has been properly contained and labelled, and that the transfer
    complies with all applicable environmental legislation. This document must be retained by both parties for a minimum
    of two (2) years and produced on request to the Environment Agency, SEPA, or Natural Resources Wales.
  </div>

  <!-- Signatures -->
  <div class="section-title">Signatures</div>
  <div class="sig-grid">
    <div class="sig-box">
      <div class="sig-party">Transferor (Customer / Waste Holder)</div>
      <p style="font-size:9px;color:#555">I certify that the information given above is correct to the best of my knowledge.</p>
      <div class="sig-line"></div>
      <div class="sig-hint">Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: ___________</div>
      <div class="sig-line" style="margin-top:20px"></div>
      <div class="sig-hint">Print Name &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Job Title: ___________</div>
    </div>
    <div class="sig-box">
      <div class="sig-party">Transferee (Enviroworx Representative)</div>
      <p style="font-size:9px;color:#555">I certify that the information given above is correct to the best of my knowledge.</p>
      <div class="sig-line"></div>
      <div class="sig-hint">Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: ___________</div>
      <div class="sig-line" style="margin-top:20px"></div>
      <div class="sig-hint">Print Name &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Job Title: ___________</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    Enviroworx Ltd &nbsp;|&nbsp; Registered in Scotland &nbsp;|&nbsp; VAT: ${DEFAULT_CONFIG.vatNumber}<br>
    ${wtn.wtn_number} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-GB')}<br>
    This document satisfies the Duty of Care requirements under the Environmental Protection Act 1990, Section 34.
  </div>

</div>

<button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>

<script>
  // Auto-open print dialog if opened in a new tab via the office
  if (window.opener) { window.print(); }
</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${wtn.wtn_number}.html"`,
    },
  })
}
