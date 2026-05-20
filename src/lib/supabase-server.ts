import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function assertKeys() {
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
  }
}

/** Server Components, Server Actions, Route Handlers — uses auth cookies */
export function createSupabaseServerClient() {
  assertKeys()
  const cookieStore = cookies()
  return createServerClient<Database>(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a Server Component that cannot set cookies
        }
      },
    },
  })
}
