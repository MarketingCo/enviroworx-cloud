import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG, WASTE_CODES, SKIP_SIZES, WB_SIZES } from './config'

describe('DEFAULT_CONFIG', () => {
  it('has valid VAT rate', () => {
    expect(DEFAULT_CONFIG.vatRate).toBe(0.20)
    expect(DEFAULT_CONFIG.vatRate).toBeGreaterThan(0)
    expect(DEFAULT_CONFIG.vatRate).toBeLessThan(1)
  })

  it('has positive credit limit', () => {
    expect(DEFAULT_CONFIG.creditLimit).toBeGreaterThan(0)
  })

  it('has reasonable drive hour limits', () => {
    expect(DEFAULT_CONFIG.maxDriveHours).toBe(9)
    expect(DEFAULT_CONFIG.warnDriveHours).toBeLessThan(DEFAULT_CONFIG.maxDriveHours)
  })

  it('has positive demurrage settings', () => {
    expect(DEFAULT_CONFIG.demurrageDays).toBeGreaterThan(0)
    expect(DEFAULT_CONFIG.demurrageNetFee).toBeGreaterThan(0)
  })

  it('has skip prices for all standard sizes', () => {
    const sizes = ['4', '6', '8', '10', '12', '14', 'E14', '16', 'E16', '20', '25', '40', 'Cage']
    for (const size of sizes) {
      expect(DEFAULT_CONFIG.pricesSkip[size]).toBeDefined()
      expect(DEFAULT_CONFIG.pricesSkip[size]).toBeGreaterThan(0)
    }
  })

  it('has waste disposal costs that match waste types', () => {
    for (const wasteType of Object.keys(DEFAULT_CONFIG.pricesWaste)) {
      expect(DEFAULT_CONFIG.disposalCosts[wasteType]).toBeDefined()
    }
  })

  it('has positive permit fees', () => {
    expect(DEFAULT_CONFIG.permitAdminFee).toBeGreaterThan(0)
    expect(DEFAULT_CONFIG.permitWeeklyFee).toBeGreaterThan(0)
  })

  it('has office contact details', () => {
    expect(DEFAULT_CONFIG.officePhone).toBeTruthy()
    expect(DEFAULT_CONFIG.officeEmail).toBeTruthy()
    expect(DEFAULT_CONFIG.officeAddress).toBeTruthy()
  })

  it('has banking details', () => {
    expect(DEFAULT_CONFIG.bankName).toBeTruthy()
    expect(DEFAULT_CONFIG.sortCode).toBeTruthy()
    expect(DEFAULT_CONFIG.accountNumber).toBeTruthy()
  })
})

describe('WASTE_CODES', () => {
  it('has EWC codes for all major waste types', () => {
    expect(WASTE_CODES['Mix Con']).toBe('17 09 04')
    expect(WASTE_CODES['Mix Mun']).toBe('20 03 01')
    expect(WASTE_CODES['Wood']).toBe('17 02 01')
    expect(WASTE_CODES['Cardboard']).toBe('20 01 01')
    expect(WASTE_CODES['Inert']).toBe('17 01 07')
    expect(WASTE_CODES['Soil']).toBe('17 05 04')
  })
})

describe('SKIP_SIZES', () => {
  it('contains standard skip sizes', () => {
    expect(SKIP_SIZES).toContain('4')
    expect(SKIP_SIZES).toContain('8')
    expect(SKIP_SIZES).toContain('12')
    expect(SKIP_SIZES).toContain('40')
  })

  it('does not contain non-skip entries', () => {
    expect(SKIP_SIZES).not.toContain('Cage')
    expect(SKIP_SIZES).not.toContain('Van')
  })
})

describe('WB_SIZES', () => {
  it('contains all skip sizes', () => {
    for (const size of SKIP_SIZES) {
      expect(WB_SIZES).toContain(size)
    }
  })

  it('contains weighbridge-specific sizes', () => {
    expect(WB_SIZES).toContain('Cage')
    expect(WB_SIZES).toContain('Van')
    expect(WB_SIZES).toContain('Tipper')
    expect(WB_SIZES).toContain('Trailer')
  })
})
