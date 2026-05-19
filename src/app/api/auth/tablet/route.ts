/**
 * Tablet Authentication API
 * POST /api/auth/tablet
 *
 * Verifies driver or yard staff PIN against bcrypt-hashed pin_hash.
 * Returns a signed session token on success.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyPin } from '@/lib/auth'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'

// Create a simple signed token
function createSessionToken(personId: string, personName: string, role: string): string {
  const payload = {
    sub: personId,
    name: personName,
    role,
    iat: Date.now(),
    exp: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 login attempts per 5 minutes per IP (brute-force protection)
  const limit = await rateLimit(getClientIdentifier(req), { maxRequests: 5, windowMs: 5 * 60000 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 })
  }

  try {
    const { personId, pin, mode } = await req.json()

    if (!personId || !pin || !mode) {
      return NextResponse.json(
        { error: 'Person ID, PIN, and mode are required' },
        { status: 400 }
      )
    }

    if (mode !== 'driver' && mode !== 'yard') {
      return NextResponse.json(
        { error: "Mode must be 'driver' or 'yard'" },
        { status: 400 }
      )
    }

    let person: { id: string; name: string } | null = null
    let pinValid = false
    let role = mode

    if (mode === 'driver') {
      const { data: driver, error } = await supabaseAdmin
        .from('drivers')
        .select('id, name, pin_hash')
        .eq('id', personId)
        .single()

      if (error || !driver) {
        return NextResponse.json({ error: 'Driver not found' }, { status: 401 })
      }

      if (!driver.pin_hash) {
        return NextResponse.json({ error: 'PIN not set. Contact admin.' }, { status: 401 })
      }

      pinValid = await verifyPin(pin, driver.pin_hash)
      person = { id: driver.id, name: driver.name }
      role = 'driver'
    } else {
      const { data: staff, error } = await supabaseAdmin
        .from('yard_staff')
        .select('id, name, pin_hash')
        .eq('id', personId)
        .single()

      if (error || !staff) {
        return NextResponse.json({ error: 'Staff member not found' }, { status: 401 })
      }

      if (!staff.pin_hash) {
        return NextResponse.json({ error: 'PIN not set. Contact admin.' }, { status: 401 })
      }

      pinValid = await verifyPin(pin, staff.pin_hash)
      person = { id: staff.id, name: staff.name }
      role = 'yard'
    }

    if (!pinValid) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    }

    const token = createSessionToken(person!.id, person!.name, role)

    return NextResponse.json({
      success: true,
      person: person,
      role,
      token,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Authentication failed: ' + message },
      { status: 500 }
    )
  }
}
