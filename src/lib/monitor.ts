/**
 * Fire-and-forget error reporting to MONITORING_WEBHOOK_URL (P5.2).
 * No-op when the env var is unset; never throws.
 */
export function reportError(context: string, err: unknown) {
  const url = process.env.MONITORING_WEBHOOK_URL
  if (!url) return
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 6).join('\n') : undefined
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app: 'enviroworx-cloud',
      context,
      message,
      stack,
      at: new Date().toISOString(),
    }),
  }).catch(() => {})
}
