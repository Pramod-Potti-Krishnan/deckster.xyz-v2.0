// CARD-REASONS (KNOWLEDGE-3 for FRONTEND-1). Flag NEXT_PUBLIC_STUDIO_CONNECTORS_CARD_REASONS, the exact string "true", default off, build-time (read once, as a literal, so Next inlines it).
// It changes the Google Drive card on Settings > Connectors (app/(app)/settings/connectors/page.tsx) and nothing else: (1) the card says, in one fixed sentence, how the Google sign-in ended (the callback's ?gdrive= word, read once on mount); (2) a failed list call keeps its words and gains small print that names the reason.
// Off, the card is the card it was (every line the page gains is behind this flag). The composer's own ?gdrive= handling (hooks/use-gdrive-composer.ts) and its one-time marker rule (lib/connectors-gdrive-composer.ts, lib/connectors-gdrive-server.ts) are not touched.
export const STUDIO_CONNECTORS_CARD_REASONS = process.env.NEXT_PUBLIC_STUDIO_CONNECTORS_CARD_REASONS === 'true'

/** The callback's four words (GdriveReturnStatus in lib/connectors-gdrive-composer.ts) as the one sentence the card shows; any other value (a made-up one, another case, nothing) shows nothing. The raw word is never shown. */
export function gdriveResultLine(word: unknown): string | null {
  switch (word) {
    case 'cancelled': return 'Google sign-in was cancelled or not approved.'
    case 'invalid': return 'The Google sign-in took too long or finished in another browser. Please try again here.'
    case 'failed': return 'Google said yes, but Deckster could not save the connection. This is our fault; please try again later.'
    case 'connected': return 'Google Drive is connected.'
    default: return null
  }
}

/** The ?gdrive= word of a query string, and the query string without it (every other parameter stays). `found` says whether the address carried the word at all (whatever its value), so the caller can take it off the address bar. */
export function takeGdriveResultWord(search: string): { word: string | null; found: boolean; search: string } {
  const params = new URLSearchParams(search)
  const found = params.has('gdrive')
  const word = params.get('gdrive')
  params.delete('gdrive')
  const rest = params.toString()
  return { word, found, search: rest ? `?${rest}` : '' }
}

/**
 * The small print under a failed list call, which keeps its own words: "code: <error_code>" when the answer carries an error_code that starts with CONNECTOR_ (the codes the route relays from the allow-list in lib/connectors-gdrive.ts:
 * capitals, digits and underscores only, so nothing else can be printed as a code), otherwise "service error <status>" (the HTTP status of the answer); null when there is nothing safe to say (not an HTTP status).
 * It never prints a token, an id or an e-mail: only the status number and a code of that shape.
 */
export function gdriveFailureDetail(status: unknown, body: unknown): string | null {
  const code = body !== null && typeof body === 'object' ? (body as { error_code?: unknown }).error_code : undefined
  if (typeof code === 'string' && /^CONNECTOR_[A-Z0-9_]{1,64}$/.test(code)) return `code: ${code}`
  if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) return `service error ${status}`
  return null
}
