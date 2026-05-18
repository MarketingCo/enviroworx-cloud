import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rateLimit, getClientIdentifier } from './rate-limit'

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Reset the internal store by calling the module-level cleanup indirectly
    // We advance time past any existing entries
    vi.setSystemTime(Date.now())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows first request', async () => {
    const result = await rateLimit('client-1', { maxRequests: 5, windowMs: 60000 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks after max requests exceeded', async () => {
    const opts = { maxRequests: 2, windowMs: 60000 }

    await rateLimit('client-2', opts)
    await rateLimit('client-2', opts)
    const result = await rateLimit('client-2', opts)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('allows requests again after window expires', async () => {
    const opts = { maxRequests: 1, windowMs: 1000 }

    await rateLimit('client-3', opts)
    // Use up the single request
    const blocked = await rateLimit('client-3', opts)
    expect(blocked.allowed).toBe(false)

    // Advance past the window
    vi.advanceTimersByTime(1001)

    const allowed = await rateLimit('client-3', opts)
    expect(allowed.allowed).toBe(true)
  })

  it('uses default options when none provided', async () => {
    const result = await rateLimit('client-default')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9) // Default maxRequests=10
  })

  it('tracks different clients independently', async () => {
    const opts = { maxRequests: 1, windowMs: 60000 }

    await rateLimit('client-a', opts)
    // client-b should still be allowed even though client-a hit limit
    const result = await rateLimit('client-b', opts)
    expect(result.allowed).toBe(true)
  })

  it('returns correct resetTime', async () => {
    const now = 1000000000000
    vi.setSystemTime(now)

    const opts = { maxRequests: 5, windowMs: 60000 }
    const result = await rateLimit('client-reset', opts)

    expect(result.resetTime).toBe(now + 60000)
  })
})

describe('getClientIdentifier', () => {
  it('extracts IP from X-Forwarded-For header', () => {
    const req = new Request('http://test', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
    })
    expect(getClientIdentifier(req)).toBe('192.168.1.1')
  })

  it('handles single IP in X-Forwarded-For', () => {
    const req = new Request('http://test', {
      headers: { 'x-forwarded-for': '192.168.1.1' },
    })
    expect(getClientIdentifier(req)).toBe('192.168.1.1')
  })

  it('returns "unknown" when no forwarded header', () => {
    const req = new Request('http://test')
    expect(getClientIdentifier(req)).toBe('unknown')
  })

  it('trims whitespace from forwarded IP', () => {
    const req = new Request('http://test', {
      headers: { 'x-forwarded-for': '  192.168.1.1  ' },
    })
    expect(getClientIdentifier(req)).toBe('192.168.1.1')
  })
})
