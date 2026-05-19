import type { NextRequest } from 'next/server'
import { getSessionFromRequest, verifySessionToken } from './session'

const LEGACY_OFFICE_COOKIE = 'ew_office'

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

export async function hasOfficeSession(request: Request | NextRequest): Promise<boolean> {
  const session = await getSessionFromRequest(request)
  if (session && ['office', 'driver', 'yard'].includes(session.role)) return true
  const cookie = request.headers.get('cookie') ?? ''
  return cookie.split(';').some((part) => part.trim().startsWith(`${LEGACY_OFFICE_COOKIE}=1`))
}

export function verifyAdminApiAuth(request: Request | NextRequest): boolean {
  const secret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('x-api-key') === secret
}

/** @deprecated use sessionCookieName from @/lib/session */
export const officeCookieName = LEGACY_OFFICE_COOKIE
