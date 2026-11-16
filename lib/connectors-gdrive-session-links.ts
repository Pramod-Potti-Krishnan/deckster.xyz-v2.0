/**
 * P4-15 slice 3 (Studio side, DARK): link picked Drive library items into a chat session, and carry the
 * linked ids on the build message so Director (!623, DIRECTOR_CONNECTOR_LINKED_ITEMS_ENABLED) runs the file path.
 * Flag NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED (exact "true", default off) AND the Drive flag.
 * Off: the session-links route 404s and the user message is byte-identical (no linked_item_ids key).
 * Client-safe: no node: imports.
 */
import { isGdriveConnectorEnabled } from '@/lib/connectors-gdrive-flag'

export const MAX_LINKED_ITEMS = 25 // = Director MAX_LINKED_ITEMS and Researcher MAX_ITEMS_PER_CALL

export function isGdriveSessionLinksEnabled(
  value: string | undefined = process.env.NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED,
  driveValue: string | undefined = process.env.NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED,
): boolean {
  return value === 'true' && isGdriveConnectorEnabled(driveValue)
}

/** Chat session id accepted for linking (never the connector library scope "lib:<owner>"). */
export function validChatSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value)
}

/** Linked item ids (Director _ID_RE): any bad id rejects the whole list; deduped, order kept. Empty = clear. */
export function validateLinkedItemIds(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length > MAX_LINKED_ITEMS) return null
  const out: string[] = []
  for (const id of input) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null
    if (!out.includes(id)) out.push(id)
  }
  return out
}

/** Spread into user_message.data. Flag off or ids undefined/invalid: {} (no key at all). */
export function linkedItemIdsField(ids: string[] | undefined, enabled: boolean = isGdriveSessionLinksEnabled()): { linked_item_ids?: string[] } {
  if (!enabled || ids === undefined) return {}
  const clean = validateLinkedItemIds(ids)
  return clean ? { linked_item_ids: clean } : {}
}
