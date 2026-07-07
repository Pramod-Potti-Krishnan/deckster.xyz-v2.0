import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './use-auth';
import { useSessionCache, CachedSessionState } from './use-session-cache';
import { debugLog } from '@/lib/debug-log';
import type { BuildThemeSelection } from '@/lib/theme-builder';
import type { TemplateOverrides } from '@/lib/template-mode';
import { normalizeSlideComposeSocketFrame } from '@/lib/slide-compose-async';
import { applyFinalSyncRecovery } from '@/lib/director-sync-recovery';

// Director v3.4 Message Types (Corrected - uses 'payload' not 'data')

export interface BaseMessage {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'chat_message' | 'action_request' | 'slide_update' | 'presentation_init' | 'presentation_url' | 'status_update' | 'sync_response' | 'slide_context' | 'token_usage' | 'slide_progress' | 'slide_ready' | 'slide_failed';
  payload: any;
}

const KNOWN_DIRECTOR_MESSAGE_TYPES = new Set<BaseMessage['type']>([
  'chat_message',
  'action_request',
  'slide_update',
  'presentation_init',
  'presentation_url',
  'status_update',
  'sync_response',
  'slide_context',
  'token_usage',
  'slide_progress',
  'slide_ready',
  'slide_failed',
]);

function isKnownDirectorMessageType(type: unknown): type is BaseMessage['type'] {
  return typeof type === 'string' && KNOWN_DIRECTOR_MESSAGE_TYPES.has(type as BaseMessage['type']);
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
    presentation_id?: string;
    slide_count?: number | null;
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
    // Director thinking-stream: progress-narration chat bubbles emitted during
    // strawman generation. Frontend fades these out when slide_update arrives.
    ephemeral?: boolean;
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
      speaker_notes?: string | null;
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

// Rich strawman frame emitted by Director after V2 Packager runs (extended generation only).
// Carries per-slide narrative_role + key_message + Researcher v2 content blob, plus
// deck-level deck_arc / presentation_brief. Round 1 reads narrative_role + key_message.
export interface SlideContextItem {
  slide_index: number;
  canvas_type?: string;
  slide_kind?: string;
  narrative_role?: string;
  key_message?: string;
  content_type?: string;
  subtypes?: {
    chart_subtype?: string | null;
    infographic_subtype?: string | null;
    text_subtype?: string | null;
    diagram_subtype?: string | null;
  };
  // Shape varies by content_type — kept loose for forward-compat. Round 2+ readers
  // will narrow this when consuming body_paragraphs / entities / layers / etc.
  content?: unknown;
}

export interface SlideContext {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'slide_context';
  payload: {
    operation: 'full_update' | 'partial_update';
    deck?: {
      deck_arc?: string;
      presentation_brief?: string;
      deck_outline?: Array<{ slide_index: number; slide_title: string }>;
      deck_tables?: unknown[];
      theme_session_id?: string;
    };
    slides: SlideContextItem[];
  };
}

export interface StageTokenTotal {
  stage: string;
  tokens_in: number;
  tokens_out: number;
  total_tokens: number;
  cached_tokens_in: number;
  reasoning_tokens: number;
  call_count: number;
}

export interface TokenScopeTotal {
  tokens_in: number;
  tokens_out: number;
  total_tokens: number;
  cached_tokens_in: number;
  reasoning_tokens: number;
  per_stage: StageTokenTotal[];
}

export interface TokenUsagePayload {
  turn: TokenScopeTotal;
  session: TokenScopeTotal;
  coverage: 'full' | 'partial';
  action_type: string | null;
}

export interface TokenUsage {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'token_usage';
  role: 'assistant';
  payload: TokenUsagePayload;
}

export interface SlideComposeReady {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'slide_ready';
  payload: {
    session_id?: string;
    job_id: string;
    status: 'built';
    slide_index: number;
    real_slide_id?: string | null;
    presentation_id: string;
    presentation_url?: string | null;
  };
}

export interface SlideComposeProgress {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'slide_progress';
  payload: {
    job_id: string;
    stage: string;
    text: string;
    detail?: string | null;
    slide_index?: number | null;
  };
}

export interface SlideComposeFailed {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'slide_failed';
  payload: {
    session_id?: string;
    job_id: string;
    stage?: string | null;
    errors?: string[];
  };
}

export type DirectorMessage = ChatMessage | ActionRequest | SlideUpdate | PresentationInit | PresentationURL | StatusUpdate | SyncResponse | SlideContext | TokenUsage | SlideComposeProgress | SlideComposeReady | SlideComposeFailed;

export function normalizeDirectorMessageFrame(raw: DirectorMessage | (BaseMessage & Record<string, any>)): DirectorMessage {
  return normalizeSlideComposeSocketFrame(raw as any) as unknown as DirectorMessage;
}

// User message to send to server
export interface UserMessage {
  type: 'user_message';
  data: {
    text: string;
    store_name: string | null;
    file_count?: number;
    deep_research: boolean;
    web_search: boolean;
    extended_generation: boolean;
    file_upload: boolean;
    use_knowledge_graph?: boolean;
    theme?: BuildThemeSelection;
    // Template Builder (reuse): when a saved template is locked in, these tell
    // Director to run the reuse path (skip strawman workflow → Fire #2 → Stage E).
    template_mode?: boolean;
    template_id?: string;
    element_overrides?: TemplateOverrides;
    action_value?: string;
    action_label?: string;
  };
}

export interface ControlMessage {
  type: 'cancel_template_reuse';
  data?: Record<string, never>;
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
  deckOwnerSessionId: string | null; // Session id that produced the currently-held deck urls
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
  // Rich strawman: per-slide context keyed by slide_index, plus deck-level context.
  // Populated when Director emits slide_context (extended-generation sessions only).
  slideContextByIndex: Record<number, SlideContextItem> | null;
  deckContext: SlideContext['payload']['deck'] | null;
  // Thinking-stream: message IDs of ephemeral chat_messages currently in the
  // transcript. MessageList drains this via onEphemeralFadeComplete after fading.
  ephemeralMessageIds: string[];
  // Incremented only when a real strawman slide_update lands. This keeps
  // ephemeral bubbles visible while the blank-presentation slideStructure exists.
  ephemeralFadeToken: number;
  // Director token-usage ledger, emitted once per completed turn.
  tokenUsage: TokenUsagePayload | null;
  tokenUsageMessageId: string | null;
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
  onSlideComposeProgress?: (message: SlideComposeProgress) => void;
  onSlideComposeReady?: (message: SlideComposeReady) => void;
  onSlideComposeFailed?: (message: SlideComposeFailed) => void;
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

// NEXT_PUBLIC_WS_URL lets local UAT point the builder at a locally-run Director
// (e.g. ws://localhost:8000/ws); falls back to the deployed Director otherwise.
const DEFAULT_WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://directorv33-production.up.railway.app/ws';

export function useDecksterWebSocketV2(options: UseDecksterWebSocketV2Options = {}) {
  const { user } = useAuth();

  // Generate stable session and user IDs
  const sessionIdRef = useRef<string>('');
  const userIdRef = useRef<string>('');

  // CRITICAL FIX: Initialize session ID with priority order:
  // 1. Use existing session ID from database/URL (if provided)
  // 2. Otherwise generate new UUID
  // This prevents generating new IDs on every page refresh
  if (!sessionIdRef.current) {
    if (options.existingSessionId) {
      debugLog('✅ Initializing with existing session ID:', options.existingSessionId);
      sessionIdRef.current = options.existingSessionId;
    } else {
      const newId = crypto.randomUUID();
      debugLog('🆕 Generating new session ID:', newId);
      sessionIdRef.current = newId;
    }
  }

  // FIXED: Allow session ID updates only when creating a new database session
  // Prevents session ID from changing once a session is loaded from URL/database
  if (options.existingSessionId && options.existingSessionId !== sessionIdRef.current) {
    debugLog('🔄 [WEBSOCKET-SESSION] Session ID update requested', {
      old: sessionIdRef.current,
      new: options.existingSessionId,
      source: 'builder page (existingSessionId prop)'
    });

    // Always update to the existingSessionId from the builder page
    // The builder page is responsible for maintaining session continuity
    // This allows: initial connection with URL session ID or upgrading unsaved → saved
    sessionIdRef.current = options.existingSessionId;

    debugLog('✅ [WEBSOCKET-SESSION] Session ID updated', {
      sessionId: sessionIdRef.current
    });
  }

  // FIXED: Initialize user ID ONLY with authenticated user (no temporary IDs)
  // This prevents user ID from changing during session and breaking continuity
  if (!userIdRef.current && (user?.id || user?.email)) {
    const authenticatedUserId = user.id ?? user.email ?? undefined;
    debugLog('✅ [WEBSOCKET-USER] Initializing with authenticated user ID', {
      user_id: authenticatedUserId,
      source: user.id ? 'user.id' : 'user.email'
    });
    userIdRef.current = authenticatedUserId;
  }

  // FIXED: Update user ID when authentication completes (but preserve existing ID)
  // This handles initial auth load, but NEVER changes user ID once set
  useEffect(() => {
    const authenticatedUserId = user?.id ?? user?.email ?? undefined;

    // Set user ID if we have authenticated user and no ID set yet
    if (authenticatedUserId && !userIdRef.current) {
      debugLog('✅ [WEBSOCKET-USER] Setting authenticated user ID from effect', {
        user_id: authenticatedUserId,
        source: user?.id ? 'user.id' : 'user.email'
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
      debugLog('⚡ Initializing from sessionStorage cache:', {
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
        deckOwnerSessionId: sessionIdRef.current,
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
        slideContextByIndex: (cached as any).slideContextByIndex || null,
        deckContext: (cached as any).deckContext || null,
        ephemeralMessageIds: (cached as any).ephemeralMessageIds || [],
        ephemeralFadeToken: 0,
        tokenUsage: (cached as any).tokenUsage || null,
        tokenUsageMessageId: (cached as any).tokenUsageMessageId || null,
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
      deckOwnerSessionId: null,
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
      slideContextByIndex: null,
      deckContext: null,
      ephemeralMessageIds: [],
      ephemeralFadeToken: 0,
      tokenUsage: null,
      tokenUsageMessageId: null,
    };
  };

  const [state, setState] = useState<UseDecksterWebSocketV2State>(() => getInitialState());

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
        slideContextByIndex: newState.slideContextByIndex,
        deckContext: newState.deckContext,
        tokenUsage: newState.tokenUsage,
        tokenUsageMessageId: newState.tokenUsageMessageId,
        userMessages: existingUserMessages, // Preserve existing userMessages from cache
      });

      return newState;
    });
  }, [sessionCache]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastCloseDiagnosticAtRef = useRef(0);
  const suppressedCloseDiagnosticsRef = useRef(0);
  const maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
  const reconnectDelay = options.reconnectDelay ?? 3000;

  // Reconnect when session ID changes (e.g., after database session creation)
  useEffect(() => {
    if (options.existingSessionId && options.existingSessionId !== sessionIdRef.current) {
      debugLog('🔄 Reconnecting with new session ID:', options.existingSessionId);
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

    debugLog('💓 Starting heartbeat (ping every 15s)');
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          // Send raw "ping" text to keep connection alive (protocol spec)
          // Backend expects raw text "ping", not JSON object
          wsRef.current.send('ping');
          debugLog('💓 Ping sent');
        } catch (error) {
          console.error('❌ Failed to send ping:', error);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }, [HEARTBEAT_INTERVAL]);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      debugLog('💔 Stopping heartbeat');
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    // FIXED: Prevent connection if user is not authenticated
    // This ensures we always connect with a real user ID, never temporary ones
    if (!userIdRef.current) {
      debugLog('⚠️ Cannot connect: user not authenticated yet');
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      debugLog('⏳ Connection attempt already in progress, skipping...');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      debugLog('✅ WebSocket already connected or connecting');
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
      debugLog('🔌 [WEBSOCKET] Initiating connection to Director', {
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
      debugLog(`🔌 Connecting to Director v3.4: ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      const isCurrentSocket = () => wsRef.current === ws;

      ws.onopen = () => {
        if (!isCurrentSocket()) {
          debugLog('⏭️ Ignoring open from stale WebSocket');
          try {
            ws.close();
          } catch {
            // Ignore cleanup errors from a superseded socket.
          }
          return;
        }

        debugLog('✅ Connected to Director v3.4');
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
        if (!isCurrentSocket()) {
          debugLog('⏭️ Ignoring message from stale WebSocket');
          return;
        }

        try {
          // Handle raw "pong" response from heartbeat ping
          if (event.data === 'pong') {
            debugLog('💓 Pong received');
            return;
          }

          const parsedMessage = normalizeDirectorMessageFrame(JSON.parse(event.data)) as DirectorMessage & { type?: unknown };
          if (!isKnownDirectorMessageType(parsedMessage.type)) {
            return;
          }

          const message = parsedMessage as DirectorMessage;

          // Add client-side timestamp for message ordering
          const messageWithTimestamp = {
            ...message,
            clientTimestamp: Date.now()
          } as DirectorMessage & { clientTimestamp: number };

          debugLog('📨 Received message:', message.type, message);

          setStateWithCache(prev => {
            // Prevent duplicate messages by checking message_id
            const isDuplicate = prev.messages.some(m => m.message_id === message.message_id);

            // Don't add state-management frames to chat; they drive deck/view state only.
            const shouldAddToMessages =
              message.type !== 'status_update' &&
              message.type !== 'sync_response' &&
              message.type !== 'presentation_init' &&
              message.type !== 'slide_context' &&
              message.type !== 'token_usage' &&
              message.type !== 'slide_progress' &&
              message.type !== 'slide_ready' &&
              message.type !== 'slide_failed' &&
              !isDuplicate;

            const newState = {
              ...prev,
              messages: shouldAddToMessages ? [...prev.messages, messageWithTimestamp] : prev.messages,
            };

            // Track ephemeral chat_messages (Director thinking-stream) so MessageList
            // can fade them out once the real slide_update lands.
            if (message.type === 'chat_message' && (message.payload as any).ephemeral === true) {
              newState.ephemeralMessageIds = prev.ephemeralMessageIds.includes(message.message_id)
                ? prev.ephemeralMessageIds
                : [...prev.ephemeralMessageIds, message.message_id];
              debugLog('💭 Ephemeral progress message:', (message.payload as any).text);
            }

            // Handle specific message types
            switch (message.type) {
              case 'status_update':
                debugLog('📊 Status update:', message.payload.text, message.payload.progress ? `${message.payload.progress}%` : '');
                newState.currentStatus = message.payload;
                // Auto-clear status when complete
                if (message.payload.status === 'complete' || message.payload.status === 'idle') {
                  debugLog('✅ Status complete/idle - will clear shortly');
                  setTimeout(() => {
                    setState(s => ({ ...s, currentStatus: null }));
                  }, 2000);
                }
                break;

              case 'chat_message':
                // Non-ephemeral assistant messages are terminal responses for the
                // current turn (for example, the plan proposal after
                // "Analyzing presentation strategy..."). Clear the working pulse so
                // it cannot remain pinned below the actual response/action card.
                if ((message.payload as any).ephemeral !== true) {
                  newState.currentStatus = null;
                }
                break;

              case 'action_request':
                // Action cards mean Director is waiting on the user, not still
                // thinking. Without this, a prior status_update can leave the chat
                // stuck visually on the old "Analyzing..." pulse.
                newState.currentStatus = null;
                break;

              case 'sync_response':
                // Sync protocol response - Director confirms whether to skip history
                debugLog('🔄 Sync response received:', {
                  action: message.payload.action,
                  message_count: message.payload.message_count,
                  current_state: message.payload.current_state,
                  has_strawman: message.payload.has_strawman,
                  presentation_url: message.payload.presentation_url,
                  presentation_id: message.payload.presentation_id
                });
                // Resilience: a deck can finish while the socket is down (WS churn during
                // a long reuse/build). Promote sync_response URLs to final only when
                // Director says the durable session state is content-generated/complete;
                // blank/strawman reconnect URLs must remain previews.
                {
                  const recovery = applyFinalSyncRecovery(
                    newState,
                    message.payload,
                    sessionIdRef.current,
                  );
                  if (recovery.didRecover) {
                    Object.assign(newState, recovery.state);
                    debugLog('🔁 Restored finished presentation from sync_response (reconnect repaint)');

                    if (recovery.didChangeDisplayedDeck && options.onPresentationReady && newState.finalPresentationUrl) {
                      options.onPresentationReady(newState.finalPresentationUrl);
                    }

                    if (recovery.didChangeDisplayedDeck && options.onSessionStateChange && newState.finalPresentationUrl) {
                      options.onSessionStateChange({
                        presentationUrl: newState.finalPresentationUrl,
                        presentationId: newState.finalPresentationId ?? undefined,
                        slideCount: newState.slideCount ?? undefined,
                        currentStage: 6,
                        activeVersion: 'final',
                      });
                    }
                  }
                }
                break;

              case 'presentation_url':
                debugLog('🎯 Final presentation URL received:', message.payload.url);

                // Extended-generation builds (Phase 4a) emit one ephemeral
                // "Building slide N/M…" progress bubble per slide, then close the
                // turn with presentation_url — NOT a strawman slide_update. Mirror
                // the slide_update fade trigger here so those bubbles fade out
                // instead of lingering. Guarded on length so it's a no-op in the
                // standard path, where the strawman slide_update already drained
                // the tracked ids.
                if (prev.ephemeralMessageIds.length > 0) {
                  newState.ephemeralFadeToken = prev.ephemeralFadeToken + 1;
                }

                newState.finalPresentationUrl = message.payload.url;
                newState.finalPresentationId = message.payload.presentation_id;
                newState.deckOwnerSessionId = sessionIdRef.current;
                newState.isBlankPresentation = false;

                // Automatically switch to final version when it arrives
                newState.activeVersion = 'final';
                newState.presentationUrl = message.payload.url;
                newState.presentationId = message.payload.presentation_id;
                newState.slideCount = message.payload.slide_count;

                // Clear loading state - final presentation is complete
                debugLog('✅ Final presentation received - clearing loading state, switching to final version');
                newState.currentStatus = null;

                // Trigger callbacks
                if (options.onPresentationReady) {
                  options.onPresentationReady(message.payload.url);
                }

                // Notify session state change for persistence
                if (options.onSessionStateChange) {
                  debugLog('🔔 Calling onSessionStateChange for FINAL presentation:', {
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
                    debugLog('✅ onSessionStateChange completed (final)');
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
                debugLog('🆕 presentation_init received:', JSON.stringify(message.payload, null, 2));

                const initUrl = message.payload.presentation_url ||
                                message.payload.preview_url ||
                                message.payload.url ||
                                message.payload.metadata?.preview_url ||
                                message.payload.metadata?.presentation_url;
                const initId = message.payload.presentation_id ||
                               message.payload.preview_presentation_id ||
                               message.payload.metadata?.preview_presentation_id ||
                               message.payload.metadata?.presentation_id;

                debugLog('🆕 Blank presentation received (presentation_init):', { initUrl, initId });

                if (initUrl) {
                  newState.blankPresentationUrl = initUrl;
                  newState.blankPresentationId = initId || null;
                  newState.isBlankPresentation = true;

                  // Guard: a blank canvas must NOT clobber a real deck we already have
                  // (one restored from the session record on reload, a finished build, or
                  // a strawman). Otherwise reconnect → blank overwrites the deck → blank RHS.
                  // Only switch the active view + persist when there's no real deck yet.
                  const heldDeck = !!(prev.finalPresentationUrl || prev.strawmanPreviewUrl || prev.presentationUrl);
                  const hasRealDeck = heldDeck && prev.deckOwnerSessionId === sessionIdRef.current;
                  if (hasRealDeck) {
                    debugLog('⚠️ presentation_init: keeping existing deck, not switching to blank');
                  } else {
                    newState.activeVersion = 'blank';
                    newState.presentationUrl = initUrl;
                    newState.presentationId = initId || null;
                    newState.strawmanPreviewUrl = null;
                    newState.strawmanPresentationId = null;
                    newState.finalPresentationUrl = null;
                    newState.finalPresentationId = null;
                    newState.deckOwnerSessionId = sessionIdRef.current;
                    newState.slideStructure = null;
                    newState.slideCount = null;

                    debugLog('✅ Blank presentation ready - all editing tools now active');

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
                }
                break;
              }

              case 'slide_update':
                debugLog('📊 Slide update received, full payload:', JSON.stringify(message.payload, null, 2));
                newState.slideStructure = message.payload;

                if (
                  message.payload.operation === 'full_update' &&
                  !message.payload.is_blank &&
                  prev.ephemeralMessageIds.length > 0
                ) {
                  newState.ephemeralFadeToken = prev.ephemeralFadeToken + 1;
                }

                // Legacy: Handle blank presentation sent as slide_update with is_blank flag
                // (kept for backward compatibility, but Director now sends presentation_init instead)
                if (message.payload.is_blank) {
                  const blankUrl = message.payload.preview_url ||
                                   message.payload.metadata?.preview_url;
                  const blankId = message.payload.metadata?.preview_presentation_id ||
                                  message.payload.preview_presentation_id;

                  debugLog('🆕 Blank presentation received (legacy slide_update):', { blankUrl, blankId });

                  if (blankUrl) {
                    // Set blank presentation state
                    newState.blankPresentationUrl = blankUrl;
                    newState.blankPresentationId = blankId || null;
                    newState.isBlankPresentation = true;

                    // Set as current presentation (blank is the starting point)
                    newState.activeVersion = 'blank';
                    newState.presentationUrl = blankUrl;
                    newState.presentationId = blankId || null;
                    newState.strawmanPreviewUrl = null;
                    newState.strawmanPresentationId = null;
                    newState.finalPresentationUrl = null;
                    newState.finalPresentationId = null;
                    newState.deckOwnerSessionId = sessionIdRef.current;
                    newState.slideStructure = null;
                    newState.slideCount = null;

                    debugLog('✅ Blank presentation ready - all editing tools now active');

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
                                   (message.payload as any).strawman?.preview_url ||
                                   (message.payload as any).url;  // Sometimes sent as just 'url'

                // Extract presentation ID for strawman downloads (Stage 4)
                // Director v3.4 sends this in metadata object (per PREVIEW_PRESENTATION_ID_FIX.md)
                const previewPresentationId = message.payload.metadata?.preview_presentation_id ||
                                              message.payload.preview_presentation_id ||
                                              (message.payload as any).strawman?.preview_presentation_id ||
                                              (message.payload as any).presentation_id;

                if (previewUrl) {
                  debugLog('✅ Found strawman preview URL:', previewUrl);
                  debugLog('🖼️ Setting strawmanPreviewUrl and displaying preview IMMEDIATELY');
                  newState.strawmanPreviewUrl = previewUrl;
                  newState.strawmanPresentationId = previewPresentationId || null;
                  newState.deckOwnerSessionId = sessionIdRef.current;
                  newState.isBlankPresentation = false;

                  // Set activeVersion to strawman and update presentationUrl to display it
                  newState.activeVersion = 'strawman';
                  newState.presentationUrl = previewUrl;
                  newState.presentationId = previewPresentationId || null;

                  // Clear loading state - strawman generation is complete
                  debugLog('✅ Strawman received - clearing loading state');
                  newState.currentStatus = null;

                  // Set presentation ID if found (enables download buttons)
                  if (previewPresentationId) {
                    debugLog('✅ Found strawman presentation_id:', previewPresentationId);
                  } else {
                    debugLog('⚠️ No preview_presentation_id found - download buttons will be disabled');
                  }

                  // Trigger callback for preview
                  if (options.onPresentationReady) {
                    options.onPresentationReady(previewUrl);
                  }

                  // Notify session state change for persistence
                  if (options.onSessionStateChange) {
                    debugLog('🔔 Calling onSessionStateChange for STRAWMAN:', {
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
                      debugLog('✅ onSessionStateChange completed (strawman)');
                    } catch (error) {
                      console.error('❌ onSessionStateChange threw error (strawman):', error);
                    }
                  } else {
                    console.warn('⚠️ onSessionStateChange NOT defined for strawman!');
                  }
                } else {
                  debugLog('⚠️ No preview URL found in slide_update message');
                  debugLog('Checked locations: payload.preview_url, metadata.preview_url, strawman.preview_url, payload.url');
                }
                break;

              case 'slide_context': {
                const ctx = message.payload;
                const byIndex: Record<number, SlideContextItem> = {};
                for (const s of ctx.slides ?? []) {
                  if (typeof s.slide_index === 'number') byIndex[s.slide_index] = s;
                }
                newState.slideContextByIndex = byIndex;
                newState.deckContext = ctx.deck ?? null;
                debugLog('📚 slide_context received:', {
                  slides: ctx.slides?.length,
                  deckArc: ctx.deck?.deck_arc?.slice(0, 60),
                });
                break;
              }

              case 'token_usage':
                newState.tokenUsage = message.payload;
                newState.tokenUsageMessageId = message.message_id;
                debugLog('🧮 token_usage received:', {
                  action: message.payload.action_type,
                  turnTotal: message.payload.turn?.total_tokens,
                  sessionTotal: message.payload.session?.total_tokens,
                  coverage: message.payload.coverage,
                });
                break;

              case 'slide_ready':
                debugLog('✅ slide_ready received:', {
                  job_id: message.payload.job_id,
                  slide_index: message.payload.slide_index,
                  presentation_id: message.payload.presentation_id,
                });
                break;

              case 'slide_progress':
                debugLog('🧵 slide_progress received:', {
                  job_id: message.payload.job_id,
                  stage: message.payload.stage,
                  text: message.payload.text,
                });
                break;

              case 'slide_failed':
                debugLog('❌ slide_failed received:', {
                  job_id: message.payload.job_id,
                  stage: message.payload.stage,
                  errors: message.payload.errors,
                });
                break;

              default:
                break;
            }

            return newState;
          });

          if (message.type === 'slide_progress') {
            options.onSlideComposeProgress?.(message);
          } else if (message.type === 'slide_ready') {
            options.onSlideComposeReady?.(message);
          } else if (message.type === 'slide_failed') {
            options.onSlideComposeFailed?.(message);
          }

          // Trigger message callback
          if (options.onMessage) {
            options.onMessage(message);
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        if (!isCurrentSocket()) {
          debugLog('⏭️ Ignoring error from stale WebSocket');
          return;
        }

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

      ws.onclose = (event) => {
        if (!isCurrentSocket()) {
          debugLog('⏭️ Ignoring close from stale WebSocket', {
            code: event.code,
            reason: event.reason || '(no reason provided)',
            wasClean: event.wasClean,
            current_session_id: sessionIdRef.current,
          });
          return;
        }

        const now = Date.now();
        const suppressedSinceLastLog = suppressedCloseDiagnosticsRef.current;

        if (now - lastCloseDiagnosticAtRef.current > 5000) {
          console.warn('🔌 WebSocket connection closed', {
            code: event.code,
            reason: event.reason || '(no reason provided)',
            wasClean: event.wasClean,
            session_id: sessionIdRef.current,
            ready_state: ws.readyState,
            suppressed_close_logs: suppressedSinceLastLog,
          });
          lastCloseDiagnosticAtRef.current = now;
          suppressedCloseDiagnosticsRef.current = 0;
        } else {
          suppressedCloseDiagnosticsRef.current += 1;
          debugLog('🔌 WebSocket connection closed', {
            code: event.code,
            reason: event.reason || '(no reason provided)',
            wasClean: event.wasClean,
            session_id: sessionIdRef.current,
          });
        }

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

          debugLog(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

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
    debugLog('🔌 Disconnecting WebSocket');

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

  // Send message to server (v4.14: includes feature flags and session-sticky file state)
  const sendMessage = useCallback((
    text: string,
    storeName?: string,
    fileCount?: number,
    options?: {
      deepResearch?: boolean;
      webSearch?: boolean;
      extendedGeneration?: boolean;
      fileUpload?: boolean;
      storeName?: string | null;
      useKnowledgeGraph?: boolean;
      theme?: BuildThemeSelection;
      // Template Builder (reuse): set when a saved template is locked in.
      templateMode?: boolean;
      templateId?: string | null;
      elementOverrides?: TemplateOverrides;
      actionValue?: string;
      actionLabel?: string;
    },
  ): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('❌ Cannot send message: WebSocket not connected');
      return false;
    }

    try {
      // Session-sticky store_name: prefer options.storeName (from session state) over positional param
      const effectiveStoreName = options?.storeName !== undefined ? options.storeName : (storeName || null);

      const message: UserMessage = {
        type: 'user_message',
        data: {
          text,
          store_name: effectiveStoreName,
          ...(effectiveStoreName && { file_count: fileCount || 0 }),
          deep_research: options?.deepResearch ?? false,
          web_search: options?.webSearch ?? false,
          extended_generation: options?.extendedGeneration ?? true,
          file_upload: options?.fileUpload ?? !!effectiveStoreName,
          ...(options?.useKnowledgeGraph && { use_knowledge_graph: true }),
          ...(options?.theme && { theme: options.theme }),
          ...(options?.templateMode && { template_mode: true }),
          ...(options?.templateId && { template_id: options.templateId }),
          ...(options?.elementOverrides && { element_overrides: options.elementOverrides }),
          ...(options?.actionValue && { action_value: options.actionValue }),
          ...(options?.actionLabel && { action_label: options.actionLabel }),
        },
      };

      debugLog(
        '📤 Sending message:',
        text,
        effectiveStoreName ? `with File Search Store: ${effectiveStoreName} (${fileCount || 0} files)` : '',
        `[deep_research=${message.data.deep_research}, web_search=${message.data.web_search}, extended_generation=${message.data.extended_generation}, file_upload=${message.data.file_upload}, use_knowledge_graph=${message.data.use_knowledge_graph ?? false}, theme=${message.data.theme?.mode ?? 'none'}, template_overrides=${message.data.element_overrides ? Object.keys(message.data.element_overrides).length : 0}, action=${message.data.action_value ?? 'none'}]`
      );
      wsRef.current.send(JSON.stringify(message));

      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }, []);

  const sendControlMessage = useCallback((type: ControlMessage['type']): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('❌ Cannot send control message: WebSocket not connected');
      return false;
    }

    try {
      const message: ControlMessage = { type };
      debugLog('📤 Sending control message:', type);
      wsRef.current.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send control message:', error);
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

      debugLog(`🔄 Switching to ${version} version:`, {
        presentationUrl: newPresentationUrl || '(none)',
        presentationId: newPresentationId || '(none)'
      });

      return {
        ...prev,
        activeVersion: newActiveVersion,
        presentationUrl: newPresentationUrl,
        presentationId: newPresentationId,
        deckOwnerSessionId: newPresentationUrl ? (prev.deckOwnerSessionId || sessionIdRef.current) : prev.deckOwnerSessionId
      };
    });
  }, [setStateWithCache]);

  // Drain tracked ephemeral message IDs after MessageList finishes the fade-out animation.
  const clearEphemeralIds = useCallback(() => {
    setStateWithCache(prev => ({ ...prev, ephemeralMessageIds: [] }));
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
      deckOwnerSessionId: null,
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
      slideContextByIndex: null,
      deckContext: null,
      ephemeralMessageIds: [],
      ephemeralFadeToken: 0,
      tokenUsage: null,
      tokenUsageMessageId: null,
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
    debugLog(`🔄 Restoring ${historicalMessages.length} messages from database`);
    debugLog(`📊 Restoration data:`, {
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

    debugLog(`✅ Determined activeVersion: ${activeVersion} (display URL: ${displayUrl ? 'present' : 'none'})`);
    const restoredDeckOwnerSessionId = (
      displayUrl ||
      sessionState?.blankPresentationUrl ||
      sessionState?.strawmanPreviewUrl ||
      sessionState?.finalPresentationUrl
    ) ? sessionIdRef.current : null;

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
      deckOwnerSessionId: restoredDeckOwnerSessionId,
      // NEW: Blank presentation state (Builder V2)
      blankPresentationUrl: sessionState?.blankPresentationUrl || null,
      blankPresentationId: sessionState?.blankPresentationId || null,
      isBlankPresentation: sessionState?.isBlankPresentation || false,
      activeVersion: activeVersion,
      slideCount: sessionState?.slideCount || null,
      slideStructure: sessionState?.slideStructure || null,
      currentStage: sessionState?.currentStage || null,
      currentStatus: null, // Always clear status on session restore
      ephemeralMessageIds: [],
      ephemeralFadeToken: 0,
      tokenUsage: (sessionState as any)?.tokenUsage || null,
      tokenUsageMessageId: (sessionState as any)?.tokenUsageMessageId || null,
    }));
  }, [setStateWithCache]);

  // Auto-connect on mount (only once)
  useEffect(() => {
    debugLog('🚀 WebSocket Hook Mounted', {
      autoConnect: options.autoConnect,
      hasConnected: hasConnectedRef.current,
      isConnecting: isConnectingRef.current,
      sessionId: sessionIdRef.current,
      userId: userIdRef.current
    });

    if (options.autoConnect !== false && !hasConnectedRef.current && !isConnectingRef.current) {
      debugLog('🎯 Initiating connection...');
      connect();
    } else {
      debugLog('⏭️ Skipping auto-connect:', {
        autoConnect: options.autoConnect,
        hasConnected: hasConnectedRef.current,
        isConnecting: isConnectingRef.current
      });
    }

    return () => {
      debugLog('🧹 WebSocket Hook Unmounting');
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Update user messages in session cache (called from page.tsx when user messages are loaded/updated)
  // This is critical for the sync protocol to work correctly - skip_history needs to know about user messages
  const updateCacheUserMessages = useCallback((
    userMessages: Array<{ id: string; text: string; timestamp: number }>
  ) => {
    debugLog('💾 Updating cache with user messages:', userMessages.length);

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
    sendControlMessage,
    clearMessages,
    clearEphemeralIds,
    restoreMessages,
    switchVersion,
    updateCacheUserMessages,

    // Utility
    isReady: state.connected,
  };
}
