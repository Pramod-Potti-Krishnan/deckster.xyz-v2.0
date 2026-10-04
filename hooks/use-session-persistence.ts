import { useEffect, useRef, useCallback } from 'react';
import { useChatSessions } from './use-chat-sessions';
import { DirectorMessage } from './use-deckster-websocket-v2';
import { useSessionCache } from './use-session-cache';
import { debugLog } from '@/lib/debug-log';
import { DirectorChatSaveQueue } from '@/lib/director-chat-history';

type PersistableDirectorMessage = Exclude<DirectorMessage, { type: 'token_usage' }>;

function isPersistableMessage(message: DirectorMessage): message is PersistableDirectorMessage {
  return message.type !== 'token_usage' && message.type !== 'build_control_capability';
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

  const queueMessage = useCallback((message: DirectorMessage, userText?: string) => {
    if (!isPersistableMessage(message) || !enabledRef.current) return;
    const currentSessionId = sessionIdRef.current;
    const ownerUserId = userIdRef.current;
    if (!currentSessionId || !ownerUserId || message.session_id !== currentSessionId) return;

    sessionCache.appendMessage(message, userText);
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
  }, [debounceMs, flushMessages, sessionCache]);

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
  const updateMetadata = useCallback(async (updates: {
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
  }) => {
    // FIX 8: Use ref instead of closure value
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) {
      console.warn('⚠️ updateMetadata skipped - no sessionId');
      return;
    }

    try {
      const normalizedUpdates = {
        ...updates,
        lastMessageAt: updates.lastMessageAt instanceof Date
          ? updates.lastMessageAt.toISOString()
          : updates.lastMessageAt,
      };
      debugLog('📝 Updating session metadata:', normalizedUpdates);
      await updateSession(currentSessionId, normalizedUpdates);
    } catch (error) {
      console.error('❌ Error updating session metadata:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  }, [updateSession, onError]);  // FIX 8: Remove 'enabled' and 'sessionId' from deps

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
    generateTitle,
    pendingCount: messageQueueRef.current.size(userIdRef.current),
  };
}
