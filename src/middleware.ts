import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hasOfficeSession, verifyAdminApiAuth, verifyCronAuth } from '@/lib/auth'
import { verifySessionToken, sessionCookieName } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/cron/')) {
    if (!verifyCronAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (
    pathname.startsWith('/api/admin') ||
    pathname === '/api/reports' ||
    pathname === '/api/sms'
  ) {
    if (!(await hasOfficeSession(request)) && !verifyAdminApiAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/office') && !pathname.startsWith('/office/login')) {
    const token = request.cookies.get(sessionCookieName)?.value
    const session = token ? await verifySessionToken(token) : null
    const allowed = session && ['office', 'driver', 'yard'].includes(session.role)
    if (!allowed && !(await hasOfficeSession(request))) {
      const login = new URL('/office/login', request.url)
      login.searchParams.set('next', pathname)
      return NextResponse.redirect(login)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/office/:path*',
    '/api/cron/:path*',
    '/api/admin/:path*',
    '/api/reports',
    '/api/sms',
  ],
}
