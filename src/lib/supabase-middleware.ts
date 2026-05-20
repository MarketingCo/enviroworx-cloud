import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './database.types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function assertKeys() {
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
  }
}

/**
 * Middleware: Supabase client that refreshes the session and attaches Set-Cookie to `response`.
 * Always return `response` from middleware after `getUser()`.
 */
export function createSupabaseMiddlewareClient(request: NextRequest) {
  assertKeys()
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(url!, anonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  return { supabase, response }
}
