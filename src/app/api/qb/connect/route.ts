import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.QB_CLIENT_ID
  const redirectUri = process.env.QB_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'QuickBooks not configured' }, { status: 500 })
  }

  const baseUrl = 'https://appcenter.intuit.com/connect/oauth2'

  const scopes = ['com.intuit.quickbooks.accounting']

  const authUrl = new URL(baseUrl)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scopes.join(' '))
  authUrl.searchParams.set('state', crypto.randomUUID())

  return NextResponse.redirect(authUrl)
}
