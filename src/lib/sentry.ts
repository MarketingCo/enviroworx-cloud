/**
 * Sentry integration — Phase 8
 * Install @sentry/nextjs and configure in next.config.mjs
 *
 * This file provides the API; install the package to activate.
 *
 * Setup steps:
 * 1. npm install @sentry/nextjs
 * 2. npx @sentry/wizard@latest -i nextjs
 * 3. Set SENTRY_DSN in Vercel env vars
 */

export function initSentry() {
  // This will be populated when @sentry/nextjs is installed
  // For now, just console.log to confirm the hook point exists
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    console.log('[Sentry] Would initialize with DSN:', process.env.SENTRY_DSN.slice(0, 20) + '...')
  }
}

/**
 * Capture an exception in Sentry
 * Falls back to console.error if Sentry is not installed
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  // Check if Sentry is available (installed in Phase 8)
  const sentry = (globalThis as any).__SENTRY__
  if (sentry?.captureException) {
    sentry.captureException(error, context)
  } else {
    console.error('[Sentry fallback]', error, context)
  }
}

/**
 * Capture a message in Sentry
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  const sentry = (globalThis as any).__SENTRY__
  if (sentry?.captureMessage) {
    sentry.captureMessage(message, level)
  } else {
    console.log(`[Sentry ${level}]`, message)
  }
}
