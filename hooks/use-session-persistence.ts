import { useEffect, useRef, useCallback } from 'react';
import { useChatSessions } from './use-chat-sessions';
import { DirectorMessage } from './use-deckster-websocket-v2';
import { useSessionCache } from './use-session-cache';
import { debugLog } from '@/lib/debug-log';
import { DirectorChatSaveQueue } from '@/lib/director-chat-history';
import { STUDIO_SESSION_HYGIENE_ENABLED, deferMetadata, takeDeferredMetadata, type DeferredMetadata } from '@/lib/studio-session-hygiene';
import { STUDIO_SESSION_OPEN_READ_ONLY_ENABLED, beginOpenQuiet, isOpenQuiet, openQuietHoldMessage, openQuietMetadata, releaseOpenQuiet, type OpenQuiet, type OpenQuietHeld } from '@/lib/studio-open-read-only';

type PersistableDirectorMessage = Exclude<DirectorMessage, { type: 'token_usage' }>;

function isPersistableMessage(message: DirectorMessage): message is PersistableDirectorMessage {
  return message.type !== 'token_usage' && message.type !== 'build_control_capability';
}

export interface SessionMetadataUpdates {
  title?: string;
  currentStage?: number;
  blankPresentationUrl?: string;
  strawmanPreviewUrl?: string;
  finalPresentationUrl?: string;
  blankPresentationId?: string;
  strawmanPresentationId?: string;
  finalPresentationId?: string;
  slideCount?: number;
  lastMessageAt?: Date | string;
  stateCache?: {
    currentStatus?: unknown;
    slideStructure?: unknown;
    activeVersion?: 'blank' | 'strawman' | 'final';
  };
}

/** NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: `passive` marks a write that Director's frames or the page's own reconcile make on their own (see lib/studio-open-read-only.ts). Ignored with the flag off. */
export interface SessionWriteOptions {
  passive?: boolean;
}

export interface SessionPersistenceOptions {
  sessionId: string;
  userId: string;
  enabled?: boolean;
  debounceMs?: number; // Debounce for bot messages (default: 3000ms)
  onError?: (error: Error) => void;
}

export function useSessionPersistence(options: SessionPersistenceOptions) {
  const { sessionId, userId, enabled = true, debounceMs = 3000, onError } = options;
  const { saveMessages, updateSession } = useChatSessions();

  // Read current authorization synchronously, but retain the original owner and
  // session on each queued row. Navigation must not move pending rows to a new chat.
  const sessionIdRef = useRef(sessionId);
  const userIdRef = useRef(userId);
  const enabledRef = useRef(enabled);
  const onErrorRef = useRef(onError);
  sessionIdRef.current = sessionId;
  userIdRef.current = userId;
  enabledRef.current = enabled;
  onErrorRef.current = onError;

  const sessionCache = useSessionCache({ sessionId, userId, enabled, ttl: 24 * 60 * 60 * 1000 });
  const messageQueueRef = useRef(new DirectorChatSaveQueue());
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const activeSaveRef = useRef<Promise<void> | null>(null);
  // NEXT_PUBLIC_STUDIO_SESSION_HYGIENE: blank-deck metadata Director sent while the session had no row (see sendDeferredMetadata).
  const deferredMetadataRef = useRef<DeferredMetadata<SessionMetadataUpdates> | null>(null);
  // NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: set by beginOpenQuiet when an existing session's row has been opened; see lib/studio-open-read-only.ts.
  const openQuietRef = useRef<OpenQuiet | null>(null);

  const flushMessages = useCallback((): Promise<void> => {
    if (!enabledRef.current || !userIdRef.current) return Promise.resolve();
    if (activeSaveRef.current) return activeSaveRef.current;
    const ownerUserId = userIdRef.current;
    if (messageQueueRef.current.size(ownerUserId) === 0) return Promise.resolve();
    const save = (async () => {
      const refusedSessions = new Set<string>();
      try {
        // Drain successful snapshots, including arrivals during an in-flight save.
        // A refused/partial batch remains queued and awaits the next explicit
        // flush or message. Other conversations can still save their own rows.
        while (enabledRef.current && userIdRef.current === ownerUserId) {
          const snapshot = messageQueueRef.current.snapshots(ownerUserId)
            .find(batch => !refusedSessions.has(batch.sessionId));
          if (!snapshot) break;
          const result = await saveMessages(snapshot.sessionId, snapshot.messages);
          if (!messageQueueRef.current.acknowledge(snapshot, result)) {
            onErrorRef.current?.(new Error('Chat history could not be completely saved. Pending messages were retained for retry.'));
            refusedSessions.add(snapshot.sessionId);
            continue;
          }
          debugLog(`✅ Saved ${snapshot.messages.length} messages to their original session`);
        }
      } catch (error) {
        console.error('❌ Error flushing messages:', error);
        onErrorRef.current?.(error instanceof Error ? error : new Error('Unknown error'));
      } finally {
        activeSaveRef.current = null;
        // A new account may have queued its own first turn while the previous
        // account's already-dispatched request was finishing. Resume only that
        // current owner's queue, never the previous owner's refused rows.
        if (enabledRef.current && userIdRef.current !== ownerUserId && messageQueueRef.current.size(userIdRef.current) > 0) {
          saveTimeoutRef.current = setTimeout(() => { void flushMessages(); }, 0);
        }
      }
    })();
    activeSaveRef.current = save;
    return save;
  }, [saveMessages]);

  // NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: the first action in an opened session ends its quiet period; what was held goes into the save queue first, in order.
  const enqueueHeld = useCallback((held: OpenQuietHeld[], ownerUserId: string, sessionId: string) => {
    for (const { message, userText } of held) {
      const m = message as PersistableDirectorMessage;
      messageQueueRef.current.enqueue(ownerUserId, sessionId, {
        id: m.message_id,
        messageType: m.type,
        timestamp: m.timestamp,
        payload: m.payload,
        userText: userText || undefined,
      });
    }
  }, []);

  const queueMessage = useCallback((message: DirectorMessage, userText?: string, options?: SessionWriteOptions) => {
    if (!isPersistableMessage(message) || !enabledRef.current) return;
    const currentSessionId = sessionIdRef.current;
    const ownerUserId = userIdRef.current;
    if (!currentSessionId || !ownerUserId || message.session_id !== currentSessionId) return;

    sessionCache.appendMessage(message, userText);
    if (STUDIO_SESSION_OPEN_READ_ONLY_ENABLED && openQuietRef.current && isOpenQuiet(openQuietRef.current, currentSessionId)) {
      if (options?.passive) {
        if (openQuietHoldMessage(openQuietRef.current, currentSessionId, message, userText)) return;
      } else {
        enqueueHeld(releaseOpenQuiet(openQuietRef.current), ownerUserId, currentSessionId);
      }
    }
    messageQueueRef.current.enqueue(ownerUserId, currentSessionId, {
      id: message.message_id,
      messageType: message.type,
      timestamp: message.timestamp,
      payload: message.payload,
      userText: userText || undefined,
    });

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (userText) {
      void flushMessages();
    } else {
      saveTimeoutRef.current = setTimeout(() => { void flushMessages(); }, debounceMs);
    }
  }, [debounceMs, enqueueHeld, flushMessages, sessionCache]);

  const saveBatch = useCallback(async (messages: DirectorMessage[], userText?: string) => {
    for (const message of messages) queueMessage(message, userText);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    await flushMessages();
  }, [queueMessage, flushMessages]);

  // Previously refused saves and another same-owner session's pending rows stay
  // available when persistence becomes enabled again. Account changes never
  // send the previous account's queue under the new account's authentication.
  useEffect(() => {
    if (enabled && userId && messageQueueRef.current.size(userId) > 0) void flushMessages();
  }, [enabled, userId, sessionId, flushMessages]);

  /**
   * Update session metadata
   * FIX 8: Uses sessionIdRef to avoid stale closure
   */
  const updateMetadata = useCallback(async (updates: SessionMetadataUpdates, options?: SessionWriteOptions) => {
    // FIX 8: Use ref instead of closure value
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) {
      console.warn('⚠️ updateMetadata skipped - no sessionId');
      return;
    }

    // NEXT_PUBLIC_STUDIO_SESSION_HYGIENE: an unsaved local session (bare /builder, ?session_id=new, a reload of either) has no
    // history row, and `enabled` is false for it. queueMessage and flushMessages already honour that; this was the one writer
    // that did not. Director's blank-deck frame (presentation_init) reaches here through the page's onSessionStateChange, and a
    // PATCH for a row that does not exist 404s, retries, then updateSession's recovery POSTs the row: an empty "Untitled Session".
    // The row is created by the first real action (first message, an upload, a hand-off), after which `enabled` is true.
    if (STUDIO_SESSION_HYGIENE_ENABLED && !enabledRef.current) {
      debugLog('[SESSION-HYGIENE] updateMetadata skipped - session is unsaved, no history row yet:', currentSessionId);
      // Nothing is written, but the blank deck's URL/id must not be lost if the user's first click on the canvas saves the
      // row: it is kept (newest wins, per session) and sent once by sendDeferredMetadata.
      deferredMetadataRef.current = deferMetadata(deferredMetadataRef.current, currentSessionId, updates);
      return;
    }

    // NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: an opened session is read-only until the user acts. A passive write (Director's state frames, the Layout count reconcile) sends only what
    // is new, and never lastMessageAt; any other write is the user's and ends the quiet period.
    let effective = updates;
    if (STUDIO_SESSION_OPEN_READ_ONLY_ENABLED && openQuietRef.current && isOpenQuiet(openQuietRef.current, currentSessionId)) {
      if (options?.passive) {
        const trimmed = openQuietMetadata(openQuietRef.current, updates as Record<string, unknown>);
        if (!trimmed) {
          debugLog('[OPEN-READ-ONLY] passive metadata write skipped - nothing new for the opened session:', currentSessionId);
          return;
        }
        effective = trimmed as SessionMetadataUpdates;
      } else {
        const held = releaseOpenQuiet(openQuietRef.current);
        const ownerUserId = userIdRef.current;
        if (held.length > 0 && ownerUserId) {
          enqueueHeld(held, ownerUserId, currentSessionId);
          void flushMessages();
        }
      }
    }

    try {
      const normalizedUpdates = {
        ...effective,
        lastMessageAt: effective.lastMessageAt instanceof Date
          ? effective.lastMessageAt.toISOString()
          : effective.lastMessageAt,
      };
      debugLog('📝 Updating session metadata:', normalizedUpdates);
      await updateSession(currentSessionId, normalizedUpdates);
    } catch (error) {
      console.error('❌ Error updating session metadata:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  }, [updateSession, onError, enqueueHeld, flushMessages]);  // FIX 8: Remove 'enabled' and 'sessionId' from deps

  /**
   * NEXT_PUBLIC_STUDIO_SESSION_HYGIENE: send, once, the metadata that updateMetadata held back while the session had no row.
   * Called by hooks/use-save-session-on-first-action.ts right after the first user action created the row. It cannot go through
   * updateMetadata's own gate: `enabled` only turns true on the next render, and this runs in the same tick as the POST. The
   * PATCH is the same one updateMetadata sends (same normalisation, same updateSession). Held data for another session is left
   * alone (a new chat replaces it); with the flag off nothing is ever held.
   */
  const sendDeferredMetadata = useCallback(async (forSessionId: string) => {
    if (!STUDIO_SESSION_HYGIENE_ENABLED) return;
    const held = takeDeferredMetadata(deferredMetadataRef.current, forSessionId);
    if (!held) return;
    deferredMetadataRef.current = null;
    try {
      const normalizedUpdates = {
        ...held,
        lastMessageAt: held.lastMessageAt instanceof Date
          ? held.lastMessageAt.toISOString()
          : held.lastMessageAt,
      };
      debugLog('📝 [SESSION-HYGIENE] Sending the blank-deck metadata held while the session was unsaved:', normalizedUpdates);
      await updateSession(forSessionId, normalizedUpdates);
    } catch (error) {
      console.error('❌ Error updating session metadata:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  }, [updateSession, onError]);

  /** NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: an existing session's row has just been opened; it is quiet until the user acts (lib/studio-open-read-only.ts). Flag off: does nothing. */
  const beginOpenQuietFor = useCallback((forSessionId: string, row: unknown) => {
    if (!STUDIO_SESSION_OPEN_READ_ONLY_ENABLED || !forSessionId) return;
    openQuietRef.current = beginOpenQuiet(forSessionId, row);
  }, []);

  /**
   * Generate title from first user message or presentation metadata
   */
  const generateTitle = useCallback((
    firstUserMessage?: string,
    presentationTitle?: string
  ): string => {
    if (presentationTitle) {
      return presentationTitle;
    }

    if (firstUserMessage) {
      // Truncate to 50 characters
      return firstUserMessage.length > 50
        ? firstUserMessage.substring(0, 50) + '...'
        : firstUserMessage;
    }

    // Fallback
    const now = new Date();
    return `Session - ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  }, []);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Flush any pending messages
      if (messageQueueRef.current.size(userIdRef.current) > 0) {
        flushMessages();
      }
    };
  }, [flushMessages]);

  // Flush on window beforeunload
  // FIX 8: Use sessionIdRef to get current session ID
  useEffect(() => {
    const handleBeforeUnload = () => {
      // FIX 8: Use ref instead of closure value
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId || !enabledRef.current) return;

      // Synchronous flush attempt
      if (messageQueueRef.current.size(userIdRef.current) > 0) {
        debugLog(`🚨 beforeunload: Attempting to save ${messageQueueRef.current.size(userIdRef.current)} pending messages via sendBeacon`);

        // Each last-ditch batch goes to its original session for the current
        // account only; another account's pending rows are never transmitted.
        for (const snapshot of messageQueueRef.current.snapshots(userIdRef.current)) {
          const blob = new Blob([JSON.stringify({ messages: snapshot.messages })], {
            type: 'application/json',
          });
          navigator.sendBeacon(`/api/sessions/${snapshot.sessionId}/messages`, blob);
        }
      } else {
        debugLog('✅ beforeunload: No pending messages to save');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);  // FIX 8: No deps needed - uses ref

  return {
    queueMessage,
    saveBatch,
    flushMessages,
    updateMetadata,
    sendDeferredMetadata,
    beginOpenQuiet: beginOpenQuietFor,
    generateTitle,
    pendingCount: messageQueueRef.current.size(userIdRef.current),
  };
}
