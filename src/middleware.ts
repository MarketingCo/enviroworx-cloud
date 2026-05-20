import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAdminApiAuth, verifyCronAuth } from '@/lib/auth'
import { verifySessionToken, sessionCookieName } from '@/lib/session'

const OFFICE_ROLES = ['office', 'driver', 'yard']

async function getOfficeSession(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value
  if (!token) return null
  try {
    return await verifySessionToken(token)
  } catch {
    return null
  }
}

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
    const session = await getOfficeSession(request)
    const allowed = session && OFFICE_ROLES.includes(session.role)
    if (!allowed && !verifyAdminApiAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  const isOfficeApp =
    pathname === '/office' || pathname.startsWith('/office/')

  if (isOfficeApp && !pathname.startsWith('/office/login')) {
    const session = await getOfficeSession(request)
    if (!session || !OFFICE_ROLES.includes(session.role)) {
      const login = new URL('/office/login', request.url)
      if (pathname !== '/office') {
        login.searchParams.set('next', pathname)
      }
      return NextResponse.redirect(login)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/office',
    '/office/:path*',
    '/api/cron/:path*',
    '/api/admin/:path*',
    '/api/reports',
    '/api/sms',
  ],
}
