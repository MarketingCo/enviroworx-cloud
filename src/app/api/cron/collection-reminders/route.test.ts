import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { verifyCronSecret } from '@/lib/auth'
import { supabaseAdmin, safeActivityLog } from '@/lib/supabase'
import { sendSms } from '@/lib/sms'

vi.mock('@/lib/auth', () => ({
  verifyCronSecret: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
    })),
  },
  safeActivityLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/sms', () => ({
  sendSms: vi.fn().mockResolvedValue({ success: true, sid: 'SM_test' }),
}))

describe('GET /api/cron/collection-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Freeze date to 2026-05-18 for consistent testing
    vi.setSystemTime(new Date('2026-05-18T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function createRequest(): any {
    return {
      url: 'http://test/api/cron/collection-reminders',
    }
  }

  it('returns 401 when cron secret is invalid', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(false)

    const response = await GET(createRequest())

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('sends SMS reminders for collections scheduled tomorrow', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true)

    const mockCollections = [
      {
        id: 'order-1',
        customer_name: 'Alice',
        address: '123 Test St',
        phone: '07123456789',
        date: '2026-05-19',
        job_type: 'Collection',
        status: 'Booked',
      },
      {
        id: 'order-2',
        customer_name: 'Bob',
        address: '456 Other St',
        phone: '07987654321',
        date: '2026-05-19',
        job_type: 'Collection',
        status: 'Assigned',
      },
    ]

    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      // This resolves the final promise for the orders query
      then: vi.fn().mockResolvedValue({ data: mockCollections, error: null }),
    }))
    vi.mocked(supabaseAdmin.from).mockImplementation(fromMock)

    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(sendSms).toHaveBeenCalledTimes(2)
  })

  it('skips collections without phone numbers', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true)

    const mockCollections = [
      {
        id: 'order-1',
        customer_name: 'Alice',
        address: '123 Test St',
        phone: null,
        date: '2026-05-19',
        job_type: 'Collection',
        status: 'Booked',
      },
      {
        id: 'order-2',
        customer_name: 'Bob',
        address: '456 Other St',
        phone: '07987654321',
        date: '2026-05-19',
        job_type: 'Collection',
        status: 'Assigned',
      },
    ]

    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: mockCollections, error: null }),
    }))
    vi.mocked(supabaseAdmin.from).mockImplementation(fromMock)

    const response = await GET(createRequest())
    const body = await response.json()
    expect(body.remindersSent).toBe(1)
    expect(sendSms).toHaveBeenCalledTimes(1)
  })

  it('returns 500 on database error', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true)

    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
    }))
    vi.mocked(supabaseAdmin.from).mockImplementation(fromMock)

    const response = await GET(createRequest())

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it('counts failed SMS sends', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true)

    // First SMS succeeds, second fails
    vi.mocked(sendSms)
      .mockResolvedValueOnce({ success: true, sid: 'SM_ok' })
      .mockResolvedValueOnce({ success: false, error: 'Invalid number' })

    const mockCollections = [
      {
        id: 'order-1',
        customer_name: 'Alice',
        address: '123 St',
        phone: '07123456789',
        date: '2026-05-19',
        job_type: 'Collection',
        status: 'Booked',
      },
      {
        id: 'order-2',
        customer_name: 'Bob',
        address: '456 St',
        phone: '07111111111',
        date: '2026-05-19',
        job_type: 'Collection',
        status: 'Booked',
      },
    ]

    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: mockCollections, error: null }),
    }))
    vi.mocked(supabaseAdmin.from).mockImplementation(fromMock)

    const response = await GET(createRequest())
    const body = await response.json()
    expect(body.remindersSent).toBe(1)
  })

  it('logs activity after sending reminders', async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(true)

    const mockCollections = [
      {
        id: 'order-1',
        customer_name: 'Alice',
        address: '123 Test St',
        phone: '07123456789',
        date: '2026-05-19',
        job_type: 'Collection',
        status: 'Booked',
      },
    ]

    const fromMock = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: mockCollections, error: null }),
    }))
    vi.mocked(supabaseAdmin.from).mockImplementation(fromMock)

    await GET(createRequest())

    expect(safeActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SYS',
        message: expect.stringContaining('collection reminders'),
        status: 'Completed',
      })
    )
  })
})
