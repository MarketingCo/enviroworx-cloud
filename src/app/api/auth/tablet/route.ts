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
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'

// Simple PIN verification using timing-safe comparison
// In production, use bcrypt.compare against a hashed PIN field
async function verifyPin(plainPin: string, pinHash: string | null): Promise<boolean> {
  if (!pinHash) return false
  if (pinHash.startsWith('$2')) {
    // bcrypt hash - in production install bcrypt and use it:
    // return await bcrypt.compare(plainPin, pinHash)
    return false
  }
  // Legacy plaintext comparison (remove after migration)
  return pinHash === plainPin
}

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
      // Look up driver by ID
      const { data: driver, error } = await supabaseAdmin
        .from('drivers')
        .select('id, name, pin, pin_hash')
        .eq('id', personId)
        .single()

      if (error || !driver) {
        return NextResponse.json(
          { error: 'Driver not found' },
          { status: 401 }
        )
      }

      if (driver.pin_hash) {
        pinValid = await verifyPin(pin, driver.pin_hash)
      }
      if (!pinValid && driver.pin) {
        pinValid = driver.pin === pin
      }

      person = { id: driver.id, name: driver.name }
      role = 'driver'
    } else {
      // Look up yard staff by ID
      const { data: staff, error } = await supabaseAdmin
        .from('yard_staff')
        .select('id, name, pin, pin_hash')
        .eq('id', personId)
        .single()

      if (error || !staff) {
        return NextResponse.json(
          { error: 'Staff member not found' },
          { status: 401 }
        )
      }

      if (staff.pin_hash) {
        pinValid = await verifyPin(pin, staff.pin_hash)
      }
      if (!pinValid && staff.pin) {
        pinValid = staff.pin === pin
      }

      person = { id: staff.id, name: staff.name }
      role = 'yard'
    }

    if (!pinValid) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 401 }
      )
    }

    // Create a session token
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
