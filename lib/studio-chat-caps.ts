// CHAT-CAPS-META (FRONTEND-2, B61: chat parity C-D1, the Studio half; contract CODEX-6 streams/codex/codex6/CHAT-CAPS-META.md, its "Studio reader" section).
// Flag NEXT_PUBLIC_STUDIO_CHAT_CAPS_META (exact "true", build-time, default off). Import-free and no I/O: a pure, dual-shape reader of Director's
// sync_response.payload.chat_capabilities and a read-only snapshot of it. Off: the hook never calls in here and nothing changes.
//
// The wire, two shapes (Director's DIRECTOR_CHAT_CAPS_META_ENABLED, held and off, picks one; with MULTI_INTENT_ENABLED off the field is absent):
//   legacy  {"qa": true, "delete_slide": true}                              enabled-only booleans (C-D1 off), today's wire
//   C-D1    {"qa": {"confirm": false, "client_directive": false}, ...}      the same advertised keys, two literal booleans per value
// plus the C2/C4 siblings chat_capability_meta ({key: {confirm, client_directive}}, older readers) and chat_operation_meta ({"templates.delete_template": {...}}).
//
// The reader's rules (the contract's): input is unknown at the boundary; a value is a literal true or an object of exactly confirm and client_directive, both
// literal booleans (Director's own wire schema); false, malformed entries and keys this UI does not know are dropped; a legacy true takes its hint from a valid sibling entry, else the hint
// is unknown (availability is still known); the nested value wins over the sibling; absent or malformed is UNKNOWN, {} is KNOWN-EMPTY. An operation hint is
// kept only while its group is advertised (a hint never turns a feature on). A mixed group's own confirm=false is no permission to skip an operation's card.
//
// The snapshot: replaced on each valid, current-session sync (never merged with the one before, never persisted); a stale socket's or another session's reply
// is ignored; it reads as UNKNOWN once the socket, the account or the session that wrote it is no longer current (the hook's own isCurrent check). Reading it
// is read-only: nothing here sends a frame, runs an action, or touches a client capability or the handshake. Server keys never invent client capabilities.

/** The flag: on only for the exact string "true" (unset, "false", "TRUE", " true", "1" are off). The caller passes the literal process.env value. */
export function studioChatCapsMetaOn(value: string | null | undefined): boolean {
  return value === 'true'
}

/** Resolved once at build time (Next inlines the literal read). */
export const STUDIO_CHAT_CAPS_META_ENABLED = studioChatCapsMetaOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_CAPS_META)

/** The capability keys this UI knows: Director's registry (config/chat_capabilities.json at codex6/chat-caps-meta 3e01129). Any other key is dropped. */
export const CHAT_CAPS_KNOWN_KEYS: readonly string[] = Object.freeze([
  'qa', 'resume', 'new_deck_redirect', 'compose_slide', 'rebuild_slide', 'delete_slide', 'add_element', 'refine_slide', 'refine_element',
  'build_control', 'reorder_slide', 'change_theme', 'export', 'bulk_edit', 'chat_undo', 'element_edit', 'speaker_notes', 'slide_script',
  'slide_references', 'duplicate_slide', 'delete_slides', 'theme_library', 'identity', 'templates', 'start_blank_canvas', 'add_blank_slide',
  'change_layout', 'goto_slide', 'rename_deck', 'duplicate_deck', 'delete_deck', 'present', 'view_mode', 'slide_rail', 'publish_deck',
  'publish_republish', 'publish_unpublish', 'publish_rotate', 'publish_settings', 'publish_link',
])

/** The operation hints this UI knows (C2, C4 and C-D1's chat_operation_meta), each with the group key that must be advertised for the hint to count. */
export const CHAT_CAPS_KNOWN_OPERATIONS: Readonly<Record<string, string>> = Object.freeze({
  'themes.delete_theme': 'theme_library',
  'themes.apply_theme_choice': 'theme_library',
  'templates.delete_template': 'templates',
  'templates.clear_template': 'templates',
  'templates.set_template_mode': 'templates',
  'templates.save_template': 'templates',
  'templates.optimize_template': 'templates',
  'templates.stop': 'templates',
  'identity.generate_logo': 'identity',
})

/** Groups whose operations carry their own confirmation: the group's confirm=false says nothing about an operation. */
export const CHAT_CAPS_MIXED_GROUPS: readonly string[] = Object.freeze(['theme_library', 'identity', 'templates'])

export interface ChatCapabilityHint {
  readonly available: true
  /** The server's hint that this capability's normal path needs a confirmation card; undefined when unknown (a legacy true without a valid sibling). */
  readonly confirm: boolean | undefined
  /** The server's hint that Studio performs the action; undefined when unknown. */
  readonly clientDirective: boolean | undefined
}
export interface ChatOperationHint {
  readonly capability: string
  readonly confirm: boolean
  readonly clientDirective: boolean
}
export type ChatCapabilities =
  | { readonly known: false }
  | { readonly known: true; readonly caps: ReadonlyMap<string, ChatCapabilityHint>; readonly operations: ReadonlyMap<string, ChatOperationHint> }

const UNKNOWN: ChatCapabilities = Object.freeze({ known: false as const })
const own = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key)
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const knownKey = (key: string) => CHAT_CAPS_KNOWN_KEYS.includes(key)
/** {confirm, client_directive}: exactly those two own fields, both literal booleans (Director's wire schema forbids any other field); anything else is malformed (null). */
function hintOf(value: unknown): { confirm: boolean; clientDirective: boolean } | null {
  if (!isRecord(value) || Object.keys(value).length !== 2 || !own(value, 'confirm') || !own(value, 'client_directive')) return null
  const { confirm, client_directive: clientDirective } = value
  return typeof confirm === 'boolean' && typeof clientDirective === 'boolean' ? { confirm, clientDirective } : null
}

/**
 * The pure dual-shape parser. `capabilities` is payload.chat_capabilities; `capabilityMeta` and `operationMeta` are the optional C2/C4 siblings
 * (payload.chat_capability_meta, payload.chat_operation_meta). Absent or malformed `capabilities` is { known: false }; a record (even {}) is known.
 */
export function parseChatCapabilities(capabilities: unknown, capabilityMeta?: unknown, operationMeta?: unknown): ChatCapabilities {
  if (!isRecord(capabilities)) return UNKNOWN
  const sibling = isRecord(capabilityMeta) ? capabilityMeta : null
  const caps = new Map<string, ChatCapabilityHint>()
  for (const key of Object.keys(capabilities)) {
    if (!knownKey(key)) continue
    const value = capabilities[key]
    if (value === true) {
      const legacy = sibling && own(sibling, key) ? hintOf(sibling[key]) : null
      caps.set(key, Object.freeze({ available: true as const, confirm: legacy ? legacy.confirm : undefined, clientDirective: legacy ? legacy.clientDirective : undefined }))
      continue
    }
    const typed = hintOf(value)
    if (typed) caps.set(key, Object.freeze({ available: true as const, confirm: typed.confirm, clientDirective: typed.clientDirective }))
  }
  const operations = new Map<string, ChatOperationHint>()
  if (isRecord(operationMeta)) {
    for (const name of Object.keys(operationMeta)) {
      if (!own(CHAT_CAPS_KNOWN_OPERATIONS, name)) continue
      const capability = CHAT_CAPS_KNOWN_OPERATIONS[name]
      const hint = hintOf(operationMeta[name])
      if (hint && caps.has(capability)) operations.set(name, Object.freeze({ capability, confirm: hint.confirm, clientDirective: hint.clientDirective }))
    }
  }
  return Object.freeze({ known: true as const, caps, operations })
}

/** The same, read from a sync_response payload (unknown at the boundary). */
export function parseSyncChatCapabilities(payload: unknown): ChatCapabilities {
  if (!isRecord(payload)) return UNKNOWN
  return parseChatCapabilities(payload.chat_capabilities, payload.chat_capability_meta, payload.chat_operation_meta)
}

/**
 * Is a confirmation card required, as far as the server's hint says? true / false, or undefined when not known (unknown snapshot, key not advertised,
 * a legacy true without a hint, or a mixed group whose operation has no hint of its own: its group's false is no permission to skip a card).
 * Guidance only: confirmation, ownership, client caps, plan limits and paid consent stay in the actual action paths.
 */
export function chatCapConfirmHint(snapshot: ChatCapabilities, key: string, operation?: string): boolean | undefined {
  if (!snapshot.known) return undefined
  const cap = snapshot.caps.get(key)
  if (!cap) return undefined
  const op = operation ? snapshot.operations.get(operation) : undefined
  if (op && op.capability === key) return op.confirm
  if (CHAT_CAPS_MIXED_GROUPS.includes(key) && cap.confirm !== true) return undefined
  return cap.confirm
}

// ---- the snapshot (one per tab; the hook writes it, everything else only reads it) -------------------------------------------------------------------

export interface ChatCapsSyncOwner {
  /** The frame's own session_id. */
  readonly frameSessionId: unknown
  /** The session the socket was opened for. */
  readonly socketSessionId: string
  /** The session the hook shows now. */
  readonly currentSessionId: string
  /** The hook's own check: this socket is still the active one, for the same account and session. */
  readonly isCurrent: () => boolean
}

let held: { readonly snapshot: ChatCapabilities; readonly isCurrent: () => boolean } | null = null
const stillCurrent = (isCurrent: () => boolean) => { try { return isCurrent() === true } catch { return false } }

/** The hook's one call, in its sync_response case (flag on). A valid, current-session sync replaces the snapshot; any other reply changes nothing. Emits nothing. */
export function chatCapsSyncReceived(payload: unknown, owner: ChatCapsSyncOwner): void {
  if (!owner || typeof owner.isCurrent !== 'function' || !stillCurrent(owner.isCurrent)) return
  if (typeof owner.socketSessionId !== 'string' || !owner.socketSessionId || owner.socketSessionId !== owner.currentSessionId || owner.frameSessionId !== owner.socketSessionId) return
  held = { snapshot: parseSyncChatCapabilities(payload), isCurrent: owner.isCurrent }
}

/** The read-only snapshot: UNKNOWN until a valid sync, and again once the socket, account or session that wrote it is no longer current (it is dropped). A copy: no reader can change it. */
export function chatCapsSnapshot(): ChatCapabilities {
  if (held && !stillCurrent(held.isCurrent)) held = null
  if (!held || !held.snapshot.known) return UNKNOWN
  return Object.freeze({ known: true as const, caps: new Map(held.snapshot.caps), operations: new Map(held.snapshot.operations) })
}
