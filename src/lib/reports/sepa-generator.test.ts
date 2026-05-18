import { describe, it, expect } from 'vitest'
import { generateSepaXml } from './sepa-generator'

describe('generateSepaXml', () => {
  it('generates valid SEPA XML with correct structure', () => {
    const invoices = [
      { id: 'inv-1', customer_name: 'Customer A', ticket_number: 'TKT-001', cost_gross: 250.00 },
      { id: 'inv-2', customer_name: 'Customer B', ticket_number: 'TKT-002', cost_gross: 180.00 },
    ]

    const xml = generateSepaXml(invoices, 'MSG-001')

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<MsgId>MSG-001</MsgId>')
    expect(xml).toContain('<NbOfTxs>2</NbOfTxs>')
    expect(xml).toContain('<InstdAmt Ccy="GBP">250.00</InstdAmt>')
    expect(xml).toContain('<InstdAmt Ccy="GBP">180.00</InstdAmt>')
    expect(xml).toContain('Customer A')
    expect(xml).toContain('Customer B')
    expect(xml).toContain('TKT-001')
    expect(xml).toContain('Enviroworx')
  })

  it('handles empty invoice list', () => {
    const xml = generateSepaXml([], 'MSG-EMPTY')
    expect(xml).toContain('<NbOfTxs>0</NbOfTxs>')
    expect(xml).toContain('<CtrlSum>0.00</CtrlSum>')
  })

  it('sums total amount correctly', () => {
    const invoices = [
      { id: 'inv-1', customer_name: 'A', ticket_number: 'TKT-1', cost_gross: 100.50 },
      { id: 'inv-2', customer_name: 'B', ticket_number: 'TKT-2', cost_gross: 200.75 },
      { id: 'inv-3', customer_name: 'C', ticket_number: 'TKT-3', cost_gross: 50.00 },
    ]

    const xml = generateSepaXml(invoices, 'MSG-003')
    expect(xml).toContain('<CtrlSum>351.25</CtrlSum>')
  })

  it('sanitizes customer names for mandate IDs', () => {
    const invoices = [
      { id: 'inv-1', customer_name: 'O\'Brien & Sons Ltd!', ticket_number: 'TKT-001', cost_gross: 100 },
    ]

    const xml = generateSepaXml(invoices, 'MSG-004')
    // Mandate ID should contain only alphanumeric characters
    expect(xml).toContain('<MndtId>')
    expect(xml).not.toMatch(/<MndtId>.*['!&].*<\/MndtId>/)
  })

  it('truncates long customer names to 70 characters', () => {
    const longName = 'A'.repeat(100)
    const invoices = [
      { id: 'inv-1', customer_name: longName, ticket_number: 'TKT-001', cost_gross: 100 },
    ]

    const xml = generateSepaXml(invoices, 'MSG-005')
    // The Dbtr/Nm element should contain at most 70 chars
    const nmMatch = xml.match(/<Nm>(.{71,})<\/Nm>/g)
    expect(nmMatch).toBeNull()
  })

  it('falls back to invoice ID when ticket number is missing', () => {
    const invoices = [
      { id: 'inv-abc', customer_name: 'Customer', cost_gross: 100 },
    ]

    const xml = generateSepaXml(invoices, 'MSG-006')
    expect(xml).toContain('Invoice inv-abc')
  })

  it('includes correct payment method and sequence type', () => {
    const invoices = [
      { id: 'inv-1', customer_name: 'Customer', ticket_number: 'TKT-1', cost_gross: 100 },
    ]

    const xml = generateSepaXml(invoices, 'MSG-007')
    expect(xml).toContain('<PmtMtd>DD</PmtMtd>')
    expect(xml).toContain('<Cd>SEPA</Cd>')
    expect(xml).toContain('<Cd>CORE</Cd>')
    expect(xml).toContain('<SeqTp>RCUR</SeqTp>')
  })
})
