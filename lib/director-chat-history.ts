interface TranscriptMessage {
  message_id: string;
  session_id: string;
  type: string;
}

/** Restore a DB snapshot without losing newer messages from the same session.
 * Sources run oldest-to-newest; replayed action cards keep their exact IDs and
 * the in-memory card wins over an older persisted version of that ID.
 */
export function mergeDirectorChatHistory<T extends TranscriptMessage>(
  sessionId: string,
  ...sources: ReadonlyArray<readonly T[]>
): T[] {
  const messages = new Map<string, T>();
  for (const source of sources) {
    for (const message of source) {
      if (message.session_id !== sessionId || message.type === 'build_control_capability') continue;
      messages.set(message.message_id, message);
    }
  }
  return Array.from(messages.values());
}

/** Director's naive ISO history timestamps are UTC, as are explicit ISO zones. */
export function directorHistoryTimestamp(timestamp: unknown): number {
  if (typeof timestamp !== 'string' || timestamp.trim().length === 0) return NaN;
  const value = timestamp.trim();
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
  return Date.parse(normalized);
}

/** Match each local user turn to at most one Director replay. A different-ID
 * replay is an echo only when exact text and finite event timestamps agree.
 * Equal prose alone cannot identify an older or newer user turn.
 */
export function missingDirectorUserTurns<T extends TranscriptMessage & {
  role?: string;
  payload?: unknown;
  content?: string;
  timestamp?: string;
}>(sessionId: string, messages: readonly T[], local: readonly { id: string; text: string; timestamp?: number }[]): T[] {
  const replay = messages.filter(message => message.session_id === sessionId && message.role === 'user');
  const matchedLocal = new Set<number>();
  const matchedReplay = new Set<string>();
  // Reserve exact matches first; an earlier content match must not steal a
  // later turn whose ID already identifies its corresponding local record.
  for (const message of replay) {
    const index = local.findIndex((turn, i) => !matchedLocal.has(i) && turn.id === message.message_id);
    if (index >= 0) {
      matchedLocal.add(index);
      matchedReplay.add(message.message_id);
    }
  }
  return replay.filter(message => {
    if (matchedReplay.has(message.message_id)) return false;
    const text = (message.payload as { text?: string } | undefined)?.text || message.content || '';
    const timestamp = directorHistoryTimestamp(message.timestamp);
    if (!Number.isFinite(timestamp)) return true;
    const index = local.findIndex((turn, i) => !matchedLocal.has(i)
      && turn.text === text
      && Number.isFinite(turn.timestamp)
      && turn.timestamp === timestamp);
    if (index < 0) return true;
    matchedLocal.add(index);
    return false;
  });
}

export interface PersistedChatMessage {
  id: string;
  messageType: string;
  timestamp: string;
  payload: unknown;
  userText?: string;
}

export interface ChatSaveResult {
  saved: number;
  failed: number;
  total: number;
}

export interface ChatSaveSnapshot {
  ownerUserId: string;
  sessionId: string;
  messages: PersistedChatMessage[];
}

/** Pending saves retain the owner/session captured at enqueue time. */
export class DirectorChatSaveQueue {
  private pending = new Map<string, {
    ownerUserId: string;
    sessionId: string;
    message: PersistedChatMessage;
  }>();

  enqueue(ownerUserId: string, sessionId: string, message: PersistedChatMessage): void {
    this.pending.set(JSON.stringify([ownerUserId, sessionId, message.id]), { ownerUserId, sessionId, message });
  }

  snapshots(ownerUserId: string): ChatSaveSnapshot[] {
    const groups = new Map<string, ChatSaveSnapshot>();
    for (const item of this.pending.values()) {
      if (item.ownerUserId !== ownerUserId) continue;
      let group = groups.get(item.sessionId);
      if (!group) {
        group = { ownerUserId, sessionId: item.sessionId, messages: [] };
        groups.set(item.sessionId, group);
      }
      group.messages.push(item.message);
    }
    return Array.from(groups.values());
  }

  acknowledge(snapshot: ChatSaveSnapshot, result: ChatSaveResult | null): boolean {
    // The API returns counts, not successful IDs. A partial batch must remain
    // intact for its idempotent upsert retry; guessing which rows saved loses data.
    if (!result || result.failed !== 0 || result.saved !== snapshot.messages.length || result.total !== snapshot.messages.length) return false;
    for (const message of snapshot.messages) {
      const key = JSON.stringify([snapshot.ownerUserId, snapshot.sessionId, message.id]);
      // A new frame with the same ID may have updated an action while saving.
      if (this.pending.get(key)?.message === message) this.pending.delete(key);
    }
    return true;
  }

  size(ownerUserId: string): number {
    return this.snapshots(ownerUserId).reduce((total, batch) => total + batch.messages.length, 0);
  }
}
