import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const state = searchParams.get('state')

  if (!code || !realmId) {
    return NextResponse.json({ error: 'Missing authorization code or realmId' }, { status: 400 })
  }

  // Exchange code for tokens
  const clientId = process.env.QB_CLIENT_ID
  const clientSecret = process.env.QB_CLIENT_SECRET
  const redirectUri = process.env.QB_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: 'QuickBooks credentials not configured' }, { status: 500 })
  }

  const tokenEndpoint = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return NextResponse.json({ error: `Token exchange failed: ${error}` }, { status: 500 })
  }

  const tokenData = await response.json()

  // Store tokens
  await supabaseAdmin.from('config').upsert({
    key: 'quickbooks_auth',
    value: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      realmId,
      clientId,
      clientSecret,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
    },
    updated_at: new Date().toISOString(),
  })

  // Redirect back to office settings
  return NextResponse.redirect(new URL('/office?tab=settings&qb=connected', req.url))
}
