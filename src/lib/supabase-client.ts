/**
 * Browser-side Supabase Client (SSR)
 *
 * For use in:
 * - Client Components
 * - Browser event handlers
 * - useEffect hooks
 *
 * Uses @supabase/ssr createBrowserClient which handles
 * auth session refresh and cookie storage automatically.
 *
 * Usage:
 * ```tsx
 * 'use client'
 * import { createBrowserSupabase } from '@/lib/supabase-client'
 * // In a Client Component:
 * const supabase = createBrowserSupabase()
 * const { data: { session } } = await supabase.auth.getSession()
 * ```
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createBrowserSupabase() {
  if (typeof window === 'undefined') {
    throw new Error(
      'createBrowserSupabase() must only be called in the browser. ' +
      'For server-side code, use createServerSupabase() from @/lib/supabase-server.'
    )
  }

  // Singleton pattern: reuse the same client instance across renders
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  return browserClient
}

/**
 * Hook-friendly wrapper for Client Components.
 * Returns the singleton browser Supabase client.
 *
 * Usage:
 * ```tsx
 * 'use client'
 * import { useSupabase } from '@/lib/supabase-client'
 * export default function MyComponent() {
 *   const supabase = useSupabase()
 *   // ...
 * }
 * ```
 */
export function useSupabase() {
  return createBrowserSupabase()
}
