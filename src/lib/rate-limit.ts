/**
 * Simple in-memory rate limiter.
 * For production with multiple instances, use Redis or @vercel/kv.
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const store = new Map<string, RateLimitEntry>()

function cleanup() {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) {
      store.delete(key)
    }
  }
}

export async function rateLimit(
  identifier: string,
  options: { maxRequests: number; windowMs: number } = { maxRequests: 10, windowMs: 60000 }
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  cleanup()

  const now = Date.now()
  const key = identifier
  const entry = store.get(key)

  if (!entry || entry.resetTime < now) {
    // New window
    const resetTime = now + options.windowMs
    store.set(key, { count: 1, resetTime })
    return { allowed: true, remaining: options.maxRequests - 1, resetTime }
  }

  if (entry.count >= options.maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime }
  }

  entry.count++
  return { allowed: true, remaining: options.maxRequests - entry.count, resetTime: entry.resetTime }
}

export function getClientIdentifier(req: Request): string {
  // Use X-Forwarded-For header or fallback to a generic identifier
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  return ip
}
