import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAdminApiAuth, verifyCronAuth } from '@/lib/auth'
import { createSupabaseMiddlewareClient } from '@/lib/supabase-middleware'
import { canAccessOfficeRoutes } from '@/lib/office-access'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/cron/')) {
    if (!verifyCronAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  const isOfficeApp =
    pathname === '/office' || pathname.startsWith('/office/')

  const isOfficeLogin = pathname.startsWith('/office/login')

  const needsOfficeGate =
    pathname.startsWith('/api/admin') ||
    pathname === '/api/reports' ||
    pathname === '/api/sms' ||
    (isOfficeApp && !isOfficeLogin)

  const needsSupabaseRefresh = needsOfficeGate || isOfficeLogin

  let response = NextResponse.next({ request })

  if (needsSupabaseRefresh) {
    const { supabase, response: supaResponse } = createSupabaseMiddlewareClient(request)
    response = supaResponse
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (pathname.startsWith('/api/admin') || pathname === '/api/reports' || pathname === '/api/sms') {
      const allowed = (await canAccessOfficeRoutes(user, request)) || verifyAdminApiAuth(request)
      if (!allowed) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    if (isOfficeApp && !isOfficeLogin) {
      const allowed = await canAccessOfficeRoutes(user, request)
      if (!allowed) {
        const login = new URL('/office/login', request.url)
        if (pathname !== '/office') {
          login.searchParams.set('next', pathname)
        }
        return NextResponse.redirect(login)
      }
    }
  }

  return response
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
