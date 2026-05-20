/**
 * Restrict who can use the Office app after Google OAuth.
 * Set at least one of OFFICE_GOOGLE_ALLOWED_DOMAINS or OFFICE_GOOGLE_ALLOWED_EMAILS in production.
 */

export function isOfficeGoogleEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.toLowerCase().trim()

  const rawEmails = process.env.OFFICE_GOOGLE_ALLOWED_EMAILS?.split(',') ?? []
  const allowEmails = rawEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)

  const rawDomains = process.env.OFFICE_GOOGLE_ALLOWED_DOMAINS?.split(',') ?? []
  const allowDomains = rawDomains.map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean)

  if (allowEmails.length && allowEmails.includes(normalized)) return true

  if (allowDomains.length) {
    const domain = normalized.split('@')[1]
    if (domain && allowDomains.includes(domain)) return true
  }

  if (allowEmails.length || allowDomains.length) return false

  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[office-google] OFFICE_GOOGLE_ALLOWED_DOMAINS / OFFICE_GOOGLE_ALLOWED_EMAILS not set — allowing any Google sign-in in development only'
    )
    return true
  }

  return false
}

export function officePinAuthEnabled(): boolean {
  return process.env.OFFICE_PIN_AUTH_ENABLED === 'true'
}
