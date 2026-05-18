/**
 * Server-side Supabase Client (SSR)
 *
 * For use in:
 * - Server Components
 * - API Routes
 * - Server Actions
 *
 * Uses @supabase/ssr createServerClient which handles
 * auth session refresh and cookie management automatically.
 *
 * Usage:
 * ```ts
 * import { createServerSupabase } from '@/lib/supabase-server'
 * // In an async function:
 * const supabase = await createServerSupabase()
 * const { data, error } = await supabase.from('table').select()
 * ```
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export async function createServerSupabase() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          // Server Components cannot set cookies directly.
          // API Routes and Server Actions should use the cookieStore.set() API
          // via the response object if cookie modification is needed.
          try {
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[1])
          } catch {
            // Thrown in Server Components where cookies() is read-only.
            // Safe to ignore - the middleware handles session refresh.
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            cookieStore.set(name, '', { ...(options as Parameters<typeof cookieStore.set>[1]), maxAge: 0 })
          } catch {
            // Thrown in Server Components where cookies() is read-only.
            // Safe to ignore - the middleware handles session cleanup.
          }
        },
      },
    }
  )
}
