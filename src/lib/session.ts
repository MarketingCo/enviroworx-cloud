import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isOfficeGoogleEmailAllowed, officePinAuthEnabled } from '@/lib/office-google'
import { lookupOfficeStaff, type OfficeStaffRole } from '@/lib/office-staff'

export type SessionRole = 'office' | 'driver' | 'yard' | 'portal'

export type AppSession = {
  sub: string
  name: string
  role: SessionRole
  email?: string
  officeRole?: OfficeStaffRole
}

const COOKIE_NAME = 'ew_session'

function getSecret() {
  const raw =
    process.env.SESSION_SECRET ||
    process.env.CRON_SECRET ||
    (process.env.NODE_ENV === 'development' ? 'dev-only-change-in-production' : '')
  if (!raw) {
    throw new Error('SESSION_SECRET or CRON_SECRET must be set in production')
  }
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'development') {
    console.warn('Using dev SESSION_SECRET — set SESSION_SECRET in .env.local')
  }
  return new TextEncoder().encode(raw)
}

export async function createSessionToken(payload: AppSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret())
}

export async function verifySessionToken(token: string): Promise<AppSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (!payload.sub || !payload.name || !payload.role) return null
    return {
      sub: String(payload.sub),
      name: String(payload.name),
      role: payload.role as SessionRole,
    }
  } catch {
    return null
  }
}

export function sessionCookieOptions(maxAge = 86400) {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

export async function setSessionCookie(payload: AppSession) {
  const token = await createSessionToken(payload)
  cookies().set(sessionCookieOptions().name, token, sessionCookieOptions())
}

export async function clearSessionCookie() {
  cookies().delete(COOKIE_NAME)
}

export async function getSessionFromCookies(): Promise<AppSession | null> {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export async function getSessionFromRequest(request: Request | NextRequest): Promise<AppSession | null> {
  const cookie = request.headers.get('cookie') ?? ''
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  if (!match?.[1]) return null
  return verifySessionToken(decodeURIComponent(match[1]))
}

const OFFICE_ROLES: SessionRole[] = ['office', 'driver', 'yard']

/** Google (allowlisted) or optional PIN session when OFFICE_PIN_AUTH_ENABLED=true */
export async function resolveOfficeSession(): Promise<AppSession | null> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.email) {
    const staff = await lookupOfficeStaff(user.email)
    if (staff) {
      const meta = user.user_metadata as { full_name?: string } | undefined
      const name =
        staff.display_name?.trim() ||
        (typeof meta?.full_name === 'string' && meta.full_name.trim()) ||
        user.email.split('@')[0] ||
        'Staff'
      return {
        sub: user.id,
        name,
        role: 'office',
        email: staff.email,
        officeRole: staff.role,
      }
    }
  }

  if (officePinAuthEnabled()) {
    const session = await getSessionFromCookies()
    if (session && OFFICE_ROLES.includes(session.role)) {
      return session
    }
  }

  return null
}

export async function requireOfficeSession(): Promise<AppSession> {
  const session = await resolveOfficeSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

export async function requireDriverSession(): Promise<AppSession> {
  const session = await getSessionFromCookies()
  if (!session || (session.role !== 'driver' && session.role !== 'yard')) {
    throw new Error('Unauthorized')
  }
  return session
}

export async function requirePortalSession(): Promise<AppSession> {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'portal') {
    throw new Error('Unauthorized')
  }
  return session
}

export { COOKIE_NAME as sessionCookieName }
