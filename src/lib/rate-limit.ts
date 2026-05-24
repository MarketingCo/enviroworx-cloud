import { NextResponse, type NextRequest } from 'next/server'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** In-memory rate limit (per server instance). Good enough for PIN brute-force mitigation. */
export function rateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }
  bucket.count += 1
  if (bucket.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
  }
  return { ok: true }
}

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export function rateLimitResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: 'Too many attempts. Try again shortly.' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSec) },
    }
  )
}
