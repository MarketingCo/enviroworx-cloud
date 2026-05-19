import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hasOfficeSession, officeCookieName, verifyCronAuth } from '@/lib/auth'

export function middleware(request: NextRequest) {
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
    if (!hasOfficeSession(request)) {
      const apiKey = request.headers.get('x-api-key')
      const secret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET
      if (!secret || apiKey !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/office') && !pathname.startsWith('/office/login')) {
    if (!hasOfficeSession(request)) {
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
