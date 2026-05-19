/**
 * Driver Authentication API
 * POST /api/auth/driver
 *
 * Verifies driver PIN against bcrypt-hashed pin_hash stored in the drivers table.
 * Returns a signed session token on success.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyPin } from '@/lib/auth'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'

// Create a simple signed token (in production, use jose or jsonwebtoken)
function createSessionToken(driverId: string, driverName: string): string {
  const payload = {
    sub: driverId,
    name: driverName,
    role: 'driver',
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
    const { driverId, pin } = await req.json()

    if (!driverId || !pin) {
      return NextResponse.json(
        { error: 'Driver ID and PIN are required' },
        { status: 400 }
      )
    }

    // Look up driver by ID
    const { data: driver, error } = await supabaseAdmin
      .from('drivers')
      .select('id, name, pin_hash')
      .eq('id', driverId)
      .single()

    if (error || !driver) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 401 }
      )
    }

    // Require pin_hash — plaintext PIN is no longer accepted
    if (!driver.pin_hash) {
      return NextResponse.json(
        { error: 'PIN not set for this driver. Contact admin.' },
        { status: 401 }
      )
    }

    const valid = await verifyPin(pin, driver.pin_hash)

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 401 }
      )
    }

    // Create a session token
    const token = createSessionToken(driver.id, driver.name)

    return NextResponse.json({
      success: true,
      driver: { id: driver.id, name: driver.name },
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
