import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { requireOfficeAuth } from '@/lib/auth'
import { supabaseAdmin, safeActivityLog } from '@/lib/supabase'

vi.mock('@/lib/auth', () => ({
  requireOfficeAuth: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  archiveOldOrders: vi.fn().mockResolvedValue({ archived: 5 }),
  getSkipUtilization: vi.fn().mockResolvedValue({ total: 10, in_use: 5 }),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
  safeActivityLog: vi.fn().mockResolvedValue(undefined),
}))

describe('POST /api/admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createRequest(action: string, extraBody: Record<string, unknown> = {}) {
    return {
      json: vi.fn().mockResolvedValue({ action, ...extraBody }),
    } as unknown as Request
  }

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireOfficeAuth).mockResolvedValue(null)

    const req = createRequest('health')
    const response = await POST(req as any)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toContain('Unauthorized')
  })

  it('logs admin action to activity log', async () => {
    vi.mocked(requireOfficeAuth).mockResolvedValue({
      id: 'admin-1',
      email: 'admin@test.com',
      role: 'office',
      name: 'Admin User',
    })

    const req = createRequest('health')
    await POST(req as any)

    expect(safeActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADMIN_ACTION',
        message: expect.stringContaining('health'),
        userId: 'admin-1',
        userRole: 'office',
      })
    )
  })

  it('handles health action', async () => {
    vi.mocked(requireOfficeAuth).mockResolvedValue({
      id: 'admin-1',
      role: 'office',
      name: 'Admin',
    })

    const req = createRequest('health')
    const response = await POST(req as any)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.timestamp).toBeDefined()
    expect(body.database).toBeDefined()
    expect(Array.isArray(body.checks)).toBe(true)
    expect(body.checks).toHaveLength(3)
  })

  it('handles archive action', async () => {
    vi.mocked(requireOfficeAuth).mockResolvedValue({
      id: 'admin-1',
      role: 'office',
      name: 'Admin',
    })

    const { archiveOldOrders } = await import('@/lib/api')

    const req = createRequest('archive', { olderThanDays: 30 })
    const response = await POST(req as any)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(archiveOldOrders).toHaveBeenCalledWith(30)
  })

  it('handles utilization action', async () => {
    vi.mocked(requireOfficeAuth).mockResolvedValue({
      id: 'admin-1',
      role: 'office',
      name: 'Admin',
    })

    const { getSkipUtilization } = await import('@/lib/api')

    const req = createRequest('utilization')
    const response = await POST(req as any)

    expect(response.status).toBe(200)
    expect(getSkipUtilization).toHaveBeenCalled()
  })

  it('handles demurrage action with no overdue skips', async () => {
    vi.mocked(requireOfficeAuth).mockResolvedValue({
      id: 'admin-1',
      role: 'office',
      name: 'Admin',
    })

    // Mock no overdue skips
    vi.mocked(supabaseAdmin.from).mockImplementation(() =>
      ({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }) as any
    )

    const req = createRequest('demurrage')
    const response = await POST(req as any)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.count).toBe(0)
  })

  it('returns 400 for unknown action', async () => {
    vi.mocked(requireOfficeAuth).mockResolvedValue({
      id: 'admin-1',
      role: 'office',
      name: 'Admin',
    })

    const req = createRequest('unknown_action')
    const response = await POST(req as any)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Unknown action')
  })
})
