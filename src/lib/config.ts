/**
 * Application Configuration
 * Loaded from Supabase config table, cached in memory
 */

export interface AppConfig {
  vatRate: number
  creditLimit: number
  maxDriveHours: number
  warnDriveHours: number
  demurrageDays: number
  demurrageNetFee: number
  permitAdminFee: number
  permitWeeklyFee: number
  officePhone: string
  pricesWaste: Record<string, number>
  pricesSkip: Record<string, number>
}

// Default config (matches your Google Sheets CONFIG object)
export const DEFAULT_CONFIG: AppConfig = {
  vatRate: 0.20,
  creditLimit: 500,
  maxDriveHours: 9,
  warnDriveHours: 8.5,
  demurrageDays: 28,
  demurrageNetFee: 30.00,
  permitAdminFee: 40,
  permitWeeklyFee: 45,
  officePhone: '01310000000',
  pricesWaste: {
    'Mix Con': 165, 'Mix Mun': 200, 'Wood': 80,
    'Inert': 40, 'Soil': 40, 'Cardboard': 0, 'Metal': 0
  },
  pricesSkip: {
    '4': 180, '6': 220, '8': 250, '10': 290, '12': 330,
    '14': 350, 'E14': 350, '16': 380, 'E16': 380,
    '20': 450, '25': 520, '40': 650, 'Cage': 180
  }
}

// Waste type to EWC code mapping (for WTN/DTN documents)
export const WASTE_CODES: Record<string, string> = {
  'Mix Con': '17 09 04',
  'Mix Mun': '20 03 01',
  'Wood': '17 02 01',
  'Cardboard': '20 01 01',
  'Inert': '17 01 07',
  'Soil': '17 05 04'
}

export const SKIP_SIZES = ['4', '6', '8', '10', '12', '14', '16', 'E14', 'E16', '20', '25', '40']
export const WB_SIZES = ['Cage', 'Van', 'Tipper', 'Trailer', ...SKIP_SIZES]
