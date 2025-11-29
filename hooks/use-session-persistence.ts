import { useEffect, useRef, useCallback } from 'react';
import { useChatSessions, ChatMessage } from './use-chat-sessions';
import { DirectorMessage } from './use-deckster-websocket-v2';
import { useSessionCache } from './use-session-cache';

export interface SessionPersistenceOptions {
  sessionId: string;
  enabled?: boolean;
  debounceMs?: number; // Debounce for bot messages (default: 3000ms)
  onError?: (error: Error) => void;
}

export function useSessionPersistence(options: SessionPersistenceOptions) {
  const { sessionId, enabled = true, debounceMs = 3000, onError } = options;
  const { saveMessages, updateSession } = useChatSessions();

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
   */
  const flushMessages = useCallback(async () => {
    if (messageQueueRef.current.size === 0 || isSavingRef.current) {
      if (messageQueueRef.current.size === 0) {
        console.log('✅ No messages to flush (queue empty)');
      } else {
        console.log('⏳ Already saving messages, skipping duplicate flush');
      }
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

      const result = await saveMessages(sessionId, messages);

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
  }, [sessionId, saveMessages, onError]);

  /**
   * Add a message to the save queue
   */
  const queueMessage = useCallback((message: DirectorMessage, userText?: string) => {
    if (!enabled) return;

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
      userText: userText || null,
    });

    // For user messages, flush immediately
    if (message.type === 'user' || userText) {
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
  }, [enabled, debounceMs, flushMessages, sessionCache]);

  /**
   * Save a batch of messages
   * FIXED: Now accepts optional userText parameter to save user messages correctly
   */
  const saveBatch = useCallback(async (messages: DirectorMessage[], userText?: string) => {
    if (!enabled || messages.length === 0) return;

    try {
      // STEP 1: Write to browser cache FIRST (synchronous)
      if (userText && messages.length > 0) {
        sessionCache.appendMessage(messages[0], userText);
      }

      // STEP 2: Format messages for DB save
      const formattedMessages = messages.map(msg => ({
        id: msg.message_id,
        messageType: msg.type,
        timestamp: msg.timestamp,
        payload: msg.payload,
        userText: userText || null, // FIXED: Use provided userText instead of hardcoded null
      }));

      console.log(`💾 Batch saving ${formattedMessages.length} messages`);
      console.log(`📝 userText parameter:`, userText ? `"${userText.substring(0, 50)}..."` : 'NULL');
      console.log(`📝 First message userText field:`, formattedMessages[0]?.userText ? `"${formattedMessages[0].userText.substring(0, 30)}..."` : 'NULL');
      const result = await saveMessages(sessionId, formattedMessages);

      if (result) {
        console.log(`✅ Batch saved ${result.saved}/${result.total} messages`);
      }
    } catch (error) {
      console.error('❌ Error batch saving messages:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  }, [enabled, sessionId, saveMessages, onError, sessionCache]);

  /**
   * Update session metadata
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
    if (!enabled) return;

    try {
      console.log('📝 Updating session metadata:', updates);
      await updateSession(sessionId, updates);
    } catch (error) {
      console.error('❌ Error updating session metadata:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  }, [enabled, sessionId, updateSession, onError]);

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

  // Flush on window beforeunload
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      // Synchronous flush attempt
      if (messageQueueRef.current.size > 0) {
        console.log(`🚨 beforeunload: Attempting to save ${messageQueueRef.current.size} pending messages via sendBeacon`);

        // Use sendBeacon API for synchronous last-ditch save
        const messages = Array.from(messageQueueRef.current.values());
        const blob = new Blob([JSON.stringify({ messages })], {
          type: 'application/json',
        });

        // Best effort - may or may not work depending on browser
        const success = navigator.sendBeacon(`/api/sessions/${sessionId}/messages`, blob);
        console.log(`🚨 sendBeacon ${success ? 'succeeded' : 'failed'} for ${messages.length} messages`);
      } else {
        console.log('✅ beforeunload: No pending messages to save');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, sessionId]);

  return {
    queueMessage,
    saveBatch,
    flushMessages,
    updateMetadata,
    generateTitle,
    pendingCount: messageQueueRef.current.size,
  };
}
