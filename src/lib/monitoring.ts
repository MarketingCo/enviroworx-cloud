/**
 * Optional error reporting — set MONITORING_WEBHOOK_URL to a Slack/Discord/Sentry ingest URL.
 */
export async function captureError(
  error: unknown,
  context?: Record<string, string | number | boolean>
) {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  console.error('[monitoring]', message, context ?? {}, stack)

  const url = process.env.MONITORING_WEBHOOK_URL
  if (!url) return

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Enviroworx error: ${message}`,
        context,
        stack: stack?.slice(0, 2000),
        service: 'enviroworx-cloud',
        env: process.env.VERCEL_ENV || process.env.NODE_ENV,
      }),
    })
  } catch {
    // Never throw from monitoring
  }
}
