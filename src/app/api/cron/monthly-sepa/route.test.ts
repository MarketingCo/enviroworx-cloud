import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { verifyCronSecret } from '@/lib/auth'
import { supabaseAdmin, safeActivityLog } from '@/lib/supabase'

vi.mock('@/lib/auth', () => ({
  verifyCronSecret: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
    })),
  },
  safeActivityLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/app/actions/drive', () => ({
  logToDrive: vi.fn().mockResolvedValue(undefined),
}))

describe('GET /api/cron/monthly-sepa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createRequest(url: string) {
    return {
      url,
    } as any
  }

  it('returns 401 when cron secret is invalid', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(false)

    const req = createRequest('http://test/api/cron/monthly-sepa')
    const response = await GET(req)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns message when no unpaid invoices exist', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true)

    // Mock empty unpaid invoices
    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: [], error: null }),
    }))
    vi.mocked(supabaseAdmin.from).mockImplementation(fromMock)

    const req = createRequest('http://test/api/cron/monthly-sepa')
    const response = await GET(req)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.message).toContain('No unpaid invoices')
  })

  it('processes unpaid invoices with custom date range', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true)

    const mockInvoices = [
      { id: 'inv-1', date: '2026-04-01', skip_id: 'SKP-001', customer_name: 'Customer A', address: '123 St', amount: 250 },
      { id: 'inv-2', date: '2026-04-15', skip_id: 'SKP-002', customer_name: 'Customer B', address: '456 St', amount: 180 },
    ]

    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: mockInvoices, error: null }),
    }))
    vi.mocked(supabaseAdmin.from).mockImplementation(fromMock)

    const { logToDrive } = await import('@/app/actions/drive')

    const req = createRequest('http://test/api/cron/monthly-sepa?start=2026-04-01&end=2026-04-30')
    const response = await GET(req)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.count).toBe(2)
    expect(logToDrive).toHaveBeenCalledTimes(2)
    expect(safeActivityLog).toHaveBeenCalled()
  })

  it('handles database errors gracefully', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true)

    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: null, error: new Error('DB connection failed') }),
    }))
    vi.mocked(supabaseAdmin.from).mockImplementation(fromMock)

    const req = createRequest('http://test/api/cron/monthly-sepa')
    const response = await GET(req)

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it('logs activity on successful processing', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true)

    const mockInvoices = [
      { id: 'inv-1', date: '2026-04-01', skip_id: 'SKP-001', customer_name: 'Customer A', address: '123 St', amount: 250 },
    ]

    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: mockInvoices, error: null }),
    }))
    vi.mocked(supabaseAdmin.from).mockImplementation(fromMock)

    const req = createRequest('http://test/api/cron/monthly-sepa')
    await GET(req)

    expect(safeActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SYS',
        message: expect.stringContaining('SEPA'),
        status: 'Completed',
      })
    )
  })
})
