import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 4, resetTime: Date.now() + 300000 }),
  getClientIdentifier: vi.fn().mockReturnValue('127.0.0.1'),
}))

describe('POST /api/auth/driver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createRequest(body: Record<string, unknown>): any {
    return {
      json: vi.fn().mockResolvedValue(body),
    }
  }

  it('returns 400 when driverId is missing', async () => {
    const req = createRequest({ pin: '1234' })
    const response = await POST(req)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Driver ID and PIN are required')
  })

  it('returns 400 when PIN is missing', async () => {
    const req = createRequest({ driverId: 'DRV-001' })
    const response = await POST(req)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Driver ID and PIN are required')
  })

  it('returns 401 when driver is not found', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() =>
      ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('No rows found') }),
      }) as any
    )

    const req = createRequest({ driverId: 'NONEXISTENT', pin: '1234' })
    const response = await POST(req)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Driver not found')
  })

  it('returns 401 for incorrect legacy PIN', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() =>
      ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'DRV-001', name: 'John Doe', pin: '1234', pin_hash: null },
          error: null,
        }),
      }) as any
    )

    const req = createRequest({ driverId: 'DRV-001', pin: '9999' })
    const response = await POST(req)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Invalid PIN')
  })

  it('returns success for correct legacy PIN', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() =>
      ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'DRV-001', name: 'John Doe', pin: '1234', pin_hash: null },
          error: null,
        }),
      }) as any
    )

    const req = createRequest({ driverId: 'DRV-001', pin: '1234' })
    const response = await POST(req)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.driver.id).toBe('DRV-001')
    expect(body.driver.name).toBe('John Doe')
    expect(body.token).toBeDefined()
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ allowed: false, remaining: 0, resetTime: Date.now() + 300000 })

    const req = createRequest({ driverId: 'DRV-001', pin: '1234' })
    const response = await POST(req)

    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.error).toContain('Too many login attempts')
  })

  it('rejects bcrypt-style pin_hash (not supported)', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() =>
      ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'DRV-001', name: 'John Doe', pin: null, pin_hash: '$2b$10$hash' },
          error: null,
        }),
      }) as any
    )

    const req = createRequest({ driverId: 'DRV-001', pin: '1234' })
    const response = await POST(req)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Invalid PIN')
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      throw new Error('Database connection failed')
    })

    const req = createRequest({ driverId: 'DRV-001', pin: '1234' })
    const response = await POST(req)

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toContain('Authentication failed')
  })

  it('includes base64url session token on success', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() =>
      ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'DRV-001', name: 'John Doe', pin: '1234', pin_hash: null },
          error: null,
        }),
      }) as any
    )

    const req = createRequest({ driverId: 'DRV-001', pin: '1234' })
    const response = await POST(req)

    const body = await response.json()
    // Token should be a base64url string
    expect(body.token).toBeDefined()
    expect(() => Buffer.from(body.token, 'base64url').toString()).not.toThrow()

    const decoded = JSON.parse(Buffer.from(body.token, 'base64url').toString())
    expect(decoded.sub).toBe('DRV-001')
    expect(decoded.name).toBe('John Doe')
    expect(decoded.role).toBe('driver')
    expect(decoded.exp).toBeGreaterThan(decoded.iat)
  })

  it('verifies PIN against pin_hash before legacy pin', async () => {
    // This tests that pin_hash takes priority: if pin_hash exists but doesn't match,
    // we should NOT fall back to legacy pin (security behavior)
    // Currently the code falls back, which is a legacy behavior
    vi.mocked(supabaseAdmin.from).mockImplementation(() =>
      ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'DRV-001', name: 'John Doe', pin: '1234', pin_hash: '$2b$10$bcrypt_hash' },
          error: null,
        }),
      }) as any
    )

    const req = createRequest({ driverId: 'DRV-001', pin: '1234' })
    const response = await POST(req)

    // bcrypt is not supported yet, so it returns false even though pin matches
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Invalid PIN')
  })
})
