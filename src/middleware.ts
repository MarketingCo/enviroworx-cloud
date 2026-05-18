import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js middleware — protects route prefixes that should not be
 * accessible without an active session.
 *
 * Protected:
 *   /office/*   → requires Supabase session cookie (redirects to /office/login)
 *
 * Unprotected (own login systems):
 *   /portal     → customer portal (own login)
 *   /driver     → driver tablet app (own login)
 *   /tablet     → yard tablet app (own login)
 */
export async function middleware(req: NextRequest) {
  // Skip API routes and static files
  if (req.nextUrl.pathname.startsWith('/api') ||
      req.nextUrl.pathname.startsWith('/_next') ||
      req.nextUrl.pathname.includes('.')) {
    return NextResponse.next()
  }

  // Check for auth session on protected routes
  if (req.nextUrl.pathname.startsWith('/office')) {
    // Allow login page
    if (req.nextUrl.pathname === '/office/login') {
      return NextResponse.next()
    }

    // Check for session cookie
    const sessionCookie = req.cookies.get('sb-session') || req.cookies.get('supabase-auth-token')
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/office/login', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/office/:path*', '/portal', '/driver', '/tablet'],
}
