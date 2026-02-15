import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './use-auth';
import { useSessionCache, CachedSessionState } from './use-session-cache';

// Director v3.4 Message Types (Corrected - uses 'payload' not 'data')

export interface BaseMessage {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'chat_message' | 'action_request' | 'slide_update' | 'presentation_init' | 'presentation_url' | 'status_update' | 'sync_response';
  payload: any;
}

// Sync response from Director when connecting with skip_history=true
export interface SyncResponse {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'sync_response';
  role: 'assistant';
  payload: {
    action: 'skip_history' | 'send_history' | 'send_delta';
    message_count: number;
    current_state: string;
    has_strawman: boolean;
    presentation_url?: string;
  };
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
    is_blank?: boolean;  // NEW: Indicates blank presentation on immediate connect (Builder V2)
    metadata: {
      main_title: string;
      overall_theme: string;
      design_suggestions: string;
      target_audience: string;
      presentation_duration: number;
      preview_url?: string;  // Strawman preview URL (may be in metadata)
      preview_presentation_id?: string;  // Presentation ID for blank/strawman
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
    preview_presentation_id?: string;  // Presentation ID (may be at payload root)
  };
}

// Blank presentation initialization (sent instead of slide_update to avoid chat card rendering)
export interface PresentationInit {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'presentation_init';
  payload: {
    is_blank?: boolean;
    preview_url?: string;
    preview_presentation_id?: string;
    metadata?: {
      main_title: string;
      preview_url?: string;
      preview_presentation_id?: string;
      [key: string]: any;
    };
    slides?: Array<{
      slide_id: string;
      slide_number: number;
      slide_type: string;
      title: string;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
}

export type DirectorMessage = ChatMessage | ActionRequest | SlideUpdate | PresentationInit | PresentationURL | StatusUpdate | SyncResponse;

// Content context for Director - affects content generation
export interface ContentContextPayload {
  audience: {
    audience_type: string;
  };
  purpose: {
    purpose_type: string;
  };
  time: {
    duration_minutes: number;
  };
}

// User message to send to server
export interface UserMessage {
  type: 'user_message';
  data: {
    text: string;
    store_name?: string;
    file_count?: number;
    content_context?: ContentContextPayload;
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
  // UPDATED: Split presentation URLs to support blank/strawman/final toggle (Builder V2)
  presentationUrl: string | null; // Currently displayed URL (computed from blank/strawman/final)
  strawmanPreviewUrl: string | null; // Strawman preview URL
  finalPresentationUrl: string | null; // Final presentation URL
  presentationId: string | null; // Currently displayed presentation ID
  strawmanPresentationId: string | null; // Strawman presentation ID
  finalPresentationId: string | null; // Final presentation ID
  // NEW: Blank presentation state (Builder V2 - immediate connection)
  blankPresentationUrl: string | null; // Blank presentation URL on connect
  blankPresentationId: string | null; // Blank presentation ID
  isBlankPresentation: boolean; // True if currently showing blank presentation
  activeVersion: 'blank' | 'strawman' | 'final'; // Which version is currently being viewed
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
    // Builder V2: Include activeVersion and slideStructure for persistence
    activeVersion?: 'blank' | 'strawman' | 'final';
    slideStructure?: any;
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
    console.log('🔄 [WEBSOCKET-SESSION] Session ID update requested', {
      old: sessionIdRef.current,
      new: options.existingSessionId,
      source: 'builder page (existingSessionId prop)'
    });

    // Always update to the existingSessionId from the builder page
    // The builder page is responsible for maintaining session continuity
    // This allows: initial connection with URL session ID or upgrading unsaved → saved
    sessionIdRef.current = options.existingSessionId;

    console.log('✅ [WEBSOCKET-SESSION] Session ID updated', {
      sessionId: sessionIdRef.current
    });
  }

  // FIXED: Initialize user ID ONLY with authenticated user (no temporary IDs)
  // This prevents user ID from changing during session and breaking continuity
  if (!userIdRef.current && (user?.id || user?.email)) {
    const authenticatedUserId = user.id || user.email;
    console.log('✅ [WEBSOCKET-USER] Initializing with authenticated user ID', {
      user_id: authenticatedUserId,
      source: user.id ? 'user.id' : 'user.email'
    });
    userIdRef.current = authenticatedUserId;
  }

  // FIXED: Update user ID when authentication completes (but preserve existing ID)
  // This handles initial auth load, but NEVER changes user ID once set
  useEffect(() => {
    const authenticatedUserId = user?.id || user?.email;

    // Set user ID if we have authenticated user and no ID set yet
    if (authenticatedUserId && !userIdRef.current) {
      console.log('✅ [WEBSOCKET-USER] Setting authenticated user ID from effect', {
        user_id: authenticatedUserId,
        source: user.id ? 'user.id' : 'user.email'
      });
      userIdRef.current = authenticatedUserId;
    }

    // IMPORTANT: Never change user ID once set (even if user becomes null during re-auth)
    // This prevents session ID and user ID from changing mid-session
    if (userIdRef.current && user?.id && userIdRef.current !== user.id) {
      console.warn('⚠️ [WEBSOCKET-USER] User ID mismatch detected but preserving existing ID', {
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
        blank: !!cached.blankPresentationUrl,
        strawman: !!cached.strawmanPreviewUrl,
        final: !!cached.finalPresentationUrl,
      });

      // Determine activeVersion: use cached value if available, otherwise infer from URLs
      // Priority: final > strawman > blank
      const cachedActiveVersion = (cached.activeVersion as 'blank' | 'strawman' | 'final') ||
        (cached.finalPresentationUrl ? 'final' :
         (cached.strawmanPreviewUrl ? 'strawman' :
          (cached.blankPresentationUrl ? 'blank' : 'final')));

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
        // NEW: Blank presentation state (Builder V2)
        blankPresentationUrl: cached.blankPresentationUrl || null,
        blankPresentationId: cached.blankPresentationId || null,
        isBlankPresentation: cached.isBlankPresentation || false,
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
      // NEW: Blank presentation state (Builder V2)
      blankPresentationUrl: null,
      blankPresentationId: null,
      isBlankPresentation: false,
      activeVersion: 'final', // Default to final when available, fallback to strawman/blank
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

      // CRITICAL FIX: Get existing cached messages to preserve them
      // This prevents cache corruption when React state updates are pending (async)
      // but cache writes are synchronous. Without this merge, WebSocket messages
      // arriving before React applies restoreMessages update would overwrite
      // the 140+ DB-loaded messages with just the few WS messages.
      const existingCached = sessionCache.getCachedState();
      const existingMessages = existingCached?.messages || [];
      const existingUserMessages = existingCached?.userMessages || [];

      // Merge: existing cached messages + new state messages
      // This ensures we never lose messages due to React's async state batching
      const allMessages = [...existingMessages, ...newState.messages];

      // Deduplicate by message_id (Map keeps last occurrence for duplicate keys)
      const uniqueMessages = Array.from(
        new Map(allMessages.map(m => [m.message_id, m])).values()
      );

      // Write to sessionStorage cache (synchronous, instant)
      // Preserve existing userMessages - they're managed by page.tsx via updateCacheUserMessages
      sessionCache.setCachedState({
        messages: uniqueMessages,
        presentationUrl: newState.presentationUrl,
        strawmanPreviewUrl: newState.strawmanPreviewUrl,
        finalPresentationUrl: newState.finalPresentationUrl,
        presentationId: newState.presentationId,
        strawmanPresentationId: newState.strawmanPresentationId,
        finalPresentationId: newState.finalPresentationId,
        // NEW: Blank presentation state (Builder V2)
        blankPresentationUrl: newState.blankPresentationUrl,
        blankPresentationId: newState.blankPresentationId,
        isBlankPresentation: newState.isBlankPresentation,
        activeVersion: newState.activeVersion,
        slideCount: newState.slideCount,
        currentStatus: newState.currentStatus,
        slideStructure: newState.slideStructure,
        userMessages: existingUserMessages, // Preserve existing userMessages from cache
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
      // Check if we have cached messages to enable sync protocol
      // CRITICAL: Must check BOTH user messages AND bot messages to determine cache completeness
      // If cache only has bot messages (userMessages empty), cache is incomplete and we should NOT skip history
      const cached = sessionCache.getCachedState();
      const hasCachedBotMessages = cached && cached.messages && cached.messages.length > 0;
      const hasCachedUserMessages = cached && cached.userMessages && cached.userMessages.length > 0;
      const botMessageCount = cached?.messages?.length || 0;
      const userMessageCount = cached?.userMessages?.length || 0;
      const totalMessageCount = botMessageCount + userMessageCount;

      // Only skip history if we have BOTH user and bot messages cached
      // This prevents sending skip_history=true when cache is incomplete (e.g., after corrupted cache)
      const skipHistory = (hasCachedBotMessages && hasCachedUserMessages) ? 'true' : 'false';

      // Include message_count so Director can validate cache completeness
      // If count doesn't match Supabase, Director should send full history regardless of skip_history
      const wsUrl = `${DEFAULT_WS_URL}?session_id=${sessionIdRef.current}&user_id=${userIdRef.current}&skip_history=${skipHistory}&message_count=${totalMessageCount}`;

      // DEBUG: Comprehensive logging of connection parameters
      console.log('🔌 [WEBSOCKET] Initiating connection to Director', {
        session_id: sessionIdRef.current,
        user_id: userIdRef.current,
        skip_history: skipHistory,
        cached_bot_messages: botMessageCount,
        cached_user_messages: userMessageCount,
        total_message_count: totalMessageCount,
        cache_complete: hasCachedBotMessages && hasCachedUserMessages,
        wsUrl: wsUrl,
        timestamp: new Date().toISOString()
      });
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

            // Don't add status_update, sync_response, or presentation_init messages to chat - they're only for state management
            const shouldAddToMessages = message.type !== 'status_update' && message.type !== 'sync_response' && message.type !== 'presentation_init' && !isDuplicate;

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

              case 'sync_response':
                // Sync protocol response - Director confirms whether to skip history
                console.log('🔄 Sync response received:', {
                  action: message.payload.action,
                  message_count: message.payload.message_count,
                  current_state: message.payload.current_state,
                  has_strawman: message.payload.has_strawman,
                  presentation_url: message.payload.presentation_url
                });
                // No state changes needed - frontend already has messages in cache
                // This message confirms Director acknowledged skip_history request
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

              case 'presentation_init': {
                // Director sends presentation_init (instead of slide_update) for blank presentations
                // This avoids rendering a "1 slides · 0 min" card in chat
                console.log('🆕 presentation_init received:', JSON.stringify(message.payload, null, 2));

                const initUrl = message.payload.presentation_url ||
                                message.payload.preview_url ||
                                message.payload.url ||
                                message.payload.metadata?.preview_url ||
                                message.payload.metadata?.presentation_url;
                const initId = message.payload.presentation_id ||
                               message.payload.preview_presentation_id ||
                               message.payload.metadata?.preview_presentation_id ||
                               message.payload.metadata?.presentation_id;

                console.log('🆕 Blank presentation received (presentation_init):', { initUrl, initId });

                if (initUrl) {
                  newState.blankPresentationUrl = initUrl;
                  newState.blankPresentationId = initId || null;
                  newState.isBlankPresentation = true;
                  newState.activeVersion = 'blank';
                  newState.presentationUrl = initUrl;
                  newState.presentationId = initId || null;
                  newState.slideStructure = message.payload as any;

                  console.log('✅ Blank presentation ready - all editing tools now active');

                  if (options.onPresentationReady) {
                    options.onPresentationReady(initUrl);
                  }

                  if (options.onSessionStateChange) {
                    options.onSessionStateChange({
                      presentationUrl: initUrl,
                      presentationId: initId || undefined,
                      slideCount: 1,
                      currentStage: 0,
                    });
                  }
                }
                break;
              }

              case 'slide_update':
                console.log('📊 Slide update received, full payload:', JSON.stringify(message.payload, null, 2));
                newState.slideStructure = message.payload;

                // Legacy: Handle blank presentation sent as slide_update with is_blank flag
                // (kept for backward compatibility, but Director now sends presentation_init instead)
                if (message.payload.is_blank) {
                  const blankUrl = message.payload.preview_url ||
                                   message.payload.metadata?.preview_url;
                  const blankId = message.payload.metadata?.preview_presentation_id ||
                                  message.payload.preview_presentation_id;

                  console.log('🆕 Blank presentation received (legacy slide_update):', { blankUrl, blankId });

                  if (blankUrl) {
                    // Set blank presentation state
                    newState.blankPresentationUrl = blankUrl;
                    newState.blankPresentationId = blankId || null;
                    newState.isBlankPresentation = true;

                    // Set as current presentation (blank is the starting point)
                    newState.activeVersion = 'blank';
                    newState.presentationUrl = blankUrl;
                    newState.presentationId = blankId || null;

                    console.log('✅ Blank presentation ready - all editing tools now active');

                    // Trigger callback for blank presentation ready
                    if (options.onPresentationReady) {
                      options.onPresentationReady(blankUrl);
                    }

                    // Notify session state change for persistence (Stage 0 - blank)
                    if (options.onSessionStateChange) {
                      options.onSessionStateChange({
                        presentationUrl: blankUrl,
                        presentationId: blankId || undefined,
                        slideCount: 1, // Blank has 1 title slide
                        currentStage: 0, // Stage 0 - blank presentation
                      });
                    }
                  }
                  break; // Exit early - don't process as strawman
                }

                // EXISTING: Handle regular slide_update (strawman preview)
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
    fileCount?: number,  // NEW: Number of files in the store (for logging)
    contentContext?: ContentContextPayload  // NEW: Content context for Director
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
          }),
          // NEW: Pass content_context to Director for content generation
          ...(contentContext && {
            content_context: contentContext
          })
        },
      };

      console.log(
        '📤 Sending message:',
        text,
        storeName ? `with File Search Store: ${storeName} (${fileCount || 0} files)` : '',
        contentContext ? `with content context: ${JSON.stringify(contentContext)}` : ''
      );
      wsRef.current.send(JSON.stringify(message));

      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }, []);

  // Switch between blank, strawman and final versions (Builder V2)
  const switchVersion = useCallback((version: 'blank' | 'strawman' | 'final') => {
    setStateWithCache(prev => {
      const newActiveVersion = version;
      let newPresentationUrl = null;
      let newPresentationId = null;

      if (version === 'blank' && prev.blankPresentationUrl) {
        newPresentationUrl = prev.blankPresentationUrl;
        newPresentationId = prev.blankPresentationId;
      } else if (version === 'strawman' && prev.strawmanPreviewUrl) {
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
      // NEW: Reset blank presentation state (Builder V2)
      blankPresentationUrl: null,
      blankPresentationId: null,
      isBlankPresentation: false,
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
    // NEW: Blank presentation state (Builder V2)
    blankPresentationUrl?: string | null;
    blankPresentationId?: string | null;
    isBlankPresentation?: boolean;
    slideCount?: number | null;
    slideStructure?: any;
    currentStage?: number | null;
    activeVersion?: 'blank' | 'strawman' | 'final' | null;
  }) => {
    console.log(`🔄 Restoring ${historicalMessages.length} messages from database`);
    console.log(`📊 Restoration data:`, {
      presentationUrl: sessionState?.presentationUrl || '(none)',
      presentationId: sessionState?.presentationId || '(none)',
      blankPresentationUrl: sessionState?.blankPresentationUrl || '(none)',
      strawmanPreviewUrl: sessionState?.strawmanPreviewUrl || '(none)',
      finalPresentationUrl: sessionState?.finalPresentationUrl || '(none)',
      slideCount: sessionState?.slideCount || 0,
      currentStage: sessionState?.currentStage || '(none)',
      activeVersion: sessionState?.activeVersion || '(none)'
    });

    // CRITICAL FIX: Determine activeVersion based on explicit value or infer from URLs
    // This preserves user's choice when switching tabs or sessions
    // Priority: final > strawman > blank
    let activeVersion: 'blank' | 'strawman' | 'final' = 'final';

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
      // Fallback: infer from which URLs are available (prefer final > strawman > blank)
      if (sessionState?.finalPresentationUrl) {
        activeVersion = 'final';
      } else if (sessionState?.strawmanPreviewUrl) {
        activeVersion = 'strawman';
      } else if (sessionState?.blankPresentationUrl) {
        activeVersion = 'blank';
      }
    }

    // Compute the display URL based on the determined activeVersion
    let displayUrl: string | null = null;
    let displayId: string | null = null;

    if (activeVersion === 'blank') {
      displayUrl = sessionState?.blankPresentationUrl || null;
      displayId = sessionState?.blankPresentationId || null;
    } else if (activeVersion === 'strawman') {
      displayUrl = sessionState?.strawmanPreviewUrl || null;
      displayId = sessionState?.strawmanPresentationId || null;
    } else {
      displayUrl = sessionState?.finalPresentationUrl || null;
      displayId = sessionState?.finalPresentationId || null;
    }

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
      // NEW: Blank presentation state (Builder V2)
      blankPresentationUrl: sessionState?.blankPresentationUrl || null,
      blankPresentationId: sessionState?.blankPresentationId || null,
      isBlankPresentation: sessionState?.isBlankPresentation || false,
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

  // Update user messages in session cache (called from page.tsx when user messages are loaded/updated)
  // This is critical for the sync protocol to work correctly - skip_history needs to know about user messages
  const updateCacheUserMessages = useCallback((
    userMessages: Array<{ id: string; text: string; timestamp: number }>
  ) => {
    console.log('💾 Updating cache with user messages:', userMessages.length);

    // Get current cached state and update just the userMessages
    const cached = sessionCache.getCachedState();
    sessionCache.setCachedState({
      ...cached,
      userMessages: userMessages,
    });
  }, [sessionCache]);

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
    updateCacheUserMessages,

    // Utility
    isReady: state.connected,
  };
}
