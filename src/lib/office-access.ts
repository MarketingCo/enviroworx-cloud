import type { User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { isOfficeGoogleEmailAllowed, officePinAuthEnabled } from '@/lib/office-google'

const OFFICE_ROLES = ['office', 'driver', 'yard'] as const

export async function canAccessOfficeRoutes(
  googleUser: User | null,
  request: NextRequest
): Promise<boolean> {
  if (googleUser?.email && isOfficeGoogleEmailAllowed(googleUser.email)) return true

  if (officePinAuthEnabled()) {
    const session = await getSessionFromRequest(request)
    if (session && OFFICE_ROLES.includes(session.role as (typeof OFFICE_ROLES)[number])) {
      return true
    }
  }

  return false
}
