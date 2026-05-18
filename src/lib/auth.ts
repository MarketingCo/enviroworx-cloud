/**
 * Auth utilities for server-side identity verification
 *
 * Provides typed auth guards for the three Enviroworx user types:
 *   - Office / Yard Staff   (requireOfficeAuth)
 *   - Drivers               (requireDriverAuth)
 *   - Portal Customers      (requireCustomerAuth)
 *
 * Also includes:
 *   - Cron request verification   (verifyCronSecret)
 *   - PIN hashing / comparison    (hashPin, verifyPin)
 *
 * All functions are designed to run server-side only.
 * Do NOT import this file into Client Components.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { createServerSupabase } from './supabase-server'
import { supabaseAdmin } from './supabase'
import type { Database } from './database.types'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AuthUser {
  id: string
  email?: string
  role?: string
  name?: string
}

/* ------------------------------------------------------------------ */
/*  PIN helpers                                                        */
/* ------------------------------------------------------------------ */

// NOTE: Production should use the proper 'bcrypt' npm package.
// This HMAC-based approach is an interim measure until bcrypt can be
// installed and wired up.  The PIN_SECRET must be a strong random
// string and should be rotated via your secrets manager.
const PIN_SECRET =
  process.env.PIN_SECRET || 'enviroworx-pin-secret-change-in-production'

/**
 * Hash a plain-text PIN using HMAC-SHA256.
 *
 * @param pin  Raw numeric PIN (e.g. "1234")
 * @returns    Hex-encoded HMAC digest
 */
export async function hashPin(pin: string): Promise<string> {
  return createHmac('sha256', PIN_SECRET).update(pin).digest('hex')
}

/**
 * Verify a plain-text PIN against a stored HMAC hash.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param pin   Raw numeric PIN entered by the user
 * @param hash  Stored hash from hashPin()
 * @returns     true when the PIN matches
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const computed = await hashPin(pin)
  // Timing-safe comparison prevents side-channel leaks
  const compBuf = Buffer.from(computed, 'hex')
  const hashBuf = Buffer.from(hash, 'hex')
  if (compBuf.length !== hashBuf.length) return false
  return timingSafeEqual(compBuf, hashBuf)
}

/* ------------------------------------------------------------------ */
/*  Low-level helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Extract a Bearer token from a Request's Authorization header.
 */
function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization')
  if (!auth) return null
  const match = auth.match(/^Bearer\s+(.+)$/)
  return match ? match[1] : null
}

/**
 * Verify a Supabase JWT (from the browser auth session) and return
 * the user record.  Uses supabaseAdmin so it works even when the
 * server's own anon session has expired.
 */
async function verifySupabaseJwt(jwt: string): Promise<{
  id: string
  email?: string
  role?: string
} | null> {
  const { data, error } = await supabaseAdmin.auth.getUser(jwt)
  if (error || !data.user) return null
  return {
    id: data.user.id,
    email: data.user.email,
    role: (data.user.app_metadata?.role as string) ||
          (data.user.user_metadata?.role as string),
  }
}

/* ------------------------------------------------------------------ */
/*  Role-based guards                                                  */
/* ------------------------------------------------------------------ */

/**
 * Verify that the request carries a valid office / yard-staff session.
 *
 * Flow:
 *   1. Read the Bearer token from the Authorization header.
 *   2. Ask Supabase Auth to validate the JWT.
 *   3. Look up the matching record in `yard_staff`.
 *   4. Return an AuthUser with role="office" when everything checks out.
 *
 * @param req  The incoming Request object
 * @returns    AuthUser when authenticated, null otherwise
 */
export async function requireOfficeAuth(
  req: Request
): Promise<AuthUser | null> {
  const token = getBearerToken(req)
  if (!token) return null

  const jwtUser = await verifySupabaseJwt(token)
  if (!jwtUser) return null

  // Check the yard_staff table for a matching auth user
  const { data: staff, error } = await supabaseAdmin
    .from('yard_staff')
    .select('id, name, pin')
    .eq('id', jwtUser.id)
    .single()

  if (error || !staff) return null

  return {
    id: jwtUser.id,
    email: jwtUser.email,
    role: 'office',
    name: staff.name,
  }
}

/**
 * Verify that the request carries a valid driver session.
 *
 * Flow:
 *   1. Read the Bearer token from the Authorization header.
 *   2. Ask Supabase Auth to validate the JWT.
 *   3. Look up the matching record in `drivers`.
 *   4. Return an AuthUser with role="driver" when everything checks out.
 *
 * @param req  The incoming Request object
 * @returns    AuthUser when authenticated, null otherwise
 */
export async function requireDriverAuth(
  req: Request
): Promise<AuthUser | null> {
  const token = getBearerToken(req)
  if (!token) return null

  const jwtUser = await verifySupabaseJwt(token)
  if (!jwtUser) return null

  // Check the drivers table for a matching auth user
  const { data: driver, error } = await supabaseAdmin
    .from('drivers')
    .select('id, name, status')
    .eq('id', jwtUser.id)
    .single()

  if (error || !driver) return null

  return {
    id: jwtUser.id,
    email: jwtUser.email,
    role: 'driver',
    name: driver.name,
  }
}

/**
 * Verify that the request carries a valid customer portal session.
 *
 * Flow:
 *   1. Read the Bearer token from the Authorization header.
 *   2. Ask Supabase Auth to validate the JWT.
 *   3. Look up the matching record in `customers` via auth_user_id.
 *   4. Return an AuthUser with role="customer" when everything checks out.
 *
 * @param req  The incoming Request object
 * @returns    AuthUser when authenticated, null otherwise
 */
export async function requireCustomerAuth(
  req: Request
): Promise<AuthUser | null> {
  const token = getBearerToken(req)
  if (!token) return null

  const jwtUser = await verifySupabaseJwt(token)
  if (!jwtUser) return null

  // Check the customers table for a matching auth user UUID.
  // The customers table uses the Supabase auth user id stored
  // in the `id` column (primary key, UUID type).
  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, email, full_name')
    .eq('id', jwtUser.id)
    .single()

  if (error || !customer) return null

  return {
    id: jwtUser.id,
    email: customer.email || jwtUser.email,
    role: 'customer',
    name: customer.full_name || customer.name,
  }
}

/* ------------------------------------------------------------------ */
/*  Cron / utility guards                                              */
/* ------------------------------------------------------------------ */

/**
 * Verify that an incoming request carries the shared CRON_SECRET.
 * Use this at the top of every cron route to prevent public execution.
 *
 * @param req  The incoming Request object
 * @returns    true when the secret matches
 */
export function verifyCronSecret(req: Request): boolean {
  const auth = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!auth || !process.env.CRON_SECRET) return false

  // Timing-safe comparison to prevent timing attacks
  const authBuf = Buffer.from(auth)
  const expectedBuf = Buffer.from(expected)
  if (authBuf.length !== expectedBuf.length) return false

  return timingSafeEqual(authBuf, expectedBuf)
}
