/** Private volatile transcript authority. Never include in cache/storage/wire fields. */
export interface StudioVoiceTranscriptMessage {
  message_id?: string;
  session_id?: string;
  type?: string;
  role?: string;
  payload?: unknown;
}

const brand: unique symbol = Symbol('studio-voice-transcript');

export interface StudioVoiceTranscriptProvenance {
  readonly [brand]: true;
  readonly epoch: object;
  readonly owner: object;
  readonly userId: string | null;
  readonly sessionId: string | null;
  readonly live: ReadonlySet<string>;
  readonly restored: ReadonlySet<string>;
  readonly ephemeral: ReadonlySet<string>;
  /** Unknown policy, retired lifetimes and observed owner loss always deny. */
  isCurrent(): boolean;
  /** Synchronous deny-only retirement, shared by every snapshot of this epoch. */
  retire(): void;
}

export interface StudioVoiceTranscriptSeed {
  readonly owner: object;
  readonly userId: string | null;
  readonly sessionId: string | null;
  /** Must read render-current auth/session/attempt/lifetime refs, not a stale closure. */
  readonly isCurrentOwner: () => boolean;
  readonly cachedMessages: readonly StudioVoiceTranscriptMessage[];
  readonly priorVisibleMessages: readonly StudioVoiceTranscriptMessage[];
  readonly ephemeralIds: readonly string[];
}

export interface StudioVoiceTranscriptFrameAdmission {
  readonly frame: StudioVoiceTranscriptMessage;
  /** Exact object appended by the actual reducer (including its projection). */
  readonly admittedMessage: StudioVoiceTranscriptMessage;
  readonly beforeMessages: readonly StudioVoiceTranscriptMessage[];
  readonly afterMessages: readonly StudioVoiceTranscriptMessage[];
  readonly ownershipAdmitted: boolean;
  readonly reducerAppended: boolean;
  /** Result of the actual current MessageList classifier; unknown/false denies. */
  readonly assistantAdmitted: boolean;
  readonly ephemeralIds: readonly string[];
}

export interface StudioVoiceTranscriptRestoreAdmission {
  readonly ownershipAdmitted: boolean;
  readonly historicalMessages: readonly StudioVoiceTranscriptMessage[];
  readonly cachedMessages: readonly StudioVoiceTranscriptMessage[];
  readonly priorVisibleMessages: readonly StudioVoiceTranscriptMessage[];
  readonly acceptedMessages: readonly StudioVoiceTranscriptMessage[];
  readonly ephemeralIds: readonly string[];
}

interface Lifetime {
  readonly epoch: object;
  readonly seed: StudioVoiceTranscriptSeed;
  active: boolean;
  // These only revoke. A later exclusion also invalidates an older live snapshot.
  readonly veto: Set<string>;
}
interface Snapshot {
  readonly lifetime: Lifetime;
  readonly ready: boolean;
  readonly live: ReadonlySet<string>;
  readonly restored: ReadonlySet<string>;
  readonly ephemeral: ReadonlySet<string>;
  readonly observed: ReadonlySet<string>;
}
const snapshots = new WeakMap<StudioVoiceTranscriptProvenance, Snapshot>();
const stable = (id: unknown): id is string => typeof id === 'string' && id.trim().length > 0;
const ids = (messages: readonly StudioVoiceTranscriptMessage[]): string[] => messages.flatMap(m => stable(m.message_id) ? [m.message_id] : []);
const payloadEphemeral = (m: StudioVoiceTranscriptMessage): boolean => (m.payload as { ephemeral?: unknown } | null)?.ephemeral === true;
const ephemeralIds = (messages: readonly StudioVoiceTranscriptMessage[]): string[] => messages.filter(payloadEphemeral).flatMap(m => stable(m.message_id) ? [m.message_id] : []);
const union = (...sources: readonly Iterable<string>[]): Set<string> => new Set(sources.flatMap(source => Array.from(source).filter(stable)));

/** A frozen facade, rather than Object.freeze(new Set), which still permits add(). */
function readonlySet(source: ReadonlySet<string>): ReadonlySet<string> {
  const set = new Set(source);
  const view: ReadonlySet<string> = Object.freeze({
    get size() { return set.size; },
    has: (value: string) => set.has(value),
    entries: () => set.entries(),
    keys: () => set.keys(),
    values: () => set.values(),
    [Symbol.iterator]: () => set[Symbol.iterator](),
    [Symbol.toStringTag]: 'Set',
    union: <U>(other: ReadonlySetLike<U>) => set.union(other),
    intersection: <U>(other: ReadonlySetLike<U>) => set.intersection(other),
    difference: <U>(other: ReadonlySetLike<U>) => set.difference(other),
    symmetricDifference: <U>(other: ReadonlySetLike<U>) => set.symmetricDifference(other),
    isSubsetOf: (other: ReadonlySetLike<unknown>) => set.isSubsetOf(other),
    isSupersetOf: (other: ReadonlySetLike<unknown>) => set.isSupersetOf(other),
    isDisjointFrom: (other: ReadonlySetLike<unknown>) => set.isDisjointFrom(other),
    forEach: (callback: (value: string, value2: string, set: ReadonlySet<string>) => void, thisArg?: unknown) => {
      set.forEach(value => callback.call(thisArg, value, value, view));
    },
  });
  return view;
}

function owned(lifetime: Lifetime): boolean {
  if (!lifetime.active) return false;
  const { owner, userId, sessionId, isCurrentOwner } = lifetime.seed;
  let current = false;
  try { current = !!owner && typeof owner === 'object' && stable(userId) && stable(sessionId) && isCurrentOwner() === true; }
  catch { /* An unavailable owner predicate cannot grant authority. */ }
  if (!current) lifetime.active = false;
  // The caller's current-owner read may itself synchronously retire this epoch.
  return current && lifetime.active;
}

function receipt(snapshot: Snapshot): StudioVoiceTranscriptProvenance {
  const { lifetime } = snapshot;
  const result = {} as StudioVoiceTranscriptProvenance;
  const fields = {
    [brand]: true, epoch: lifetime.epoch, owner: lifetime.seed.owner,
    userId: lifetime.seed.userId, sessionId: lifetime.seed.sessionId,
    live: readonlySet(snapshot.live), restored: readonlySet(snapshot.restored), ephemeral: readonlySet(snapshot.ephemeral),
    isCurrent: () => owned(lifetime) && snapshot.ready && !Array.from(snapshot.live).some(id => lifetime.veto.has(id)),
    retire: () => { lifetime.active = false; },
    // Accidental inclusion as an object property must not serialize private IDs.
    toJSON: () => undefined,
  };
  for (const key of Reflect.ownKeys(fields)) Object.defineProperty(result, key, { value: Reflect.get(fields, key) });
  snapshots.set(result, snapshot);
  return Object.freeze(result);
}

/** New lifetime for initial cache/clear/auth/session/restore. No speech policy yet. */
export function createStudioVoiceTranscriptProvenance(seed: StudioVoiceTranscriptSeed): StudioVoiceTranscriptProvenance {
  const restored = union(ids(seed.cachedMessages), ids(seed.priorVisibleMessages));
  const ephemeral = union(seed.ephemeralIds, ephemeralIds(seed.cachedMessages), ephemeralIds(seed.priorVisibleMessages));
  const lifetime: Lifetime = { epoch: Object.freeze({}), seed: { ...seed }, active: true, veto: union(restored, ephemeral) };
  return receipt({ lifetime, ready: false, live: new Set(), restored, ephemeral, observed: union(restored, ephemeral) });
}

/** Complete only a newly created restore lifetime; union every accepted source. */
export function completeStudioVoiceTranscriptRestore(
  previous: StudioVoiceTranscriptProvenance,
  input: StudioVoiceTranscriptRestoreAdmission,
): StudioVoiceTranscriptProvenance {
  const prev = snapshots.get(previous);
  if (!prev) throw new TypeError('Unknown private voice transcript receipt');
  if (prev.ready) { previous.retire(); return previous; }
  if (input.ownershipAdmitted !== true || !owned(prev.lifetime)) return previous;
  const messages = [...input.historicalMessages, ...input.cachedMessages, ...input.priorVisibleMessages, ...input.acceptedMessages];
  const restored = union(prev.restored, ids(messages));
  const ephemeral = union(prev.ephemeral, input.ephemeralIds, ephemeralIds(messages));
  for (const id of union(restored, ephemeral)) prev.lifetime.veto.add(id);
  return receipt({ lifetime: prev.lifetime, ready: true, live: new Set(), restored, ephemeral, observed: union(prev.observed, restored, ephemeral) });
}

/** Call inside the same actual reducer update as its unique append, never onMessage. */
export function admitStudioVoiceTranscriptFrame(
  previous: StudioVoiceTranscriptProvenance,
  input: StudioVoiceTranscriptFrameAdmission,
): StudioVoiceTranscriptProvenance {
  const prev = snapshots.get(previous);
  if (!prev) throw new TypeError('Unknown private voice transcript receipt');
  if (input.ownershipAdmitted !== true || !owned(prev.lifetime)) return previous;
  const { frame, admittedMessage: admitted, beforeMessages: before, afterMessages: after } = input;
  const sameSession = frame.session_id === prev.lifetime.seed.sessionId && admitted.session_id === prev.lifetime.seed.sessionId;
  if (!sameSession) return previous;
  const ephemeral = union(prev.ephemeral, input.ephemeralIds, ephemeralIds([frame, admitted]));
  for (const id of ephemeral) prev.lifetime.veto.add(id);
  // Before-state IDs were visible before this ingress, never newly live proof.
  const restored = union(prev.restored, ids(before).filter(id => !prev.observed.has(id)));
  for (const id of restored) prev.lifetime.veto.add(id);
  const live = union(Array.from(prev.live).filter(id => !prev.lifetime.veto.has(id)));
  const id = admitted.message_id;
  const appended = input.reducerAppended === true && stable(id) && frame.message_id === id
    && after.length === before.length + 1 && after[after.length - 1] === admitted
    && before.every((message, index) => after[index] === message)
    && !before.some(message => message.message_id === id)
    && after.filter(message => message.message_id === id).length === 1;
  if (appended && frame.type === 'chat_message' && admitted.type === 'chat_message'
    && input.assistantAdmitted === true && (frame.role === undefined || frame.role === 'assistant')
    && (admitted.role === undefined || admitted.role === 'assistant')
    && !prev.observed.has(id) && !prev.lifetime.veto.has(id)) live.add(id);
  return receipt({ lifetime: prev.lifetime, ready: prev.ready || appended,
    live, restored, ephemeral, observed: union(prev.observed, ids(before), ids(after), ephemeral) });
}
