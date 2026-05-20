import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sessionCookieName } from '@/lib/session'

export async function POST() {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()

  const res = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookieName, '', { path: '/', maxAge: 0 })
  return res
}
