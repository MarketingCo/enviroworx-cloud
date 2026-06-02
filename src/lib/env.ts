/**
 * Central env resolution — supports legacy Vercel names (API_KEY, PIN_SECRET).
 */

export function getSupabaseServiceRoleKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.API_KEY?.trim() ||
    undefined
  )
}

export function getSessionSecret(): string | undefined {
  return (
    process.env.SESSION_SECRET?.trim() ||
    process.env.PIN_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    undefined
  )
}

export function hasSupabasePublicConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  )
}
