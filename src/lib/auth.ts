import type { NextRequest } from 'next/server'

const OFFICE_COOKIE = 'ew_office'

/** Vercel cron jobs send Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set. */
export function verifyCronAuth(request: Request | NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('CRON_SECRET is not set — cron routes are unprotected')
    }
    return process.env.NODE_ENV !== 'production'
  }
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export function verifyAdminApiAuth(request: Request | NextRequest): boolean {
  const secret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET
  if (!secret) {
    return hasOfficeSession(request)
  }
  const header = request.headers.get('x-api-key')
  if (header === secret) return true
  return hasOfficeSession(request)
}

export function hasOfficeSession(request: Request | NextRequest): boolean {
  const cookie = request.headers.get('cookie') ?? ''
  return cookie.split(';').some((part) => part.trim().startsWith(`${OFFICE_COOKIE}=1`))
}

export const officeCookieName = OFFICE_COOKIE
