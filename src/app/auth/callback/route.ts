import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { lookupOfficeStaff } from '@/lib/office-staff'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextRaw = searchParams.get('next') ?? '/office'
  const next = nextRaw.startsWith('/') ? nextRaw : '/office'

  if (!code) {
    return NextResponse.redirect(`${origin}/office/login?error=auth`)
  }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/office/login?error=auth`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const staff = user?.email ? await lookupOfficeStaff(user.email) : null
  if (!staff) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/office/login?error=forbidden`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
