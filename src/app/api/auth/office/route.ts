import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSessionToken, sessionCookieName, sessionCookieOptions } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { name, pin } = await req.json()
  if (!name?.trim() || !pin?.trim()) {
    return NextResponse.json({ error: 'Name and PIN required' }, { status: 400 })
  }

  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('id, name')
    .ilike('name', name.trim())
    .eq('pin', pin.trim())
    .maybeSingle()

  const { data: yardStaff } = !driver
    ? await supabaseAdmin
        .from('yard_staff')
        .select('id, name')
        .ilike('name', name.trim())
        .eq('pin', pin.trim())
        .maybeSingle()
    : { data: null }

  const user = driver || yardStaff
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await createSessionToken({
    sub: user.id,
    name: user.name,
    role: driver ? 'driver' : 'yard',
  })

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, role: driver ? 'driver' : 'yard' },
  })
  res.cookies.set(sessionCookieName, token, sessionCookieOptions())
  return res
}
