/** Exact introductory text in Director 522d41e4's _send_greeting.
 * This is a source signature, NOT greeting metadata or event identity.
 */
export const DIRECTOR_522_INITIAL_GREETING = "Hello! I'm your presentation assistant. "
  + 'I can help you create professional presentations. '
  + 'What topic would you like to present on?';

export interface GreetingDisplayOwner {
  userId: string;
  sessionId: string;
  /** Monotonic account/session/mount lifetime; an A→B→A transition changes it. */
  generation: number;
  /** Changes on every transcript admission or restoration. */
  transcriptRevision: number;
}

/** Private caller-owned evidence, never read from message payloads or cache.
 * Current hook does not provide this proof. A full frontend DB response or a
 * browser cache alone is insufficient to set completeFromOrigin=true.
 */
export interface PristineGreetingDisplayEvidence extends GreetingDisplayOwner {
  origin: 'fresh-owned-lifecycle' | 'complete-director-history';
  completeFromOrigin: boolean;
  hasEverUserTurn: boolean;
  hasEverNonIntroConversation: boolean;
  historyUncertain: boolean;
  pendingWork: boolean;
  noticePresent: boolean;
}

export interface GreetingDisplayEntry {
  id?: string;
  message_id?: string;
  session_id?: string;
  type?: string;
  role?: string;
  messageType?: string;
  timestamp?: string | number;
  clientTimestamp?: number;
  payload?: unknown;
}

/** Explicitly inferred display scope after a completed owned frontend load.
 * Frontend persistence may lag Director; this is NOT origin-complete evidence.
 * The caller must check every currently owned user/send/action channel and
 * latch any user/nonintro ever seen across reconnects in this owner lifetime.
 */
export interface InferredPristineGreetingDisplayEvidence extends GreetingDisplayOwner {
  origin: 'completed-owned-frontend-load';
  completedFrontendLoad: boolean;
  noUserInOwnedChannels: boolean;
  hasEverUserTurn: boolean;
  hasEverNonIntroConversation: boolean;
  historyUncertain: boolean;
  pendingWork: boolean;
  pendingRestoration: boolean;
  noticePresent: boolean;
}

function validOwner(owner: GreetingDisplayOwner): boolean {
  return typeof owner.userId === 'string' && owner.userId.trim().length > 0
    && typeof owner.sessionId === 'string' && owner.sessionId.trim().length > 0
    && owner.sessionId !== 'new'
    && Number.isSafeInteger(owner.generation) && owner.generation >= 0
    && Number.isSafeInteger(owner.transcriptRevision) && owner.transcriptRevision >= 0;
}

function greetingTimestamp(entry: GreetingDisplayEntry, sessionId: string): number {
  if (!entry.message_id || entry.session_id !== sessionId || entry.type !== 'chat_message'
    || entry.role !== 'assistant' || entry.messageType === 'user') return NaN;
  const payload = entry.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return NaN;
  const data = payload as Record<string, unknown>;
  // Keep additive/unknown payloads and meaningful subtitle/list/error content.
  const fields = new Set(['text', 'sub_title', 'list_items', 'format', 'ephemeral']);
  if (Object.keys(data).some(key => !fields.has(key))
    || data.text !== DIRECTOR_522_INITIAL_GREETING
    || data.sub_title !== null || data.list_items !== null
    || data.format !== 'markdown' || data.ephemeral !== false
    || typeof entry.timestamp !== 'string') return NaN;
  const timestamp = entry.timestamp.trim();
  if (!timestamp) return NaN;
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`;
  return Date.parse(normalized);
}

function projectOnlyIntroductions<T extends GreetingDisplayEntry>(entries: readonly T[], sessionId: string): readonly T[] {
  let previousTime = -Infinity;
  const ids = new Set<string>();
  for (const entry of entries) {
    const time = greetingTimestamp(entry, sessionId);
    if (!Number.isFinite(time) || time < previousTime || ids.has(entry.message_id!)) return entries;
    ids.add(entry.message_id!);
    previousTime = time;
  }
  return [entries[0]];
}

/** Optional pristine-session DISPLAY projection. Raw history is unchanged.
 *
 * Coalesce only an entire, chronological, explicitly certified introduction-
 * only conversation. Any user turn, nonintro entry, missing role, uncertain
 * history, outstanding work, notice, owner ABA, or stale evidence keeps every
 * entry. It never guesses that the first frame on a new socket is a greeting.
 * The owner/proof must come from trusted lifecycle code, not server metadata.
 */
export function coalescePristineDirectorGreetings<T extends GreetingDisplayEntry>(
  entries: readonly T[],
  owner: GreetingDisplayOwner,
  evidence: PristineGreetingDisplayEvidence | null,
): readonly T[] {
  if (entries.length < 2 || !validOwner(owner) || !evidence
    || evidence.userId !== owner.userId || evidence.sessionId !== owner.sessionId
    || evidence.generation !== owner.generation
    || evidence.transcriptRevision !== owner.transcriptRevision
    || (evidence.origin !== 'fresh-owned-lifecycle' && evidence.origin !== 'complete-director-history')
    || evidence.completeFromOrigin !== true || evidence.hasEverUserTurn !== false
    || evidence.hasEverNonIntroConversation !== false || evidence.historyUncertain !== false
    || evidence.pendingWork !== false || evidence.noticePresent !== false) return entries;

  return projectOnlyIntroductions(entries, owner.sessionId);
}

/** Narrow INFERRED display variant; never use its result for persistence,
 * event processing, status clearing or historical action retirement.
 *
 * All currently observed owned conversation entries must be pinned, plain
 * introductions and no owned user/action/send/restore/notice may be known.
 * A completed frontend load can admit this visual policy, but cannot prove
 * that Director has no unseen user turns. Raw messages remain available and
 * a later user/nonintro/work/uncertainty fact reverses the whole projection.
 */
export function coalesceInferredPristineDirectorGreetings<T extends GreetingDisplayEntry>(
  entries: readonly T[],
  owner: GreetingDisplayOwner,
  evidence: InferredPristineGreetingDisplayEvidence | null,
): readonly T[] {
  if (entries.length < 2 || !validOwner(owner) || !evidence
    || evidence.userId !== owner.userId || evidence.sessionId !== owner.sessionId
    || evidence.generation !== owner.generation
    || evidence.transcriptRevision !== owner.transcriptRevision
    || evidence.origin !== 'completed-owned-frontend-load'
    || evidence.completedFrontendLoad !== true || evidence.noUserInOwnedChannels !== true
    || evidence.hasEverUserTurn !== false || evidence.hasEverNonIntroConversation !== false
    || evidence.historyUncertain !== false || evidence.pendingWork !== false
    || evidence.pendingRestoration !== false || evidence.noticePresent !== false) return entries;
  return projectOnlyIntroductions(entries, owner.sessionId);
}

export interface InferredGreetingPrefixEvidence extends GreetingDisplayOwner {
  origin: 'completed-owned-frontend-load' | 'observed-fresh-pristine-lifecycle';
  completedFrontendLoad: boolean;
  observedFreshFromCreation: boolean;
  noUserInOwnedChannels: boolean;
  hasEverUserIntent: boolean;
  hasEverNonIntroConversation: boolean;
  historyUncertain: boolean;
  pendingRestoration: boolean;
  pendingWork: boolean;
  noticePresent: boolean;
  /** Exact private DB assistant IDs from this completed owned load. No wire
   * annotation, blanket missing-role fallback or text-based role inference. */
  restoredAssistantIds: readonly string[];
  /** IDs admitted before any live user intent, or restored by this completed
   * owned load. Never add a live post-user answer just because its text matches. */
  eligibleIntroIds: readonly string[];
}

export interface InferredGreetingPrefixCertificate {
  readonly userId: string;
  readonly sessionId: string;
  readonly generation: number;
  readonly admittedTranscriptRevision: number;
  readonly origin: InferredGreetingPrefixEvidence['origin'];
  readonly restoredAssistantIds: readonly string[];
  readonly prefix: readonly { readonly id: string; readonly timestamp: number }[];
}

export interface GreetingPrefixProjectionSafety {
  historyUncertain: boolean;
  pendingRestoration: boolean;
}

function entryTime(entry: GreetingDisplayEntry): number {
  if (entry.messageType === 'user' && typeof entry.timestamp === 'number') return entry.timestamp;
  if (typeof entry.clientTimestamp === 'number' && Number.isFinite(entry.clientTimestamp)) return entry.clientTimestamp;
  if (typeof entry.timestamp !== 'string' || !entry.timestamp.trim()) return NaN;
  const timestamp = entry.timestamp.trim();
  return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`);
}

function ownedChronologicalTranscript(entries: readonly GreetingDisplayEntry[], sessionId: string): boolean {
  let previousTime = -Infinity;
  const ids = new Set<string>();
  for (const entry of entries) {
    const localUser = entry.messageType === 'user';
    const id = localUser ? entry.id ?? entry.message_id : entry.message_id;
    // Local user rows have no session_id; the trusted caller supplies only the
    // currently owned user channel. Any supplied foreign session is refused.
    if (!id || ids.has(id) || (entry.session_id !== undefined && entry.session_id !== sessionId)
      || (!localUser && entry.session_id !== sessionId)) return false;
    const time = entryTime(entry);
    if (!Number.isFinite(time) || time < previousTime) return false;
    ids.add(id);
    previousTime = time;
  }
  return true;
}

function prefixGreetingTime(entry: GreetingDisplayEntry, sessionId: string, restoredAssistantIds: readonly string[]): number {
  if (entry.messageType === 'user' || entry.role === 'user') return NaN;
  const privateRestoredAssistant = entry.role === undefined && Boolean(entry.message_id)
    && restoredAssistantIds.includes(entry.message_id!);
  const signatureTime = greetingTimestamp(privateRestoredAssistant ? { ...entry, role: 'assistant' } : entry, sessionId);
  return Number.isFinite(signatureTime) ? entryTime(entry) : NaN;
}

/** Infer an INITIAL DISPLAY PREFIX from completed owned load or demonstrated
 * fresh pristine observation. This is a disclosed source-signature inference,
 * not backend greeting event identity. Capture IDs before live user intent.
 * The result can survive later genuine user turns; it never expands itself.
 */
export function inferStudioGreetingPrefixCertificate(
  entries: readonly GreetingDisplayEntry[], owner: GreetingDisplayOwner,
  evidence: InferredGreetingPrefixEvidence | null,
): InferredGreetingPrefixCertificate | null {
  if (!validOwner(owner) || !evidence || entries.length < 2
    || evidence.userId !== owner.userId || evidence.sessionId !== owner.sessionId
    || evidence.generation !== owner.generation || evidence.transcriptRevision !== owner.transcriptRevision
    || evidence.historyUncertain !== false || evidence.pendingRestoration !== false
    || evidence.pendingWork !== false || evidence.noticePresent !== false
    || !Array.isArray(evidence.restoredAssistantIds) || !Array.isArray(evidence.eligibleIntroIds)
    || !ownedChronologicalTranscript(entries, owner.sessionId)) return null;
  const completedLoad = evidence.origin === 'completed-owned-frontend-load' && evidence.completedFrontendLoad === true;
  const freshPristine = evidence.origin === 'observed-fresh-pristine-lifecycle' && evidence.observedFreshFromCreation === true
    && evidence.noUserInOwnedChannels === true && evidence.hasEverUserIntent === false
    && evidence.hasEverNonIntroConversation === false;
  if (!completedLoad && !freshPristine) return null;
  // A completed load may contain historical conversation. Once any owned user
  // intent/nonintro is known, only its restored DB IDs can establish a new
  // historical prefix; newly live frames cannot be promoted by equal text.
  const restoredOnly = completedLoad && (evidence.hasEverUserIntent !== false
    || evidence.hasEverNonIntroConversation !== false || evidence.noUserInOwnedChannels !== true);
  const prefix: { id: string; timestamp: number }[] = [];
  for (const entry of entries) {
    const time = prefixGreetingTime(entry, owner.sessionId, evidence.restoredAssistantIds);
    if (!Number.isFinite(time)) break; // User, action, response, error or unknown role is a boundary.
    if (!evidence.eligibleIntroIds.includes(entry.message_id!)) break;
    if (restoredOnly && !evidence.restoredAssistantIds.includes(entry.message_id!)) break;
    prefix.push(Object.freeze({ id: entry.message_id!, timestamp: time }));
  }
  if (prefix.length < 2) return null;
  // A fresh observation cannot certify any historical/nonintro tail.
  if (freshPristine && prefix.length !== entries.length) return null;
  return Object.freeze({ userId: owner.userId, sessionId: owner.sessionId, generation: owner.generation,
    admittedTranscriptRevision: owner.transcriptRevision, origin: evidence.origin,
    restoredAssistantIds: Object.freeze([...evidence.restoredAssistantIds]), prefix: Object.freeze(prefix) });
}

/** Coalesce only the frozen known INITIAL prefix. New user/send/action work
 * does not resurrect its duplicate IDs and never expands the certificate.
 * All later equal-text answers/notices/actions remain independent raw entries.
 * Unknown/changed prefix shape, chronology, owner or history fails open.
 * Never use this display result for cache/save/history/action retirement.
 */
export function coalesceCertifiedStudioGreetingPrefix<T extends GreetingDisplayEntry>(
  entries: readonly T[], owner: GreetingDisplayOwner,
  certificate: InferredGreetingPrefixCertificate | null,
  safety: GreetingPrefixProjectionSafety,
): readonly T[] {
  if (!certificate || !validOwner(owner) || certificate.userId !== owner.userId
    || certificate.sessionId !== owner.sessionId || certificate.generation !== owner.generation
    || certificate.admittedTranscriptRevision > owner.transcriptRevision
    || safety.historyUncertain !== false || safety.pendingRestoration !== false
    || certificate.prefix.length < 2 || entries.length < certificate.prefix.length
    || !ownedChronologicalTranscript(entries, owner.sessionId)) return entries;
  for (let index = 0; index < certificate.prefix.length; index++) {
    const admitted = certificate.prefix[index], entry = entries[index];
    if (entry.message_id !== admitted.id
      || prefixGreetingTime(entry, owner.sessionId, certificate.restoredAssistantIds) !== admitted.timestamp) return entries;
  }
  return [entries[0], ...entries.slice(certificate.prefix.length)];
}
