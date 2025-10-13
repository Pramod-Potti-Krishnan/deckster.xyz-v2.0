import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './use-auth';

// Director v2.0 Message Types (based on FRONTEND_INTEGRATION.md)

export interface BaseMessage {
  message_id: string;
  session_id: string;
  timestamp: string;
  type: 'chat_message' | 'action_request' | 'status_update' | 'presentation_url' | 'state_change';
  payload: any;
}

export interface ChatMessage extends BaseMessage {
  type: 'chat_message';
  payload: {
    text: string;
    sub_title?: string;
    list_items?: string[];
    format?: 'markdown' | 'plain';
  };
}

export interface ActionRequest extends BaseMessage {
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

export interface StatusUpdate extends BaseMessage {
  type: 'status_update';
  payload: {
    status: 'idle' | 'thinking' | 'generating' | 'complete' | 'error';
    text: string;
    progress?: number;
    estimated_time?: number;
  };
}

export interface PresentationURL extends BaseMessage {
  type: 'presentation_url';
  payload: {
    url: string;
    presentation_id: string;
    slide_count: number;
    message: string;
  };
}

export interface StateChange extends BaseMessage {
  type: 'state_change';
  new_state: string;
  previous_state: string;
}

export type DirectorMessage = ChatMessage | ActionRequest | StatusUpdate | PresentationURL | StateChange;

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
}

// Hook options
export interface UseDecksterWebSocketV2Options {
  autoConnect?: boolean;
  reconnectOnError?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  onError?: (error: Error) => void;
  onMessage?: (message: DirectorMessage) => void;
  onPresentationReady?: (url: string) => void;
}

const DEFAULT_WS_URL = 'wss://directorv20-production.up.railway.app/ws';

export function useDecksterWebSocketV2(options: UseDecksterWebSocketV2Options = {}) {
  const { user } = useAuth();

  // Generate stable session and user IDs
  const sessionIdRef = useRef<string>();
  const userIdRef = useRef<string>();

  if (!sessionIdRef.current) {
    sessionIdRef.current = crypto.randomUUID();
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
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
  const reconnectDelay = options.reconnectDelay ?? 3000;

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
      console.log(`🔌 Connecting to Director v2.0: ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Connected to Director v2.0');
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        hasConnectedRef.current = true;

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
          const message: DirectorMessage = JSON.parse(event.data);
          console.log('📨 Received message:', message.type, message);

          setState(prev => {
            const newState = {
              ...prev,
              messages: [...prev.messages, message],
            };

            // Handle specific message types
            switch (message.type) {
              case 'status_update':
                newState.currentStatus = message.payload;
                break;

              case 'presentation_url':
                newState.presentationUrl = message.payload.url;
                newState.presentationId = message.payload.presentation_id;
                newState.slideCount = message.payload.slide_count;

                // Trigger callback
                if (options.onPresentationReady) {
                  options.onPresentationReady(message.payload.url);
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

        setState(prev => ({
          ...prev,
          connected: false,
          connecting: false,
          connectionState: 'disconnected',
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
  }, [options, reconnectDelay, maxReconnectAttempts]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting WebSocket');

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
  }, []);

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

    // Utility
    isReady: state.connected,
  };
}
