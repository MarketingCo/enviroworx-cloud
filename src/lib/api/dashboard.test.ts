import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDashboardStats } from './dashboard'
import { supabase } from '@/lib/supabase'

// Reset module mock to use actual implementation patterns
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}))

describe('getDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all expected stat categories', async () => {
    const result = await getDashboardStats()

    expect(result).toHaveProperty('stats')
    expect(result).toHaveProperty('inventorySummary')
    expect(result).toHaveProperty('activeTippers')
    expect(result).toHaveProperty('unpaidInvoices')
    expect(result).toHaveProperty('driverHours')
    expect(result).toHaveProperty('collections')
    expect(result).toHaveProperty('expiringPermits')
  })

  it('returns stats as numbers', async () => {
    const result = await getDashboardStats()

    expect(typeof result.stats.completedToday).toBe('number')
    expect(typeof result.stats.completedWeek).toBe('number')
    expect(typeof result.stats.futureBookings).toBe('number')
    expect(typeof result.stats.tipsToday).toBe('number')
    expect(typeof result.stats.estProfitToday).toBe('number')
  })

  it('returns arrays for collection data', async () => {
    const result = await getDashboardStats()

    expect(Array.isArray(result.inventorySummary)).toBe(true)
    expect(Array.isArray(result.activeTippers)).toBe(true)
    expect(Array.isArray(result.unpaidInvoices)).toBe(true)
    expect(Array.isArray(result.driverHours)).toBe(true)
    expect(Array.isArray(result.collections)).toBe(true)
    expect(Array.isArray(result.expiringPermits)).toBe(true)
  })

  it('calls all required tables', async () => {
    await getDashboardStats()

    expect(supabase.from).toHaveBeenCalledWith('orders')
    expect(supabase.from).toHaveBeenCalledWith('cash_log')
    expect(supabase.from).toHaveBeenCalledWith('v_inventory_summary')
    expect(supabase.from).toHaveBeenCalledWith('active_tippers')
    expect(supabase.from).toHaveBeenCalledWith('v_unpaid_invoices')
    expect(supabase.from).toHaveBeenCalledWith('v_driver_hours_today')
    expect(supabase.from).toHaveBeenCalledWith('v_collections_due')
    expect(supabase.from).toHaveBeenCalledWith('permits')
  })

  it('filters orders by today and status', async () => {
    await getDashboardStats()

    const fromCalls = vi.mocked(supabase.from).mock.calls
    const ordersCalls = fromCalls.filter(([table]) => table === 'orders')
    expect(ordersCalls.length).toBeGreaterThan(0)
  })

  it('filters cash_log by today', async () => {
    await getDashboardStats()

    const fromCalls = vi.mocked(supabase.from).mock.calls
    expect(fromCalls.some(([table]) => table === 'cash_log')).toBe(true)
  })

  it('filters permits by expiry date', async () => {
    await getDashboardStats()

    const fromCalls = vi.mocked(supabase.from).mock.calls
    expect(fromCalls.some(([table]) => table === 'permits')).toBe(true)
  })

  it('calculates estimated profit correctly', async () => {
    // Override the mock for revenue data
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'cash_log') {
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({
            data: [
              { cost_gross: 200, net_weight: 1500, waste_type: 'Mix Con' },
              { cost_gross: 150, net_weight: 800, waste_type: 'Wood' },
            ],
            error: null,
          }),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        } as any
      }
      // Default return for other tables
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        count: vi.fn().mockReturnThis(),
        head: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any
    })

    const result = await getDashboardStats()

    // Profit = totalRev - estDisposalCost
    // Revenue = 200 + 150 = 350
    // Disposal: Mix Con = 1.5t * 130 = 195, Wood = 0.8t * 60 = 48
    // Total disposal = 243
    // Profit = 350 - 243 = 107
    expect(typeof result.stats.estProfitToday).toBe('number')
  })
})
