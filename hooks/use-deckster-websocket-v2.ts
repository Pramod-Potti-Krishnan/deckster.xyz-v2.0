import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './use-auth';

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
  presentationUrl: string | null;
  presentationId: string | null;
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

  if (!sessionIdRef.current) {
    // Use existing session ID if provided, otherwise generate new one
    sessionIdRef.current = options.existingSessionId || crypto.randomUUID();
  }

  if (!userIdRef.current) {
    // Use authenticated user ID or mock user ID or generate one
    userIdRef.current = user?.id || user?.email || `user_${Date.now()}`;
  }

  const [state, setState] = useState<UseDecksterWebSocketV2State>({
    connected: false,
    connecting: false,
    connectionState: 'disconnected',
    sessionId: sessionIdRef.current,
    userId: userIdRef.current,
    error: null,
    messages: [],
    presentationUrl: null,
    presentationId: null,
    slideCount: null,
    currentStatus: null,
    slideStructure: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
  const reconnectDelay = options.reconnectDelay ?? 3000;
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

          setState(prev => {
            // Prevent duplicate messages by checking message_id
            const isDuplicate = prev.messages.some(m => m.message_id === message.message_id);

            const newState = {
              ...prev,
              messages: isDuplicate ? prev.messages : [...prev.messages, messageWithTimestamp],
            };

            // Handle specific message types
            switch (message.type) {
              case 'status_update':
                newState.currentStatus = message.payload;
                break;

              case 'presentation_url':
                console.log('🎯 Final presentation URL received:', message.payload.url);
                newState.presentationUrl = message.payload.url;
                newState.presentationId = message.payload.presentation_id;
                newState.slideCount = message.payload.slide_count;

                // Clear loading state - final presentation is complete
                console.log('✅ Final presentation received - clearing loading state');
                newState.currentStatus = null;

                // Trigger callbacks
                if (options.onPresentationReady) {
                  options.onPresentationReady(message.payload.url);
                }

                // Notify session state change for persistence
                if (options.onSessionStateChange) {
                  options.onSessionStateChange({
                    presentationUrl: message.payload.url,
                    presentationId: message.payload.presentation_id,
                    slideCount: message.payload.slide_count,
                    currentStage: 6, // Stage 6 - final presentation
                  });
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
                  console.log('🖼️ Setting presentationUrl to display preview IMMEDIATELY');
                  newState.presentationUrl = previewUrl;

                  // Clear loading state - strawman generation is complete
                  console.log('✅ Strawman received - clearing loading state');
                  newState.currentStatus = null;

                  // Set presentation ID if found (enables download buttons)
                  if (previewPresentationId) {
                    console.log('✅ Found strawman presentation_id:', previewPresentationId);
                    newState.presentationId = previewPresentationId;
                  } else {
                    console.log('⚠️ No preview_presentation_id found - download buttons will be disabled');
                  }

                  // Trigger callback for preview
                  if (options.onPresentationReady) {
                    options.onPresentationReady(previewUrl);
                  }

                  // Notify session state change for persistence
                  if (options.onSessionStateChange) {
                    options.onSessionStateChange({
                      presentationUrl: previewUrl,
                      presentationId: previewPresentationId || undefined,
                      slideCount: message.payload.slides?.length || undefined,
                      currentStage: 4, // Stage 4 - strawman preview
                    });
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

  // Send message to server
  const sendMessage = useCallback((text: string): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('❌ Cannot send message: WebSocket not connected');
      return false;
    }

    try {
      const message: UserMessage = {
        type: 'user_message',
        data: { text },
      };

      console.log('📤 Sending message:', text);
      wsRef.current.send(JSON.stringify(message));

      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }, []);

  // Clear messages
  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      presentationUrl: null,
      presentationId: null,
      slideCount: null,
      currentStatus: null,
      slideStructure: null,
    }));
  }, []);

  // Restore messages from database (for session loading)
  const restoreMessages = useCallback((historicalMessages: DirectorMessage[], sessionState?: {
    presentationUrl?: string | null;
    presentationId?: string | null;
    slideCount?: number | null;
    slideStructure?: any;
  }) => {
    console.log(`🔄 Restoring ${historicalMessages.length} messages from database`);

    setState(prev => ({
      ...prev,
      messages: historicalMessages,
      presentationUrl: sessionState?.presentationUrl || prev.presentationUrl,
      presentationId: sessionState?.presentationId || prev.presentationId,
      slideCount: sessionState?.slideCount || prev.slideCount,
      slideStructure: sessionState?.slideStructure || prev.slideStructure,
    }));
  }, []);

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

    // Utility
    isReady: state.connected,
  };
}
