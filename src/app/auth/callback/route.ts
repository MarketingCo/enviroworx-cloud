import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isOfficeGoogleEmailAllowed } from '@/lib/office-google'

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

  if (!user?.email || !isOfficeGoogleEmailAllowed(user.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/office/login?error=forbidden`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
