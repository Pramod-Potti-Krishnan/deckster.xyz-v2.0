/**
 * Server-side helpers for the /api/knowledge-graph/* proxy routes (KG v2 P0).
 *
 * Server-only: reads KNOWLEDGE_API_KEY. Never import from client components.
 */

export const KG_BASE =
  process.env.KNOWLEDGE_SERVICE_URL || 'https://researcher-v1.up.railway.app'

/**
 * Headers for Researcher KG calls. Attaches X-API-Key when the deployment
 * has KNOWLEDGE_API_KEY set (the Researcher's KG router requires it when
 * configured; without the env var both sides run in open dev mode).
 */
export function kgHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra }
  const apiKey = process.env.KNOWLEDGE_API_KEY
  if (apiKey) headers['X-API-Key'] = apiKey
  return headers
}
