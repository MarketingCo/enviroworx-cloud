#!/usr/bin/env node
/** Seed default office_staff rows. Run: node scripts/seed-office-staff.mjs */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.API_KEY?.trim()

if (!url || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const rows = [
  { email: 'accounts@enviroworx.co.uk', display_name: 'Enviroworx Office', role: 'admin' },
  { email: 'info@enviroworx.co.uk', display_name: 'Enviroworx Info', role: 'office' },
]

for (const row of rows) {
  const { error } = await admin.from('office_staff').upsert(
    { ...row, active: true },
    { onConflict: 'email', ignoreDuplicates: false }
  )
  if (error) {
    const { data: existing } = await admin
      .from('office_staff')
      .select('email')
      .ilike('email', row.email)
      .maybeSingle()
    if (existing) {
      console.log('✓', row.email, '(already exists)')
      continue
    }
    const { error: insErr } = await admin.from('office_staff').insert({ ...row, active: true })
    if (insErr) {
      console.error('✗', row.email, insErr.message)
    } else {
      console.log('✓', row.email)
    }
  } else {
    console.log('✓', row.email)
  }
}
