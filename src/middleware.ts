import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // Skip API routes and static files
  if (
    req.nextUrl.pathname.startsWith('/api') ||
    req.nextUrl.pathname.startsWith('/_next') ||
    req.nextUrl.pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Allow login pages
  if (req.nextUrl.pathname === '/office/login') {
    return NextResponse.next()
  }

  // Protect /office routes (but not /office/login)
  if (
    req.nextUrl.pathname.startsWith('/office') &&
    req.nextUrl.pathname !== '/office/login'
  ) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/office/login', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/office/:path*'],
}
