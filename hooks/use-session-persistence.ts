import { useEffect, useRef, useCallback } from 'react';
import { useChatSessions, ChatMessage } from './use-chat-sessions';
import { DirectorMessage } from './use-deckster-websocket-v2';
import { useSessionCache } from './use-session-cache';

type PersistableDirectorMessage = Exclude<DirectorMessage, { type: 'token_usage' }>;

function isPersistableMessage(message: DirectorMessage): message is PersistableDirectorMessage {
  return message.type !== 'token_usage';
}

export interface SessionPersistenceOptions {
  sessionId: string;
  enabled?: boolean;
  debounceMs?: number; // Debounce for bot messages (default: 3000ms)
  onError?: (error: Error) => void;
}

export function useSessionPersistence(options: SessionPersistenceOptions) {
  const { sessionId, enabled = true, debounceMs = 3000, onError } = options;
  const { saveMessages, updateSession } = useChatSessions();

  // FIX 8: Use ref for sessionId to avoid stale closure issues
  // Same pattern as Fix 7 in use-session-cache.ts
  const sessionIdRef = useRef(sessionId);

  // FIX 8: Update ref SYNCHRONOUSLY during render, not in useEffect
  // This ensures callbacks always have the latest sessionId
  if (sessionIdRef.current !== sessionId && sessionId) {
    console.log(`🔄 [Persistence] Session ID updated: ${sessionIdRef.current || '(empty)'} → ${sessionId}`);
    sessionIdRef.current = sessionId;
  }

  // Initialize browser cache
  const sessionCache = useSessionCache({
    sessionId,
    enabled,
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  });

  // Queue of pending messages to save
  const messageQueueRef = useRef<Map<string, any>>(new Map());
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isSavingRef = useRef(false);

  /**
   * Flush all pending messages to database
   * FIX 8: Uses sessionIdRef.current to avoid stale closure
   */
  const flushMessages = useCallback(async () => {
    // FIX 8: Use ref instead of closure value
    const currentSessionId = sessionIdRef.current;

    if (messageQueueRef.current.size === 0 || isSavingRef.current) {
      if (messageQueueRef.current.size === 0) {
        console.log('✅ No messages to flush (queue empty)');
      } else {
        console.log('⏳ Already saving messages, skipping duplicate flush');
      }
      return;
    }

    if (!currentSessionId) {
      console.warn('⚠️ flushMessages skipped - no sessionId');
      return;
    }

    isSavingRef.current = true;

    try {
      const messages = Array.from(messageQueueRef.current.values());
      console.log(`💾 Flushing ${messages.length} messages to database:`, messages.map(m => ({
        id: m.id,
        type: m.messageType,
        hasUserText: !!m.userText,
        userTextPreview: m.userText ? m.userText.substring(0, 30) : null
      })));

      const result = await saveMessages(currentSessionId, messages);

      if (result) {
        console.log(`✅ Successfully saved ${result.saved}/${result.total} messages to database`);
        // Clear successfully saved messages
        messageQueueRef.current.clear();
        console.log('🗑️ Message queue cleared');
      } else {
        console.error('❌ FAILED to save messages to database - check authentication and network');
        if (onError) {
          onError(new Error('Failed to save messages - check authentication'));
        }
      }
    } catch (error) {
      console.error('❌ Error flushing messages:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [saveMessages, onError]);  // FIX 8: Remove sessionId from deps

  /**
   * Add a message to the save queue
   * FIX 8: Uses sessionIdRef to avoid stale closure
   */
  const queueMessage = useCallback((message: DirectorMessage, userText?: string) => {
    if (!isPersistableMessage(message)) {
      console.log('⏭️ queueMessage skipped - token usage is cached in session state');
      return;
    }

    // FIX 8: Check sessionIdRef instead of enabled flag
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) {
      console.warn('⚠️ queueMessage skipped - no sessionId');
      return;
    }

    console.log('📥 Queueing message:', {
      id: message.message_id,
      type: message.type,
      hasUserText: !!userText,
      userTextPreview: userText ? userText.substring(0, 30) : null,
      queueSize: messageQueueRef.current.size + 1
    });

    // STEP 1: Write to browser cache IMMEDIATELY (synchronous, no delay)
    sessionCache.appendMessage(message, userText);

    // STEP 2: Add to queue for DB save (using message_id as key for deduplication)
    messageQueueRef.current.set(message.message_id, {
      id: message.message_id,
      messageType: message.type,
      timestamp: message.timestamp,
      payload: message.payload,
      userText: userText || undefined,
    });

    // For user messages, flush immediately
    if (userText) {
      console.log('📤 User message detected - triggering immediate save');
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      flushMessages();
      return;
    }

    // For bot messages, debounce
    console.log(`⏱️ Bot message - scheduling flush in ${debounceMs}ms`);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      flushMessages();
    }, debounceMs);
  }, [debounceMs, flushMessages, sessionCache]);  // FIX 8: Remove 'enabled' from deps

  /**
   * Save a batch of messages
   * FIXED: Now accepts optional userText parameter to save user messages correctly
   * FIX 8: Uses sessionIdRef to avoid stale closure
   */
  const saveBatch = useCallback(async (messages: DirectorMessage[], userText?: string) => {
    // FIX 8: Use ref instead of closure value
    const currentSessionId = sessionIdRef.current;
    const persistableMessages = messages.filter(isPersistableMessage);

    if (!currentSessionId || persistableMessages.length === 0) {
      if (!currentSessionId) {
        console.warn('⚠️ saveBatch skipped - no sessionId');
      }
      return;
    }

    try {
      // STEP 1: Write to browser cache FIRST (synchronous)
      if (userText && persistableMessages.length > 0) {
        sessionCache.appendMessage(persistableMessages[0], userText);
      }

      // STEP 2: Format messages for DB save
      const formattedMessages = persistableMessages.map(msg => ({
        id: msg.message_id,
        messageType: msg.type,
        timestamp: msg.timestamp,
        payload: msg.payload,
        userText: userText || undefined, // FIXED: Use provided userText instead of hardcoded null
      }));

      console.log(`💾 Batch saving ${formattedMessages.length} messages to session ${currentSessionId}`);
      console.log(`📝 userText parameter:`, userText ? `"${userText.substring(0, 50)}..."` : 'NULL');
      console.log(`📝 First message userText field:`, formattedMessages[0]?.userText ? `"${formattedMessages[0].userText.substring(0, 30)}..."` : 'NULL');
      const result = await saveMessages(currentSessionId, formattedMessages);

      if (result) {
        console.log(`✅ Batch saved ${result.saved}/${result.total} messages`);
      }
    } catch (error) {
      console.error('❌ Error batch saving messages:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  }, [saveMessages, onError, sessionCache]);  // FIX 8: Remove 'enabled' and 'sessionId' from deps

  /**
   * Update session metadata
   * FIX 8: Uses sessionIdRef to avoid stale closure
   */
  const updateMetadata = useCallback(async (updates: {
    title?: string;
    currentStage?: number;
    strawmanPreviewUrl?: string;
    finalPresentationUrl?: string;
    strawmanPresentationId?: string;
    finalPresentationId?: string;
    slideCount?: number;
    lastMessageAt?: Date;
  }) => {
    // FIX 8: Use ref instead of closure value
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) {
      console.warn('⚠️ updateMetadata skipped - no sessionId');
      return;
    }

    try {
      console.log('📝 Updating session metadata:', updates);
      await updateSession(currentSessionId, updates);
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
      if (messageQueueRef.current.size > 0) {
        flushMessages();
      }
    };
  }, [flushMessages]);

  // Track enabled state via ref so beforeunload handler has current value
  const enabledRef = useRef(enabled);
  if (enabledRef.current !== enabled) enabledRef.current = enabled;

  // Flush on window beforeunload
  // FIX 8: Use sessionIdRef to get current session ID
  useEffect(() => {
    const handleBeforeUnload = () => {
      // FIX 8: Use ref instead of closure value
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId || !enabledRef.current) return;

      // Synchronous flush attempt
      if (messageQueueRef.current.size > 0) {
        console.log(`🚨 beforeunload: Attempting to save ${messageQueueRef.current.size} pending messages via sendBeacon`);

        // Use sendBeacon API for synchronous last-ditch save
        const messages = Array.from(messageQueueRef.current.values());
        const blob = new Blob([JSON.stringify({ messages })], {
          type: 'application/json',
        });

        // Best effort - may or may not work depending on browser
        const success = navigator.sendBeacon(`/api/sessions/${currentSessionId}/messages`, blob);
        console.log(`🚨 sendBeacon ${success ? 'succeeded' : 'failed'} for ${messages.length} messages`);
      } else {
        console.log('✅ beforeunload: No pending messages to save');
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
    pendingCount: messageQueueRef.current.size,
  };
}
