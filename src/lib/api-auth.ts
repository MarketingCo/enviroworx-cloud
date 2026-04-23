/**
 * Simple API authentication for Enviroworx routes.
 * 
 * Uses a shared API key passed via:
 *   - Header: Authorization: Bearer <key>
 *   - Header: x-api-key: <key>
 *   - Query: ?api_key=<key>
 * 
 * Set API_KEY env var in Vercel. If not set, auth is disabled (dev mode).
 */

const API_KEY = process.env.API_KEY

export function isAuthorized(request: Request): boolean {
  // If no API_KEY configured, allow all (local dev)
  if (!API_KEY) return true

  const authHeader = request.headers.get('authorization')
  const apiKeyHeader = request.headers.get('x-api-key')
  const url = new URL(request.url)
  const queryKey = url.searchParams.get('api_key')

  const token = 
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
    apiKeyHeader ||
    queryKey

  return token === API_KEY
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  })
}
