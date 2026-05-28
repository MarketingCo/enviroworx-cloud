#!/usr/bin/env node
/**
 * Quick preflight — run: node scripts/preflight-check.mjs
 * Loads .env.local; does not print secrets.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY

const envChecks = [
  ['NEXT_PUBLIC_SUPABASE_URL', Boolean(url)],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', Boolean(anon)],
  ['SUPABASE_SERVICE_ROLE_KEY', Boolean(svc)],
  ['SESSION_SECRET', Boolean(process.env.SESSION_SECRET || process.env.CRON_SECRET)],
  ['OFFICE_GOOGLE_ALLOWED_DOMAINS', Boolean(process.env.OFFICE_GOOGLE_ALLOWED_DOMAINS?.trim())],
  ['GOOGLE_MAPS_API_KEY', Boolean(process.env.GOOGLE_MAPS_API_KEY)],
  ['STRIPE_SECRET_KEY', Boolean(process.env.STRIPE_SECRET_KEY)],
  ['STRIPE_WEBHOOK_SECRET', Boolean(process.env.STRIPE_WEBHOOK_SECRET)],
  ['CRON_SECRET', Boolean(process.env.CRON_SECRET)],
]

console.log('\n=== Local env (.env.local) ===')
for (const [k, ok] of envChecks) console.log(ok ? '✓' : '✗', k)

if (!url || !anon) {
  console.error('\nMissing Supabase URL/anon — cannot continue.')
  process.exit(1)
}

console.log('\n=== Supabase Auth: Google provider ===')
const oauthRes = await fetch(`${url}/auth/v1/authorize?provider=google`, {
  headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  redirect: 'manual',
})
const oauthBody = await oauthRes.text()
const googleEnabled =
  oauthRes.status === 302 ||
  (oauthRes.status === 200 && oauthBody.includes('accounts.google.com'))
const googleDisabled = oauthBody.includes('provider is not enabled')
console.log(
  googleEnabled ? '✓ Google appears enabled' : googleDisabled ? '✗ Google NOT enabled in Supabase' : '?',
  `(${oauthRes.status})`
)
if (googleDisabled) console.log('  → Supabase Dashboard → Auth → Providers → Google → Enable')

if (svc) {
  const admin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } })
  console.log('\n=== Database (service role) ===')
  const { error: cfgErr } = await admin.from('config').select('key').limit(1)
  console.log(cfgErr ? '✗ config table' : '✓ config table', cfgErr?.message || '')

  const { count: staff } = await admin
    .from('office_staff')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)
  console.log(staff ? `✓ office_staff (${staff} active)` : '✗ office_staff empty — add rows or set OFFICE_GOOGLE_ALLOWED_DOMAINS')

  const { count: drivers } = await admin.from('drivers').select('id', { count: 'exact', head: true })
  console.log(drivers ? `✓ drivers (${drivers})` : '✗ no drivers')

  const { count: customers } = await admin.from('customers').select('id', { count: 'exact', head: true })
  console.log(customers ? `✓ customers (${customers})` : '✗ no customers')
} else {
  console.log('\n✗ SUPABASE_SERVICE_ROLE_KEY missing — server actions / office data will fail')
}

const prodUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://enviroworx-cloud.vercel.app'
console.log('\n=== Production health ===')
try {
  const h = await fetch(`${prodUrl}/api/health`)
  const j = await h.json()
  console.log(j.ok ? '✓' : '✗', prodUrl, JSON.stringify(j.checks))
} catch (e) {
  console.log('✗ Could not reach', prodUrl, String(e))
}

console.log('')
