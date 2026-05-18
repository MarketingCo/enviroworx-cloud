import { describe, it, expect, vi } from 'vitest'
import { GET } from './route'
import { supabaseAdmin } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: 'test' }], error: null, count: 1 }),
    })),
  },
}))

describe('GET /api/health', () => {
  it('returns healthy status when database is connected', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('ok')
    expect(body.db).toBe('connected')
    expect(typeof body.latency_ms).toBe('number')
    expect(typeof body.uptime).toBe('number')
    expect(typeof body.timestamp).toBe('string')
    expect(typeof body.version).toBe('string')
  })

  it('includes cache-control headers', async () => {
    const response = await GET()
    const headers = response.headers as Headers
    expect(headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate')
  })

  it('returns error status when database connection fails', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() =>
      ({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: new Error('Connection refused') }),
      }) as any
    )

    const response = await GET()

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.status).toBe('error')
    expect(body.error).toContain('Connection refused')
    expect(typeof body.timestamp).toBe('string')
  })

  it('returns dev version when no git SHA is available', async () => {
    const response = await GET()
    const body = await response.json()
    expect(body.version).toBe('dev')
  })
})
