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
 *   - PIN hashing / comparison    (hashPin, verifyPin) using bcrypt
 *
 * All functions are designed to run server-side only.
 * Do NOT import this file into Client Components.
 */

import { timingSafeEqual } from 'crypto'
import bcrypt from 'bcrypt'
import { createServerSupabase } from './supabase-server'
import { supabaseAdmin } from './supabase'

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
/*  PIN helpers (bcrypt)                                               */
/* ------------------------------------------------------------------ */

const SALT_ROUNDS = 12

/**
 * Hash a plain-text PIN using bcrypt.
 *
 * @param pin  Raw numeric PIN (e.g. "1234")
 * @returns    bcrypt hash string
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS)
}

/**
 * Verify a plain-text PIN against a stored bcrypt hash.
 *
 * @param pin   Raw numeric PIN entered by the user
 * @param hash  Stored hash from hashPin()
 * @returns     true when the PIN matches
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
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
  return match?.[1] ?? null
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
 */
export async function requireOfficeAuth(
  req: Request
): Promise<AuthUser | null> {
  const token = getBearerToken(req)
  if (!token) return null

  const jwtUser = await verifySupabaseJwt(token)
  if (!jwtUser) return null

  const { data: staff, error } = await supabaseAdmin
    .from('yard_staff')
    .select('id, name, role')
    .eq('auth_user_id', jwtUser.id)
    .single()

  if (error || !staff) return null

  return {
    id: jwtUser.id,
    email: jwtUser.email,
    role: staff.role || 'office',
    name: staff.name,
  }
}

/**
 * Verify that the request carries a valid driver session.
 */
export async function requireDriverAuth(
  req: Request
): Promise<AuthUser | null> {
  const token = getBearerToken(req)
  if (!token) return null

  const jwtUser = await verifySupabaseJwt(token)
  if (!jwtUser) return null

  const { data: driver, error } = await supabaseAdmin
    .from('drivers')
    .select('id, name, status, role')
    .eq('auth_user_id', jwtUser.id)
    .single()

  if (error || !driver) return null

  return {
    id: jwtUser.id,
    email: jwtUser.email,
    role: driver.role || 'driver',
    name: driver.name,
  }
}

/**
 * Verify that the request carries a valid customer portal session.
 */
export async function requireCustomerAuth(
  req: Request
): Promise<AuthUser | null> {
  const token = getBearerToken(req)
  if (!token) return null

  const jwtUser = await verifySupabaseJwt(token)
  if (!jwtUser) return null

  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, email, full_name')
    .eq('auth_user_id', jwtUser.id)
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
 */
export function verifyCronSecret(req: Request): boolean {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!auth || !secret) return false

  const expected = `Bearer ${secret}`
  const authBuf = Buffer.from(auth)
  const expectedBuf = Buffer.from(expected)
  if (authBuf.length !== expectedBuf.length) return false

  return timingSafeEqual(authBuf, expectedBuf)
}
