import { useState, useCallback } from 'react';

export interface ChatSession {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  currentStage: number;
  strawmanPreviewUrl: string | null;
  finalPresentationUrl: string | null;
  strawmanPresentationId: string | null;
  finalPresentationId: string | null;
  slideCount: number | null;
  status: string;
  isFavorite: boolean;
  messages?: ChatMessage[];
  stateCache?: {
    currentStatus: any;
    slideStructure: any;
  } | null;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  messageType: string;
  timestamp: string;
  payload: any;
  userText: string | null;
}

export interface SessionListItem extends ChatSession {
  messages: ChatMessage[]; // Last message for preview
}

export interface SessionsResponse {
  sessions: SessionListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export function useChatSessions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load list of user's sessions
   */
  const loadSessions = useCallback(async (options?: {
    limit?: number;
    offset?: number;
    status?: 'active' | 'archived' | 'deleted';
  }): Promise<SessionsResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      if (options?.status) params.append('status', options.status);

      const response = await fetch(`/api/sessions?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to load sessions: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error('Error loading sessions:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load a specific session with all messages
   */
  const loadSession = useCallback(async (sessionId: string): Promise<ChatSession | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`);

      if (!response.ok) {
        // Handle deleted sessions specifically
        if (response.status === 410) {
          console.warn('⚠️ Session has been deleted:', sessionId);
          throw new Error('Session has been deleted');
        }
        throw new Error(`Failed to load session: ${response.statusText}`);
      }

      const data = await response.json();

      // Additional validation: Check status field
      if (data.session?.status === 'deleted') {
        console.warn('⚠️ Session marked as deleted in response:', sessionId);
        return null;
      }

      return data.session;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error('Error loading session:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new session
   */
  const createSession = useCallback(async (
    sessionId: string,
    title?: string
  ): Promise<ChatSession | null> => {
    setLoading(true);
    setError(null);

    try {
      console.log('[useChatSessions] Creating session:', sessionId);

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, title }),
      });

      console.log('[useChatSessions] Response status:', response.status);

      if (!response.ok) {
        // If conflict (409), session already exists - that's ok
        if (response.status === 409) {
          console.log('[useChatSessions] Session already exists (409)');
          const data = await response.json();
          return data.session;
        }

        // Try to get error details from response
        let errorMessage = response.statusText;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error('[useChatSessions] API error:', errorMessage, 'Status:', response.status);
        } catch {
          console.error('[useChatSessions] Failed with status:', response.status, response.statusText);
        }

        throw new Error(`Failed to create session (${response.status}): ${errorMessage}`);
      }

      const data = await response.json();
      console.log('[useChatSessions] Session created successfully:', data.session?.id);
      return data.session;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error('[useChatSessions] Error creating session:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update session metadata
   */
  const updateSession = useCallback(async (
    sessionId: string,
    updates: Partial<Omit<ChatSession, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<ChatSession | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update session: ${response.statusText}`);
      }

      const data = await response.json();
      return data.session;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error('Error updating session:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete session (soft delete)
   */
  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.statusText}`);
      }

      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error('Error deleting session:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Save messages in batch
   */
  const saveMessages = useCallback(async (
    sessionId: string,
    messages: Array<{
      id: string;
      messageType: string;
      timestamp: Date | string;
      payload: any;
      userText?: string;
    }>
  ): Promise<{ saved: number; failed: number; total: number } | null> => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`❌ Message save failed: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to save messages: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      console.error('Error saving messages:', error);
      return null;
    }
  }, []);

  return {
    loading,
    error,
    loadSessions,
    loadSession,
    createSession,
    updateSession,
    deleteSession,
    saveMessages,
  };
}
