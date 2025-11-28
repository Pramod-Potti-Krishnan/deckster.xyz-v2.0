import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './use-auth';
import { useSessionCache, CachedSessionState } from './use-session-cache';

// Director v3.4 Message Types (Corrected - uses 'payload' not 'data')

export interface BaseMessage {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'chat_message' | 'action_request' | 'slide_update' | 'presentation_url' | 'status_update';
  payload: any;
}

export interface ChatMessage {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'chat_message';
  payload: {
    text: string;
    sub_title: string | null;
    list_items: string[] | null;
    format?: 'markdown' | 'text';
  };
}

export interface ActionRequest {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'action_request';
  payload: {
    prompt_text: string;
    actions: Array<{
      label: string;
      value: string;
      primary: boolean;
      requires_input: boolean;
    }>;
  };
}

export interface StatusUpdate {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'status_update';
  payload: {
    status: 'idle' | 'thinking' | 'generating' | 'complete' | 'error';
    text: string;
    progress: number | null;
    estimated_time: number | null;
  };
}

export interface PresentationURL {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'presentation_url';
  payload: {
    url: string;
    presentation_id: string;
    slide_count: number;
    message: string;
  };
}

export interface SlideUpdate {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'slide_update';
  payload: {
    operation: 'full_update' | 'partial_update';
    metadata: {
      main_title: string;
      overall_theme: string;
      design_suggestions: string;
      target_audience: string;
      presentation_duration: number;
      preview_url?: string;  // Strawman preview URL (may be in metadata)
    };
    slides: Array<{
      slide_id: string;
      slide_number: number;
      slide_type: string;
      title: string;
      narrative: string;
      key_points: string[];
      analytics_needed: string | null;
      visuals_needed: string | null;
      diagrams_needed: string | null;
      structure_preference: string | null;
    }>;
    affected_slides: string[] | null;
    preview_url?: string;  // Strawman preview URL (may be at payload root)
  };
}

export type DirectorMessage = ChatMessage | ActionRequest | SlideUpdate | PresentationURL | StatusUpdate;

// User message to send to server
export interface UserMessage {
  type: 'user_message';
  data: {
    text: string;
  };
}

// Hook state
export interface UseDecksterWebSocketV2State {
  connected: boolean;
  connecting: boolean;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  sessionId: string;
  userId: string;
  error: Error | null;
  messages: DirectorMessage[];
  // UPDATED: Split presentation URLs to support strawman/final toggle
  presentationUrl: string | null; // Currently displayed URL (computed from strawman/final)
  strawmanPreviewUrl: string | null; // Strawman preview URL
  finalPresentationUrl: string | null; // Final presentation URL
  presentationId: string | null; // Currently displayed presentation ID
  strawmanPresentationId: string | null; // Strawman presentation ID
  finalPresentationId: string | null; // Final presentation ID
  activeVersion: 'strawman' | 'final'; // Which version is currently being viewed
  slideCount: number | null;
  currentStatus: StatusUpdate['payload'] | null;
  slideStructure: SlideUpdate['payload'] | null;
}

// Hook options
export interface UseDecksterWebSocketV2Options {
  autoConnect?: boolean;
  reconnectOnError?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  existingSessionId?: string; // Resume existing session instead of creating new one
  onError?: (error: Error) => void;
  onMessage?: (message: DirectorMessage) => void;
  onPresentationReady?: (url: string) => void;
  onSessionStateChange?: (state: {
    presentationUrl?: string;
    presentationId?: string;
    slideCount?: number;
    currentStage?: number;
  }) => void;
}

const DEFAULT_WS_URL = 'wss://directorv33-production.up.railway.app/ws';

export function useDecksterWebSocketV2(options: UseDecksterWebSocketV2Options = {}) {
  const { user } = useAuth();

  // Generate stable session and user IDs
  const sessionIdRef = useRef<string>();
  const userIdRef = useRef<string>();

  // CRITICAL FIX: Initialize session ID with priority order:
  // 1. Use existing session ID from database/URL (if provided)
  // 2. Otherwise generate new UUID
  // This prevents generating new IDs on every page refresh
  if (!sessionIdRef.current) {
    if (options.existingSessionId) {
      console.log('✅ Initializing with existing session ID:', options.existingSessionId);
      sessionIdRef.current = options.existingSessionId;
    } else {
      const newId = crypto.randomUUID();
      console.log('🆕 Generating new session ID:', newId);
      sessionIdRef.current = newId;
    }
  }

  // FIXED: Allow session ID updates only when creating a new database session
  // Prevents session ID from changing once a session is loaded from URL/database
  if (options.existingSessionId && options.existingSessionId !== sessionIdRef.current) {
    console.log('🔄 Session ID update requested:', {
      current: sessionIdRef.current,
      requested: options.existingSessionId
    });

    // Always update to the existingSessionId from the builder page
    // The builder page is responsible for maintaining session continuity
    // This allows: initial connection with URL session ID or upgrading unsaved → saved
    sessionIdRef.current = options.existingSessionId;
  }

  // FIXED: Initialize user ID ONLY with authenticated user (no temporary IDs)
  // This prevents user ID from changing during session and breaking continuity
  if (!userIdRef.current && (user?.id || user?.email)) {
    const authenticatedUserId = user.id || user.email;
    userIdRef.current = authenticatedUserId;
    console.log('✅ Initialized with authenticated user ID:', authenticatedUserId);
  }

  // FIXED: Update user ID when authentication completes (but preserve existing ID)
  // This handles initial auth load, but NEVER changes user ID once set
  useEffect(() => {
    const authenticatedUserId = user?.id || user?.email;

    // Set user ID if we have authenticated user and no ID set yet
    if (authenticatedUserId && !userIdRef.current) {
      console.log('✅ Setting authenticated user ID:', authenticatedUserId);
      userIdRef.current = authenticatedUserId;
    }

    // IMPORTANT: Never change user ID once set (even if user becomes null during re-auth)
    // This prevents session ID and user ID from changing mid-session
    if (userIdRef.current && user?.id && userIdRef.current !== user.id) {
      console.warn('⚠️ User ID mismatch detected but preserving existing ID:', {
        existing: userIdRef.current,
        new: user.id,
        action: 'keeping existing ID to preserve session continuity'
      });
    }
  }, [user?.id, user?.email]);

  // Initialize browser cache for this session
  const sessionCache = useSessionCache({
    sessionId: sessionIdRef.current,
    enabled: true,
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  });

  // Try to restore state from cache first (before creating default state)
  const getInitialState = (): UseDecksterWebSocketV2State => {
    const cached = sessionCache.getCachedState();
    if (cached && sessionCache.isCacheValid()) {
      console.log('⚡ Initializing from sessionStorage cache:', {
        messages: cached.messages?.length || 0,
        strawman: !!cached.strawmanPreviewUrl,
        final: !!cached.finalPresentationUrl,
      });

      // Determine activeVersion: use cached value if available, otherwise infer from URLs
      const cachedActiveVersion = cached.activeVersion ||
        (cached.finalPresentationUrl ? 'final' : (cached.strawmanPreviewUrl ? 'strawman' : 'final'));

      return {
        connected: false,
        connecting: false,
        connectionState: 'disconnected',
        sessionId: sessionIdRef.current,
        userId: userIdRef.current,
        error: null,
        messages: cached.messages || [],
        presentationUrl: cached.presentationUrl || null,
        strawmanPreviewUrl: cached.strawmanPreviewUrl || null,
        finalPresentationUrl: cached.finalPresentationUrl || null,
        presentationId: cached.presentationId || null,
        strawmanPresentationId: cached.strawmanPresentationId || null,
        finalPresentationId: cached.finalPresentationId || null,
        activeVersion: cachedActiveVersion,
        slideCount: cached.slideCount || null,
        currentStatus: cached.currentStatus || null,
        slideStructure: cached.slideStructure || null,
      };
    }

    // No cache or invalid cache - return default state
    return {
      connected: false,
      connecting: false,
      connectionState: 'disconnected',
      sessionId: sessionIdRef.current,
      userId: userIdRef.current,
      error: null,
      messages: [],
      presentationUrl: null,
      strawmanPreviewUrl: null,
      finalPresentationUrl: null,
      presentationId: null,
      strawmanPresentationId: null,
      finalPresentationId: null,
      activeVersion: 'final', // Default to final when available, fallback to strawman
      slideCount: null,
      currentStatus: null,
      slideStructure: null,
    };
  };

  const [state, setState] = useState<UseDecksterWebSocketV2State>(getInitialState());

  // Wrapper for setState that also writes to cache
  const setStateWithCache = useCallback((
    updateFn: (prev: UseDecksterWebSocketV2State) => UseDecksterWebSocketV2State
  ) => {
    setState(prev => {
      const newState = updateFn(prev);

      // Write to sessionStorage cache (synchronous, instant)
      sessionCache.setCachedState({
        messages: newState.messages,
        presentationUrl: newState.presentationUrl,
        strawmanPreviewUrl: newState.strawmanPreviewUrl,
        finalPresentationUrl: newState.finalPresentationUrl,
        presentationId: newState.presentationId,
        strawmanPresentationId: newState.strawmanPresentationId,
        finalPresentationId: newState.finalPresentationId,
        activeVersion: newState.activeVersion,
        slideCount: newState.slideCount,
        currentStatus: newState.currentStatus,
        slideStructure: newState.slideStructure,
        userMessages: [], // Will be updated from page.tsx
      });

      return newState;
    });
  }, [sessionCache]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
  const reconnectDelay = options.reconnectDelay ?? 3000;

  // Reconnect when session ID changes (e.g., after database session creation)
  useEffect(() => {
    if (options.existingSessionId && options.existingSessionId !== sessionIdRef.current) {
      console.log('🔄 Reconnecting with new session ID:', options.existingSessionId);
      sessionIdRef.current = options.existingSessionId;
      if (wsRef.current) {
        wsRef.current.close();
        // Will auto-reconnect via existing reconnection logic
      }
    }
  }, [options.existingSessionId]);
  const HEARTBEAT_INTERVAL = 15000; // Send ping every 15 seconds

  // Start heartbeat to keep connection alive during long operations
  const startHeartbeat = useCallback(() => {
    // Clear any existing heartbeat first
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    console.log('💓 Starting heartbeat (ping every 15s)');
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          // Send raw "ping" text to keep connection alive (protocol spec)
          // Backend expects raw text "ping", not JSON object
          wsRef.current.send('ping');
          console.log('💓 Ping sent');
        } catch (error) {
          console.error('❌ Failed to send ping:', error);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }, [HEARTBEAT_INTERVAL]);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      console.log('💔 Stopping heartbeat');
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    // FIXED: Prevent connection if user is not authenticated
    // This ensures we always connect with a real user ID, never temporary ones
    if (!userIdRef.current) {
      console.warn('⚠️ Cannot connect: user not authenticated yet');
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('⏳ Connection attempt already in progress, skipping...');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('✅ WebSocket already connected or connecting');
      return;
    }

    isConnectingRef.current = true;

    setState(prev => ({
      ...prev,
      connecting: true,
      connectionState: 'connecting',
      error: null,
    }));

    try {
      const wsUrl = `${DEFAULT_WS_URL}?session_id=${sessionIdRef.current}&user_id=${userIdRef.current}`;
      console.log(`🔌 Connecting to Director v3.4: ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Connected to Director v3.4');
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        hasConnectedRef.current = true;

        // Start heartbeat to keep connection alive
        startHeartbeat();

        setState(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          connectionState: 'connected',
          error: null,
        }));
      };

      ws.onmessage = (event) => {
        try {
          // Handle raw "pong" response from heartbeat ping
          if (event.data === 'pong') {
            console.log('💓 Pong received');
            return;
          }

          const message: DirectorMessage = JSON.parse(event.data);

          // Add client-side timestamp for message ordering
          const messageWithTimestamp = {
            ...message,
            clientTimestamp: Date.now()
          } as DirectorMessage & { clientTimestamp: number };

          console.log('📨 Received message:', message.type, message);

          setStateWithCache(prev => {
            // Prevent duplicate messages by checking message_id
            const isDuplicate = prev.messages.some(m => m.message_id === message.message_id);

            // Don't add status_update messages to chat - they're only for the status bar
            const shouldAddToMessages = message.type !== 'status_update' && !isDuplicate;

            const newState = {
              ...prev,
              messages: shouldAddToMessages ? [...prev.messages, messageWithTimestamp] : prev.messages,
            };

            // Handle specific message types
            switch (message.type) {
              case 'status_update':
                console.log('📊 Status update:', message.payload.text, message.payload.progress ? `${message.payload.progress}%` : '');
                newState.currentStatus = message.payload;
                // Auto-clear status when complete
                if (message.payload.status === 'complete' || message.payload.status === 'idle') {
                  console.log('✅ Status complete/idle - will clear shortly');
                  setTimeout(() => {
                    setState(s => ({ ...s, currentStatus: null }));
                  }, 2000);
                }
                break;

              case 'presentation_url':
                console.log('🎯 Final presentation URL received:', message.payload.url);
                newState.finalPresentationUrl = message.payload.url;
                newState.finalPresentationId = message.payload.presentation_id;

                // Automatically switch to final version when it arrives
                newState.activeVersion = 'final';
                newState.presentationUrl = message.payload.url;
                newState.presentationId = message.payload.presentation_id;
                newState.slideCount = message.payload.slide_count;

                // Clear loading state - final presentation is complete
                console.log('✅ Final presentation received - clearing loading state, switching to final version');
                newState.currentStatus = null;

                // Trigger callbacks
                if (options.onPresentationReady) {
                  options.onPresentationReady(message.payload.url);
                }

                // Notify session state change for persistence
                if (options.onSessionStateChange) {
                  console.log('🔔 Calling onSessionStateChange for FINAL presentation:', {
                    url: message.payload.url,
                    id: message.payload.presentation_id,
                    slideCount: message.payload.slide_count,
                    callbackDefined: typeof options.onSessionStateChange
                  });
                  try {
                    options.onSessionStateChange({
                      presentationUrl: message.payload.url,
                      presentationId: message.payload.presentation_id,
                      slideCount: message.payload.slide_count,
                      currentStage: 6, // Stage 6 - final presentation
                    });
                    console.log('✅ onSessionStateChange completed (final)');
                  } catch (error) {
                    console.error('❌ onSessionStateChange threw error (final):', error);
                  }
                } else {
                  console.warn('⚠️ onSessionStateChange NOT defined for final presentation!');
                }
                break;

              case 'slide_update':
                console.log('📊 Slide update received, full payload:', JSON.stringify(message.payload, null, 2));
                newState.slideStructure = message.payload;

                // Extract preview URL if present (strawman preview)
                // Check multiple possible locations
                const previewUrl = message.payload.preview_url ||
                                   message.payload.metadata?.preview_url ||
                                   message.payload.strawman?.preview_url ||
                                   (message.payload as any).url;  // Sometimes sent as just 'url'

                // Extract presentation ID for strawman downloads (Stage 4)
                // Director v3.4 sends this in metadata object (per PREVIEW_PRESENTATION_ID_FIX.md)
                const previewPresentationId = message.payload.metadata?.preview_presentation_id ||
                                              message.payload.preview_presentation_id ||
                                              message.payload.strawman?.preview_presentation_id ||
                                              (message.payload as any).presentation_id;

                if (previewUrl) {
                  console.log('✅ Found strawman preview URL:', previewUrl);
                  console.log('🖼️ Setting strawmanPreviewUrl and displaying preview IMMEDIATELY');
                  newState.strawmanPreviewUrl = previewUrl;
                  newState.strawmanPresentationId = previewPresentationId || null;

                  // Set activeVersion to strawman and update presentationUrl to display it
                  newState.activeVersion = 'strawman';
                  newState.presentationUrl = previewUrl;
                  newState.presentationId = previewPresentationId || null;

                  // Clear loading state - strawman generation is complete
                  console.log('✅ Strawman received - clearing loading state');
                  newState.currentStatus = null;

                  // Set presentation ID if found (enables download buttons)
                  if (previewPresentationId) {
                    console.log('✅ Found strawman presentation_id:', previewPresentationId);
                  } else {
                    console.log('⚠️ No preview_presentation_id found - download buttons will be disabled');
                  }

                  // Trigger callback for preview
                  if (options.onPresentationReady) {
                    options.onPresentationReady(previewUrl);
                  }

                  // Notify session state change for persistence
                  if (options.onSessionStateChange) {
                    console.log('🔔 Calling onSessionStateChange for STRAWMAN:', {
                      url: previewUrl,
                      id: previewPresentationId,
                      slideCount: message.payload.slides?.length,
                      callbackDefined: typeof options.onSessionStateChange
                    });
                    try {
                      options.onSessionStateChange({
                        presentationUrl: previewUrl,
                        presentationId: previewPresentationId || undefined,
                        slideCount: message.payload.slides?.length || undefined,
                        currentStage: 4, // Stage 4 - strawman preview
                      });
                      console.log('✅ onSessionStateChange completed (strawman)');
                    } catch (error) {
                      console.error('❌ onSessionStateChange threw error (strawman):', error);
                    }
                  } else {
                    console.warn('⚠️ onSessionStateChange NOT defined for strawman!');
                  }
                } else {
                  console.log('⚠️ No preview URL found in slide_update message');
                  console.log('Checked locations: payload.preview_url, metadata.preview_url, strawman.preview_url, payload.url');
                }
                break;
            }

            return newState;
          });

          // Trigger message callback
          if (options.onMessage) {
            options.onMessage(message);
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        isConnectingRef.current = false;

        const err = new Error('WebSocket connection error');
        setState(prev => ({
          ...prev,
          error: err,
          connectionState: 'error',
        }));

        if (options.onError) {
          options.onError(err);
        }
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket connection closed');
        isConnectingRef.current = false;

        // Stop heartbeat
        stopHeartbeat();

        setState(prev => ({
          ...prev,
          connected: false,
          connecting: false,
          connectionState: 'disconnected',
          // Clear status when disconnected - prevents stale "working on strawman" messages
          currentStatus: null,
        }));

        wsRef.current = null;

        // Attempt reconnection if enabled and we had previously connected successfully
        if (options.reconnectOnError &&
            hasConnectedRef.current &&
            reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);

          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      isConnectingRef.current = false;

      const err = error instanceof Error ? error : new Error('Failed to connect');
      setState(prev => ({
        ...prev,
        error: err,
        connecting: false,
        connectionState: 'error',
      }));

      if (options.onError) {
        options.onError(err);
      }
    }
  }, [options, reconnectDelay, maxReconnectAttempts, startHeartbeat, stopHeartbeat]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting WebSocket');

    // Stop heartbeat
    stopHeartbeat();

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    isConnectingRef.current = false;
    hasConnectedRef.current = false;
    reconnectAttemptsRef.current = 0;

    setState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      connectionState: 'disconnected',
    }));
  }, [stopHeartbeat]);

  // Send message to server (NEW ARCHITECTURE: with optional File Search Store)
  const sendMessage = useCallback((
    text: string,
    storeName?: string,  // NEW: Gemini File Search Store resource name
    fileCount?: number   // NEW: Number of files in the store (for logging)
  ): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('❌ Cannot send message: WebSocket not connected');
      return false;
    }

    try {
      const message: UserMessage = {
        type: 'user_message',
        data: {
          text,
          // NEW: Pass store_name to backend instead of individual file URIs
          ...(storeName && {
            store_name: storeName,
            file_count: fileCount || 0
          })
        },
      };

      console.log(
        '📤 Sending message:',
        text,
        storeName ? `with File Search Store: ${storeName} (${fileCount || 0} files)` : ''
      );
      wsRef.current.send(JSON.stringify(message));

      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }, []);

  // Switch between strawman and final versions
  const switchVersion = useCallback((version: 'strawman' | 'final') => {
    setStateWithCache(prev => {
      const newActiveVersion = version;
      let newPresentationUrl = null;
      let newPresentationId = null;

      if (version === 'strawman' && prev.strawmanPreviewUrl) {
        newPresentationUrl = prev.strawmanPreviewUrl;
        newPresentationId = prev.strawmanPresentationId;
      } else if (version === 'final' && prev.finalPresentationUrl) {
        newPresentationUrl = prev.finalPresentationUrl;
        newPresentationId = prev.finalPresentationId;
      }

      console.log(`🔄 Switching to ${version} version:`, {
        presentationUrl: newPresentationUrl || '(none)',
        presentationId: newPresentationId || '(none)'
      });

      return {
        ...prev,
        activeVersion: newActiveVersion,
        presentationUrl: newPresentationUrl,
        presentationId: newPresentationId
      };
    });
  }, [setStateWithCache]);

  // Clear messages
  const clearMessages = useCallback(() => {
    // Also clear the cache
    sessionCache.clearCache();

    setStateWithCache(prev => ({
      ...prev,
      messages: [],
      presentationUrl: null,
      strawmanPreviewUrl: null,
      finalPresentationUrl: null,
      presentationId: null,
      strawmanPresentationId: null,
      finalPresentationId: null,
      activeVersion: 'final',
      slideCount: null,
      currentStatus: null,
      slideStructure: null,
    }));
  }, [sessionCache, setStateWithCache]);

  // Restore messages from database (for session loading)
  const restoreMessages = useCallback((historicalMessages: DirectorMessage[], sessionState?: {
    presentationUrl?: string | null;
    presentationId?: string | null;
    strawmanPreviewUrl?: string | null;
    strawmanPresentationId?: string | null;
    finalPresentationUrl?: string | null;
    finalPresentationId?: string | null;
    slideCount?: number | null;
    slideStructure?: any;
    currentStage?: number | null;
    activeVersion?: 'strawman' | 'final' | null;
  }) => {
    console.log(`🔄 Restoring ${historicalMessages.length} messages from database`);
    console.log(`📊 Restoration data:`, {
      presentationUrl: sessionState?.presentationUrl || '(none)',
      presentationId: sessionState?.presentationId || '(none)',
      strawmanPreviewUrl: sessionState?.strawmanPreviewUrl || '(none)',
      finalPresentationUrl: sessionState?.finalPresentationUrl || '(none)',
      slideCount: sessionState?.slideCount || 0,
      currentStage: sessionState?.currentStage || '(none)',
      activeVersion: sessionState?.activeVersion || '(none)'
    });

    // CRITICAL FIX: Determine activeVersion based on explicit value or infer from URLs
    // This preserves user's choice when switching tabs or sessions
    let activeVersion: 'strawman' | 'final' = 'final';

    if (sessionState?.activeVersion) {
      // If activeVersion is explicitly provided (from database or cache), use it
      activeVersion = sessionState.activeVersion;
    } else if (sessionState?.currentStage === 4) {
      // Stage 4 = strawman preview
      activeVersion = 'strawman';
    } else if (sessionState?.currentStage === 6) {
      // Stage 6 = final presentation
      activeVersion = 'final';
    } else {
      // Fallback: infer from which URLs are available (prefer final)
      if (sessionState?.finalPresentationUrl) {
        activeVersion = 'final';
      } else if (sessionState?.strawmanPreviewUrl) {
        activeVersion = 'strawman';
      }
    }

    // Compute the display URL based on the determined activeVersion
    const displayUrl = activeVersion === 'strawman'
      ? sessionState?.strawmanPreviewUrl || null
      : sessionState?.finalPresentationUrl || null;
    const displayId = activeVersion === 'strawman'
      ? sessionState?.strawmanPresentationId || null
      : sessionState?.finalPresentationId || null;

    console.log(`✅ Determined activeVersion: ${activeVersion} (display URL: ${displayUrl ? 'present' : 'none'})`);

    setStateWithCache(prev => ({
      ...prev,
      messages: historicalMessages,
      // CRITICAL FIX: Use computed display URL based on activeVersion
      // This ensures the correct presentation version is shown
      presentationUrl: displayUrl,
      presentationId: displayId,
      strawmanPreviewUrl: sessionState?.strawmanPreviewUrl || null,
      strawmanPresentationId: sessionState?.strawmanPresentationId || null,
      finalPresentationUrl: sessionState?.finalPresentationUrl || null,
      finalPresentationId: sessionState?.finalPresentationId || null,
      activeVersion: activeVersion,
      slideCount: sessionState?.slideCount || null,
      slideStructure: sessionState?.slideStructure || null,
      currentStage: sessionState?.currentStage || null,
      currentStatus: null, // Always clear status on session restore
    }));
  }, [setStateWithCache]);

  // Auto-connect on mount (only once)
  useEffect(() => {
    console.log('🚀 WebSocket Hook Mounted', {
      autoConnect: options.autoConnect,
      hasConnected: hasConnectedRef.current,
      isConnecting: isConnectingRef.current,
      sessionId: sessionIdRef.current,
      userId: userIdRef.current
    });

    if (options.autoConnect !== false && !hasConnectedRef.current && !isConnectingRef.current) {
      console.log('🎯 Initiating connection...');
      connect();
    } else {
      console.log('⏭️ Skipping auto-connect:', {
        autoConnect: options.autoConnect,
        hasConnected: hasConnectedRef.current,
        isConnecting: isConnectingRef.current
      });
    }

    return () => {
      console.log('🧹 WebSocket Hook Unmounting');
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  return {
    // State
    ...state,

    // Actions
    connect,
    disconnect,
    sendMessage,
    clearMessages,
    restoreMessages,
    switchVersion,

    // Utility
    isReady: state.connected,
  };
}
