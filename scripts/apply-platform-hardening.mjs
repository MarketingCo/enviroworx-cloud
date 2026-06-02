#!/usr/bin/env node
/**
 * Apply office_staff + activity_log columns if missing (idempotent).
 * Uses Supabase Management API — requires: supabase login
 */
import { readFileSync } from 'fs'
import { config } from 'dotenv'

config({ path: '.env.local' })

const projectRef =
  process.env.SUPABASE_PROJECT_REF ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

if (!projectRef) {
  console.error('Could not determine project ref from NEXT_PUBLIC_SUPABASE_URL')
  process.exit(1)
}

let token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  try {
    token = readFileSync(`${process.env.HOME}/.supabase/access-token`, 'utf8').trim()
  } catch {
    /* ignore */
  }
}

if (!token) {
  console.error('Run: supabase login')
  console.error('Or set SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

const sql = readFileSync('supabase/migrations/20260520000000_platform_hardening.sql', 'utf8')

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

const body = await res.text()
if (!res.ok) {
  console.error('Management API error', res.status, body)
  process.exit(1)
}

console.log('✓ platform_hardening SQL applied')
console.log(body.slice(0, 500))
