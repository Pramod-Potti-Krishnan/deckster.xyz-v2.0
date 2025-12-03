"use client"

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useDecksterWebSocketV2, type DirectorMessage, type ChatMessage as V2ChatMessage, type ActionRequest, type StatusUpdate, type PresentationURL, type SlideUpdate } from "@/hooks/use-deckster-websocket-v2"
import { useChatSessions } from "@/hooks/use-chat-sessions"
import { useSessionPersistence } from "@/hooks/use-session-persistence"
import ReactMarkdown from 'react-markdown'
import { WebSocketErrorBoundary } from "@/components/error-boundary"
import { ConnectionError } from "@/components/connection-error"
import { PresentationViewer } from "@/components/presentation-viewer"
import { SlideBuildingLoader } from "@/components/slide-building-loader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { Textarea } from "@/components/ui/textarea"
import { ChatHistorySidebar } from "@/components/chat-history-sidebar"
import {
  Sparkles,
  Settings,
  Menu,
  History,
  Send,
  ExternalLink,
  Loader2,
  Bot,
  User,
} from "lucide-react"
import Link from "next/link"
import { OnboardingModal } from "@/components/onboarding-modal"
import { PresentationDownloadControls } from "@/components/presentation-download-controls"
import { FileUploadButton } from '@/components/file-upload-button'
import { FileChip } from '@/components/file-chip'
import { useFileUpload } from '@/hooks/use-file-upload'
import { features } from '@/lib/config'
import { FormatPanel } from '@/components/format-panel'
import { SlideLayoutId } from '@/components/slide-layout-picker'
import { TextBoxFormatPanel } from '@/components/textbox-format-panel'
import { TextBoxFormatting } from '@/components/presentation-viewer'
import { ElementFormatPanel } from '@/components/element-format-panel'
import { ElementType, ElementProperties } from '@/types/elements'

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

function BuilderContent() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Session management
  const { loadSession, createSession } = useChatSessions()

  // CRITICAL FIX: Initialize session ID from URL parameter on first mount
  // This prevents WebSocket from generating a new ID while database session is loading
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    // Try to get session_id from URL on initial render
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlSessionId = params.get('session_id')
      if (urlSessionId && urlSessionId !== 'new') {
        console.log('🔍 Detected session ID from URL on mount:', urlSessionId)
        return urlSessionId
      }
    }
    return null
  })
  const currentSessionIdRef = useRef(currentSessionId)
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [showChatHistory, setShowChatHistory] = useState(false)

  // Track if this is a resumed session with existing messages
  // If true, we DON'T auto-connect WebSocket (to avoid duplicate welcome messages)
  const [isResumedSession, setIsResumedSession] = useState(false)

  // Track if this is a brand new session (not yet saved to database)
  // We only save to database when user sends first message
  const [isUnsavedSession, setIsUnsavedSession] = useState(false)

  // Session persistence (enabled regardless of WebSocket state to prevent message loss)
  // CRITICAL: Must be declared BEFORE useDecksterWebSocketV2 so the onSessionStateChange callback can reference it
  const persistence = useSessionPersistence({
    sessionId: currentSessionId || '',
    enabled: !!currentSessionId, // Persist even when WebSocket disconnected
    debounceMs: 500, // Reduce from default 3000ms to prevent loss on page close
    onError: (error) => {
      console.error('Persistence error:', error)
    }
  })

  // CRITICAL FIX: Use ref to avoid stale closure in onSessionStateChange callback
  // The callback is created once when the component mounts, but persistence changes when session is created
  // Without this ref, the callback would always reference the initial persistence object (enabled: false)
  const persistenceRef = useRef(persistence)
  useEffect(() => {
    persistenceRef.current = persistence
  }, [persistence])

  // CRITICAL FIX: Use ref to avoid stale closure for currentSessionId
  // Same issue as persistence - the callback captures currentSessionId at mount (null for unsaved sessions)
  // When the database session is created, currentSessionId updates, but the callback still has the old value
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  // WebSocket v2 integration with session support
  // CRITICAL: Pass existingSessionId to enable Director's session restoration feature
  // When reconnecting to existing sessions, Director will restore full conversation history
  const {
    connected,
    connecting,
    connectionState,
    error: wsError,
    messages,
    presentationUrl,
    presentationId,
    slideCount,
    currentStatus,
    slideStructure,
    strawmanPreviewUrl,
    finalPresentationUrl,
    strawmanPresentationId,
    finalPresentationId,
    activeVersion,
    sendMessage,
    clearMessages,
    restoreMessages,
    switchVersion,
    connect,
    disconnect,
    isReady,
    sessionId: wsSessionId,
    updateCacheUserMessages
  } = useDecksterWebSocketV2({
    autoConnect: false, // We'll control connection manually
    existingSessionId: currentSessionId || undefined, // Use database session ID for WebSocket
    reconnectOnError: false,
    maxReconnectAttempts: 0,
    reconnectDelay: 5000,
    onSessionStateChange: (state) => {
      // Session state changed - update metadata in database
      console.log('🔔 CALLBACK INVOKED!', {
        currentSessionId: currentSessionIdRef.current,
        hasPersistence: !!persistenceRef.current,
        persistenceEnabled: persistenceRef.current?.enabled,
        currentStage: state.currentStage,
        hasUrl: !!state.presentationUrl,
        hasPresentationId: !!state.presentationId
      });

      // CRITICAL: Use refs to avoid stale closure
      if (currentSessionIdRef.current && persistenceRef.current) {
        // FIXED: Use currentStage to determine which URL fields to update
        // Stage 4 = strawman, Stage 6 = final presentation
        const isStrawman = state.currentStage === 4
        const isFinal = state.currentStage === 6

        const updates: any = {
          currentStage: state.currentStage,
          slideCount: state.slideCount,
          lastMessageAt: new Date(),
          // CRITICAL FIX: Save activeVersion to persist user's presentation choice
          stateCache: {
            activeVersion: state.activeVersion,
            slideStructure: state.slideStructure
          }
        }

        if (isStrawman) {
          // Update strawman-specific fields
          updates.strawmanPreviewUrl = state.presentationUrl
          updates.strawmanPresentationId = state.presentationId
          console.log('💾 Saving strawman URLs:', { url: state.presentationUrl, id: state.presentationId, activeVersion: state.activeVersion })
        } else if (isFinal) {
          // Update final-specific fields
          updates.finalPresentationUrl = state.presentationUrl
          updates.finalPresentationId = state.presentationId
          console.log('💾 Saving final URLs:', { url: state.presentationUrl, id: state.presentationId, activeVersion: state.activeVersion })

          // NOTE: isGeneratingFinal state is now cleared via useEffect (lines 154-161)
          // This ensures proper React state synchronization instead of calling setState from callback
        }

        persistenceRef.current.updateMetadata(updates)
      } else {
        console.error('❌ PERSISTENCE BLOCKED:', {
          reason: !currentSessionIdRef.current ? 'No currentSessionId' : 'No persistenceRef.current',
          currentSessionId: currentSessionIdRef.current,
          hasPersistenceRef: !!persistenceRef.current,
          persistenceEnabled: persistenceRef.current?.enabled
        });
      }
    }
  })

  // Local UI state
  const [inputMessage, setInputMessage] = useState("")
  // CRITICAL: Initialize userMessages from sessionStorage cache on mount
  // This is essential for the sync protocol to work correctly - when skip_history=true is sent,
  // we need to have user messages already loaded from cache, not wait for DB load
  const [userMessages, setUserMessages] = useState<Array<{ id: string; text: string; timestamp: number }>>(() => {
    if (typeof window === 'undefined') return [];

    // Get session ID from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');

    if (!sessionId) return [];

    try {
      const cacheKey = `deckster_session_${sessionId}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.userMessages?.length > 0) {
          console.log('⚡ Initialized userMessages from cache:', parsed.userMessages.length);
          return parsed.userMessages;
        }
      }
    } catch (e) {
      console.warn('Failed to restore userMessages from cache:', e);
    }

    return [];
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [pendingActionInput, setPendingActionInput] = useState<{
    action: ActionRequest['payload']['actions'][0];
    messageId: string;
    timestamp: number;
  } | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showFormatPanel, setShowFormatPanel] = useState(false)
  // Text box selection state
  const [showTextBoxPanel, setShowTextBoxPanel] = useState(false)
  const [isTextBoxPanelCollapsed, setIsTextBoxPanelCollapsed] = useState(true)
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)
  const [selectedTextBoxFormatting, setSelectedTextBoxFormatting] = useState<TextBoxFormatting | null>(null)
  // Element selection state (Image, Table, Chart, Infographic, Diagram)
  const [showElementPanel, setShowElementPanel] = useState(false)
  const [isElementPanelCollapsed, setIsElementPanelCollapsed] = useState(true)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [selectedElementType, setSelectedElementType] = useState<ElementType | null>(null)
  const [selectedElementProperties, setSelectedElementProperties] = useState<ElementProperties | null>(null)
  // Layout Service API handlers (set by PresentationViewer when iframe is ready)
  const [layoutServiceApis, setLayoutServiceApis] = useState<{
    getSelectionInfo: () => Promise<{ hasSelection: boolean; selectedText?: string; sectionId?: string; slideIndex?: number } | null>
    updateSectionContent: (slideIndex: number, sectionId: string, content: string) => Promise<boolean>
    sendTextBoxCommand: (action: string, params: Record<string, any>) => Promise<any>
    sendElementCommand: (action: string, params: Record<string, any>) => Promise<any>
  } | null>(null)
  const [isAIRegenerating, setIsAIRegenerating] = useState(false)

  // FIXED: Track when generating final presentation to show loading animation
  const [isGeneratingFinal, setIsGeneratingFinal] = useState(false)
  const [isGeneratingStrawman, setIsGeneratingStrawman] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)

  // File upload state (feature flag controlled)
  const {
    files: uploadedFiles,
    handleFilesSelected,
    removeFile,
    clearAllFiles
  } = useFileUpload({
    sessionId: currentSessionId || '',
    userId: user?.email || '',
    onUploadComplete: (files) => {
      console.log('📎 Files uploaded:', files)
    }
  })

  // FIXED: Clear loading state when final presentation URL arrives
  // Using useEffect ensures proper React state synchronization
  useEffect(() => {
    if (finalPresentationUrl && isGeneratingFinal) {
      setIsGeneratingFinal(false)
      console.log('✅ Final presentation ready - hiding loader')
    }
  }, [finalPresentationUrl, isGeneratingFinal])

  // CRITICAL: Sync user messages to session cache whenever they change
  // This ensures the cache has user messages for the sync protocol (skip_history check)
  useEffect(() => {
    if (userMessages.length > 0) {
      updateCacheUserMessages(userMessages)
    }
  }, [userMessages, updateCacheUserMessages])

  // FIX 9: Retroactive recovery of missing user messages from Director's history
  // When Director sends historical messages with role='user', save them to database
  // This fixes sessions where the first message wasn't saved due to stale closure bug
  useEffect(() => {
    if (!currentSessionId || messages.length === 0) return;

    // Find messages from Director that have role='user' (user messages from history)
    const directorUserMessages = messages.filter((m: any) => m.role === 'user');

    if (directorUserMessages.length === 0) return;

    // Check which of these are missing from our userMessages array
    const existingUserMessageIds = new Set(userMessages.map(um => um.id));
    const existingUserMessageTexts = new Set(userMessages.map(um => um.text.trim().toLowerCase()));

    const missingUserMessages = directorUserMessages.filter((m: any) => {
      const text = m.payload?.text || m.content || '';
      const normalizedText = text.trim().toLowerCase();
      // Check if message already exists by ID or content
      return !existingUserMessageIds.has(m.message_id) && !existingUserMessageTexts.has(normalizedText);
    });

    if (missingUserMessages.length > 0) {
      console.log('🔄 [FIX 9] Recovering missing user messages from Director history:', missingUserMessages.length);

      // Add missing messages to userMessages state
      const recoveredMessages = missingUserMessages.map((m: any) => {
        const text = m.payload?.text || m.content || '';
        return {
          id: m.message_id,
          text: text,
          timestamp: new Date(m.timestamp).getTime()
        };
      });

      // Add to state (will trigger cache sync and DB save via persistence)
      setUserMessages(prev => {
        // Avoid duplicates
        const existingIds = new Set(prev.map(p => p.id));
        const newMessages = recoveredMessages.filter(rm => !existingIds.has(rm.id));
        if (newMessages.length === 0) return prev;

        console.log('✅ [FIX 9] Adding recovered user messages to state:', newMessages.length);
        return [...prev, ...newMessages].sort((a, b) => a.timestamp - b.timestamp);
      });

      // Also save to database via persistence
      if (persistence) {
        missingUserMessages.forEach((m: any) => {
          const text = m.payload?.text || m.content || '';
          console.log('💾 [FIX 9] Saving recovered user message to database:', {
            id: m.message_id,
            text: text.substring(0, 50)
          });
          persistence.queueMessage({
            message_id: m.message_id,
            session_id: currentSessionId,
            timestamp: m.timestamp,
            type: 'chat_message',
            payload: { text }
          } as DirectorMessage, text);
        });
      }

      // Update tracking refs
      missingUserMessages.forEach((m: any) => {
        userMessageIdsRef.current.add(m.message_id);
        const text = m.payload?.text || m.content || '';
        userMessageContentMapRef.current.set(text.trim().toLowerCase(), m.message_id);
      });

      console.log('✅ [FIX 9] Recovery complete - recovered', missingUserMessages.length, 'user messages');
    }
  }, [currentSessionId, messages, userMessages, persistence]);

  // Track if we've generated a title from user message yet
  const hasTitleFromUserMessageRef = useRef(false)
  const hasTitleFromPresentationRef = useRef(false)

  // Track if we've already seen the welcome message (to prevent duplicates on reconnect)
  const hasSeenWelcomeRef = useRef(false)

  // Track sessions we just created to prevent race condition with re-initialization
  const justCreatedSessionRef = useRef<string | null>(null)

  // FIXED: Track last loaded session to prevent duplicate initialization on navigation
  const lastLoadedSessionRef = useRef<string | null>(null)

  // Guard to prevent concurrent executions of handleSendMessage (prevents duplication)
  const isExecutingSendRef = useRef(false)

  // Track user message IDs to distinguish from bot chat_messages
  const userMessageIdsRef = useRef<Set<string>>(new Set())

  // WORKAROUND: Map user message content to IDs to identify Director's historical messages
  // Director sends historical messages without role info, so we match by content
  const userMessageContentMapRef = useRef<Map<string, string>>(new Map())

  // Track which action_request messages have been answered by the user
  // Prevents duplicate action buttons from re-appearing on page refresh
  const answeredActionsRef = useRef<Set<string>>(new Set())

  // Check if user is new and should see onboarding
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const isNewUser = urlParams.get('new') === 'true'

    if (isNewUser && user) {
      setShowOnboarding(true)
      // Remove the query parameter
      window.history.replaceState({}, '', '/builder')
    }
  }, [user])

  // Session initialization - load or create session
  useEffect(() => {
    const initializeSession = async () => {
      // DEBUG: Log entry point with all relevant state
      console.log('🔍 [SESSION-INIT] Effect triggered', {
        hasUser: !!user,
        isAuthLoading,
        currentSessionId,
        isLoadingSession,
        searchParams: searchParams?.toString(),
        windowLocation: typeof window !== 'undefined' ? window.location.search : 'N/A'
      })

      if (!user || isAuthLoading) {
        console.log('⏭️ [SESSION-INIT] Waiting for auth', { hasUser: !!user, isAuthLoading })
        return
      }

      // FIXED: Skip re-initialization if session already loaded and valid
      // Prevents creating new session when auth completes if we already have one
      if (currentSessionId && !isLoadingSession) {
        // DEBUG: Get URL session to verify it matches
        const urlSessionId = searchParams?.get('session_id') ||
                           (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('session_id') : null)

        console.log('✅ [SESSION-GUARD] Session already initialized', {
          currentSessionId,
          urlSessionId,
          matches: urlSessionId === currentSessionId,
          action: urlSessionId === currentSessionId ? 'SKIP' : 'PROCEED'
        })

        // Only skip if URL matches current session
        if (urlSessionId === currentSessionId || !urlSessionId) {
          return
        }

        console.log('⚠️ [SESSION-GUARD] URL session differs from current, will re-initialize', {
          current: currentSessionId,
          url: urlSessionId
        })
      }

      setIsLoadingSession(true)

      // Reset title tracking refs for new/loaded session
      hasTitleFromUserMessageRef.current = false
      hasTitleFromPresentationRef.current = false

      // FIXED: Reset answered actions ref when loading a new session
      // This prevents historical action buttons from being permanently hidden
      answeredActionsRef.current.clear()
      console.log('🔄 Cleared answeredActionsRef for session initialization')

      try {
        // FIXED: Fallback to window.location when searchParams is null during Next.js hydration
        // This prevents race conditions where searchParams is not ready but URL has session_id
        let sessionParam = searchParams?.get('session_id')
        const usedFallback = !sessionParam && typeof window !== 'undefined'

        if (usedFallback) {
          const params = new URLSearchParams(window.location.search)
          sessionParam = params.get('session_id')
          console.log('🔄 [SESSION-PARAM] Using window.location fallback', {
            searchParamsAvailable: !!searchParams,
            sessionParam,
            fullURL: window.location.search
          })
        } else {
          console.log('📍 [SESSION-PARAM] Using searchParams', {
            sessionParam,
            searchParamsValue: searchParams?.toString()
          })
        }

        // FIXED: Early return if URL session matches current session
        // Prevents unnecessary reloading of the same session
        if (sessionParam && sessionParam !== 'new' && sessionParam === currentSessionId) {
          console.log('✅ [SESSION-MATCH] URL session matches current, skipping reload', {
            sessionId: sessionParam,
            reason: 'already loaded'
          })
          setIsLoadingSession(false)
          return
        }

        if (sessionParam && sessionParam !== 'new') {
          console.log('📂 [SESSION-BRANCH] Loading existing session', {
            sessionParam,
            isNew: sessionParam === 'new'
          })
          // FIXED: Skip re-initialization if we already loaded this session
          // This prevents duplicate initialization when searchParams changes (e.g., navigation events)
          if (lastLoadedSessionRef.current === sessionParam) {
            console.log('⏭️ Skipping re-initialization of already-loaded session:', sessionParam)
            setIsLoadingSession(false)
            return
          }

          // Skip re-initialization if we just created this session
          // This prevents race condition where router.push triggers re-init before message is persisted
          if (justCreatedSessionRef.current === sessionParam) {
            console.log('⏭️ Skipping re-initialization of just-created session:', sessionParam)
            justCreatedSessionRef.current = null
            setIsLoadingSession(false)
            return
          }

          // Mark this session as loaded to prevent duplicate initialization
          lastLoadedSessionRef.current = sessionParam

          // Load existing session from URL
          console.log('📂 Loading session from URL:', sessionParam)
          const session = await loadSession(sessionParam)

          if (session) {
            // Validate session is not deleted
            if (session.status === 'deleted') {
              console.warn('⚠️ Attempted to load deleted session, navigating to new chat')
              toast({
                title: "Session unavailable",
                description: "This session has been deleted.",
                variant: "destructive",
              })
              router.push('/builder?session_id=new')
              setIsLoadingSession(false)
              return
            }

            console.log('💾 [SESSION-SET] Setting session ID from database', {
              old: currentSessionId,
              new: session.id
            })
            setCurrentSessionId(session.id)
            console.log('✅ Session loaded successfully')

            // Check if session already has a title
            if (session.title) {
              console.log('📝 Session already has title:', session.title)
              hasTitleFromPresentationRef.current = true // Prevent overwriting existing title
            }

            // Restore messages from database
            if (session.messages && session.messages.length > 0) {
              console.log(`📥 Restoring ${session.messages.length} messages from database`)

              // Separate user messages from bot messages
              const userMsgs: Array<{ id: string; text: string; timestamp: number }> = []
              const botMsgs: DirectorMessage[] = []

              // Track last seen action_request to match with user responses
              let lastActionRequestId: string | null = null

              session.messages.forEach((msg: any) => {
                console.log('📥 Loading message from DB:', {
                  id: msg.id,
                  messageType: msg.messageType,
                  hasUserText: !!msg.userText,
                  userText: msg.userText?.substring(0, 30),
                  timestamp: msg.timestamp
                });

                if (msg.userText) {
                  // User message
                  console.log('👤 Classified as USER message');
                  console.log('👤 Loading user message:', { id: msg.id, text: msg.userText.substring(0, 50), timestamp: msg.timestamp });

                  // FIXED: Don't mark actions as answered during restoration
                  // Actions should only be hidden when user actively clicks them in current session
                  // This allows action buttons to re-appear when navigating back to the page
                  // if (msg.payload?.action_value && lastActionRequestId) {
                  //   answeredActionsRef.current.add(lastActionRequestId)
                  //   console.log(`✅ Restored answered action: ${lastActionRequestId} (answered by user message ${msg.id})`)
                  // }

                  userMsgs.push({
                    id: msg.id,
                    text: msg.userText,
                    timestamp: new Date(msg.timestamp).getTime()
                  })
                } else {
                  // Bot message - convert from DB format to WebSocket format
                  // IMPORTANT: Add clientTimestamp for proper sorting with user messages
                  console.log('🤖 Classified as BOT message');
                  console.log('🤖 Loading bot message:', { id: msg.id, type: msg.messageType, timestamp: msg.timestamp });

                  // Track action_request messages
                  if (msg.messageType === 'action_request') {
                    lastActionRequestId = msg.id
                  }

                  botMsgs.push({
                    message_id: msg.id,
                    session_id: session.id,
                    timestamp: msg.timestamp,
                    type: msg.messageType as any,
                    payload: msg.payload,
                    // FIX: Ensure 'Z' suffix for UTC parsing - timestamps may be stored without timezone indicator
                    clientTimestamp: new Date(
                      msg.timestamp?.endsWith('Z') ? msg.timestamp : msg.timestamp + 'Z'
                    ).getTime()
                  } as any)
                }
              })

              // Restore user messages (cache update handled by useEffect that watches userMessages)
              setUserMessages(userMsgs)

              // FIXED: Repopulate userMessageIdsRef with restored user message IDs
              // This prevents user messages from being misidentified as bot messages
              userMsgs.forEach(msg => {
                userMessageIdsRef.current.add(msg.id)
                console.log('✅ Added to userMessageIdsRef:', msg.id, msg.text.substring(0, 30));
              })
              console.log(`✅ Repopulated userMessageIdsRef with ${userMsgs.length} user message IDs`)
              console.log('📊 Total user message IDs tracked:', userMessageIdsRef.current.size)

              // WORKAROUND: Create content map to identify Director's historical user messages
              // Director sends historical messages without role/userText fields, so we match by content
              userMessageContentMapRef.current.clear(); // Clear previous mappings
              userMsgs.forEach(msg => {
                const normalizedContent = msg.text.trim().toLowerCase();
                userMessageContentMapRef.current.set(normalizedContent, msg.id);
                console.log('🗺️ Mapped user message content:', normalizedContent.substring(0, 30), '→', msg.id);
              })
              console.log('🗺️ Created content map with', userMessageContentMapRef.current.size, 'user messages')

              // Restore bot messages and session state
              // FIXED: Pass both strawman and final URLs separately for version toggle
              const sessionState = {
                presentationUrl: session.finalPresentationUrl || session.strawmanPreviewUrl,
                presentationId: session.finalPresentationId || session.strawmanPresentationId,
                strawmanPreviewUrl: session.strawmanPreviewUrl,
                strawmanPresentationId: session.strawmanPresentationId,
                finalPresentationUrl: session.finalPresentationUrl,
                finalPresentationId: session.finalPresentationId,
                slideCount: session.slideCount,
                slideStructure: (session as any).stateCache?.slideStructure || null,
                currentStage: session.currentStage,
                activeVersion: (session as any).stateCache?.activeVersion || null
              }

              restoreMessages(botMsgs, sessionState)

              // Debug: Log presentation state restoration
              console.log('📊 Restored session state:', {
                presentationUrl: sessionState.presentationUrl || '(none)',
                presentationId: sessionState.presentationId || '(none)',
                strawmanPreviewUrl: sessionState.strawmanPreviewUrl || '(none)',
                finalPresentationUrl: sessionState.finalPresentationUrl || '(none)',
                slideCount: sessionState.slideCount || 0,
                slideStructure: sessionState.slideStructure ? 'present' : 'none',
                currentStage: sessionState.currentStage || '(none)',
                activeVersion: sessionState.activeVersion || '(none)'
              })

              // Mark as resumed session - WILL auto-connect WebSocket (welcome message deduplication handled separately)
              setIsResumedSession(true)
              // Mark that we've seen welcome message (to prevent duplicates when reconnecting)
              hasSeenWelcomeRef.current = true
              console.log(`✅ Restored ${userMsgs.length} user messages and ${botMsgs.length} bot messages (resumed session - will auto-connect)`)
            } else {
              // No messages - treat as new session
              setIsResumedSession(false)
              console.log('📝 Existing session but no messages - will auto-connect')
            }
          } else {
            // Session not found, create new one
            console.warn('⚠️ Session not found, creating new')
            await createNewSession()
          }
        } else {
          // No session in URL - DON'T create database session yet
          // Wait until user sends first message
          console.log('🆕 [SESSION-BRANCH] No session in URL', {
            currentSessionId,
            willClear: !currentSessionId,
            action: currentSessionId ? 'PRESERVE existing' : 'SET to null'
          })

          // CRITICAL FIX: Never clear currentSessionId if it's already set
          // This prevents losing the session ID during hydration delays or navigation
          if (!currentSessionId) {
            console.log('💾 [SESSION-SET] Setting session ID to null (new unsaved session)', {
              old: currentSessionId,
              new: null
            })
            setIsUnsavedSession(true)
            setIsResumedSession(false)
            setCurrentSessionId(null)
          } else {
            console.log('✅ [SESSION-PRESERVE] Keeping existing session ID despite no URL param', {
              currentSessionId,
              reason: 'prevent accidental clearing during hydration'
            })
          }
        }
      } catch (error) {
        console.error('❌ Error initializing session:', error)
        // Fallback: create new session
        await createNewSession()
      } finally {
        setIsLoadingSession(false)
      }
    }

    initializeSession()
  }, [user, isAuthLoading, searchParams])

  // FIXED: Add timeout for isLoadingSession to prevent UI from getting stuck
  useEffect(() => {
    if (isLoadingSession) {
      const timeout = setTimeout(() => {
        console.warn('⏰ isLoadingSession timeout - forcing reset after 10 seconds')
        setIsLoadingSession(false)
      }, 10000) // 10 second timeout

      return () => clearTimeout(timeout)
    }
  }, [isLoadingSession])

  // Helper to create new session
  const createNewSession = async () => {
    // FIXED: Reset last loaded session ref when creating new session
    lastLoadedSessionRef.current = null

    const newSessionId = crypto.randomUUID()
    const session = await createSession(newSessionId)

    if (session) {
      // Clear any existing messages
      setUserMessages([])
      clearMessages()

      // Mark as new session - WILL auto-connect to get welcome message
      setIsResumedSession(false)

      setCurrentSessionId(session.id)
      // Update URL
      router.push(`/builder?session_id=${session.id}`)
      console.log('✅ New session created:', session.id)
    }
  }

  // Handler to create draft session for file uploads (early session creation)
  const handleRequestSession = useCallback(async () => {
    // If session already exists, no-op
    if (currentSessionId) {
      console.log('📎 Session already exists:', currentSessionId)
      return
    }

    setIsCreatingSession(true)

    try {
      console.log('📎 Creating draft session for file upload')
      const newSessionId = crypto.randomUUID()
      const session = await createSession(newSessionId)

      if (session) {
        setCurrentSessionId(session.id)
        setIsUnsavedSession(false)

        // Update URL to include session
        router.push(`/builder?session_id=${session.id}`)

        console.log('✅ Draft session created:', session.id)
      } else {
        throw new Error('Session creation returned null')
      }
    } catch (error) {
      console.error('❌ Error creating draft session:', error)
      throw error // Re-throw so file upload button can show error
    } finally {
      setIsCreatingSession(false)
    }
  }, [currentSessionId, createSession, router])

  // Handle session selection from sidebar
  const handleSessionSelect = useCallback((sessionId: string) => {
    if (sessionId === currentSessionId) return

    console.log('📂 Switching to session:', sessionId)

    // CRITICAL FIX: Clear ALL sessionStorage caches to prevent cross-session pollution
    // This fixes the bug where presentations appear "one session behind"
    const cacheKeys = Object.keys(sessionStorage).filter(key =>
      key.startsWith('deckster_session_')
    )
    cacheKeys.forEach(key => {
      sessionStorage.removeItem(key)
      console.log(`🗑️ Cleared cache: ${key}`)
    })

    // CRITICAL: Clear all state before switching sessions to prevent pollution
    setUserMessages([]) // Clear user messages
    clearMessages() // Clear WebSocket state (messages, presentations, etc.)
    setIsGeneratingFinal(false) // Reset final generation flag
    setIsGeneratingStrawman(false) // Reset strawman generation flag

    setShowChatHistory(false)
    setIsLoadingSession(true)

    // Use router.push for navigation (Next.js will handle state properly)
    router.push(`/builder?session_id=${sessionId}`)
  }, [currentSessionId, router, clearMessages])

  // Handle new chat from sidebar
  const handleNewChat = useCallback(() => {
    console.log('🆕 Starting new unsaved session')
    // Clear messages
    setUserMessages([])
    clearMessages()

    // Mark as unsaved session
    setIsUnsavedSession(true)
    setIsResumedSession(false)
    setCurrentSessionId(null)

    // Remove session_id from URL
    router.push('/builder')
  }, [router, clearMessages])

  // Auto-connect WebSocket for ALL sessions (new, unsaved, and resumed)
  // Welcome message deduplication is handled separately (lines 761-782)
  useEffect(() => {
    // Auto-connect for ANY session with a sessionId
    if (currentSessionId && !isLoadingSession && !connecting && !connected) {
      const sessionType = isResumedSession ? 'RESUMED' : 'NEW'
      console.log(`🔌 Auto-connecting WebSocket for ${sessionType} session:`, currentSessionId)
      connect()
    }
    // Auto-connect for unsaved sessions (no sessionId yet, waiting for first message)
    else if (isUnsavedSession && !isLoadingSession && !connecting && !connected) {
      console.log('🔌 Auto-connecting WebSocket for UNSAVED session (no DB session yet)')
      connect()
    }
  }, [currentSessionId, isLoadingSession, connecting, connected, connect, isResumedSession, isUnsavedSession])

  // Persist bot messages received from WebSocket
  // FIXED: Persist all bot messages including bot chat_messages (welcome messages)
  // FIXED: Also handle Director-replayed user messages with role: 'user' field
  useEffect(() => {
    if (!currentSessionId || !persistence || messages.length === 0) return

    // Get the last message
    const lastMessage = messages[messages.length - 1]

    // FIX: Check if Director is replaying a user message (has role: 'user')
    // These should be saved with userText to be recognized as user messages on reload
    if ((lastMessage as any).role === 'user') {
      const userText = lastMessage.payload?.text || (lastMessage as any).content || '';
      console.log('💾 Persisting Director-replayed user message:', lastMessage.message_id, userText.substring(0, 30))
      // Add to userMessageIdsRef so it's not duplicated
      userMessageIdsRef.current.add(lastMessage.message_id)
      // Persist with userText field
      persistence.queueMessage(lastMessage, userText)
      return
    }

    // Persist non-chat_message types (action_request, slide_update, etc.)
    if (lastMessage.type !== 'chat_message') {
      console.log('💾 Persisting bot message:', lastMessage.type, lastMessage.message_id)
      persistence.queueMessage(lastMessage)
    }
    // For chat_message type, only persist if it's NOT from the user
    // User messages are tracked in userMessageIdsRef and persisted separately with userText
    else if (!userMessageIdsRef.current.has(lastMessage.message_id)) {
      console.log('💾 Persisting bot chat_message (welcome/initial):', lastMessage.message_id)
      persistence.queueMessage(lastMessage)
    }

    // Update session title if this is the first chat message with presentation title
    if (lastMessage.type === 'slide_update') {
      const slideUpdate = lastMessage as SlideUpdate
      const presentationTitle = slideUpdate.payload.metadata.main_title
      if (presentationTitle) {
        console.log('📝 Updating session title from presentation:', presentationTitle)
        persistence.updateMetadata({
          title: presentationTitle
        })
        hasTitleFromPresentationRef.current = true
      }
    }
  }, [messages, currentSessionId, persistence])

  // Update session title from presentation metadata
  useEffect(() => {
    if (!currentSessionId || !persistence || messages.length === 0) return

    const lastMessage = messages[messages.length - 1]

    // Only update title from slide_update messages
    if (lastMessage.type === 'slide_update') {
      const slideUpdate = lastMessage as SlideUpdate
      const presentationTitle = slideUpdate.payload.metadata.main_title
      if (presentationTitle && !hasTitleFromPresentationRef.current) {
        console.log('📝 Updating session title from presentation:', presentationTitle)
        persistence.updateMetadata({
          title: presentationTitle
        })
        hasTitleFromPresentationRef.current = true
      }
    }
  }, [messages, currentSessionId, persistence])

  // Infer current stage from available data
  // Stage 4: slideStructure has slides (strawman generated)
  // Stage 5: slides being refined (we'll use slideCount > 0)
  // Stage 6: presentationUrl is available (final presentation)
  const currentStage = useMemo(() => {
    if (presentationUrl) return 6; // Final presentation ready
    if (slideCount && slideCount > 0) return 5; // Slides being refined
    if (slideStructure && slideStructure.length > 0) return 4; // Strawman ready
    return 3; // Earlier stages (greeting, questions, plan)
  }, [presentationUrl, slideCount, slideStructure])

  // Set strawman generation flag when stage is 4 and no URL yet
  useEffect(() => {
    if (currentStage === 4 && !strawmanPreviewUrl && !isGeneratingStrawman) {
      setIsGeneratingStrawman(true)
      console.log('🎨 Strawman generation started - showing loader')
    }
  }, [currentStage, strawmanPreviewUrl, isGeneratingStrawman])

  // Clear strawman generation flag when URL arrives
  useEffect(() => {
    if (strawmanPreviewUrl && isGeneratingStrawman) {
      setIsGeneratingStrawman(false)
      console.log('✅ Strawman presentation ready - hiding loader')
    }
  }, [strawmanPreviewUrl, isGeneratingStrawman])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, userMessages])

  // Handle sending messages
  const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputMessage.trim()) return

    // GUARD: Check authentication before sending
    if (!user) {
      console.warn('⚠️ Cannot send message: user not authenticated')
      return
    }

    // GUARD: Prevent concurrent executions (fixes React Strict Mode double-execution)
    if (isExecutingSendRef.current) {
      console.log('🚫 Already executing send, skipping duplicate call')
      return
    }

    isExecutingSendRef.current = true

    try {
      const messageText = inputMessage.trim()

      // Handle pending action input
      if (pendingActionInput) {
        const { action, messageId, timestamp } = pendingActionInput

        // Track this as a user message ID
        userMessageIdsRef.current.add(messageId)

        // Add action label message to local state (e.g., "Make changes")
        setUserMessages(prev => [...prev, {
          id: messageId,
          text: action.label,
          timestamp: timestamp
        }])

        // Queue action message for persistence
        if (currentSessionId && persistence) {
          persistence.queueMessage({
            message_id: messageId,
            session_id: currentSessionId,
            timestamp: new Date(timestamp).toISOString(),
            type: 'chat_message',
            payload: { text: action.label, action_value: action.value }
          } as DirectorMessage, action.label)
        }

        // Send the user's typed input (NEW: with File Search Store if files attached)
        const successfulFiles = uploadedFiles.filter(f => f.status === 'success')
        const storeName = successfulFiles.length > 0 ? successfulFiles[0].geminiStoreName : undefined
        const fileCount = successfulFiles.length

        const success = sendMessage(messageText, storeName, fileCount)
        if (success) {
          setInputMessage("")
          setPendingActionInput(null)
          if (successfulFiles.length > 0) {
            clearAllFiles() // Clear uploaded files after sending
          }
        }

        // Reset guard
        setTimeout(() => {
          isExecutingSendRef.current = false
        }, 500)
        return
      }

      // For unsaved sessions, create database session first
      if (isUnsavedSession && !currentSessionId) {
        console.log('💾 Creating database session for first message')
        const newSessionId = wsSessionId // Use existing WebSocket session ID

        try {
          const session = await createSession(newSessionId)

          if (session) {
            // Mark this session as just created to prevent re-initialization race condition
            justCreatedSessionRef.current = session.id
            setCurrentSessionId(session.id)
            setIsUnsavedSession(false)
            // Update URL
            router.push(`/builder?session_id=${session.id}`)
            console.log('✅ Database session created:', session.id)

            // IMPORTANT: Add user message to UI immediately (before sending)
            const messageId = crypto.randomUUID()
            const timestamp = Date.now()

            // Track this as a user message ID
            userMessageIdsRef.current.add(messageId)

            setUserMessages(prev => [...prev, {
              id: messageId,
              text: messageText,
              timestamp: timestamp
            }])

            // FIX 11: Save first message directly via API
            // The persistence hook has stale sessionIdRef (empty string) because
            // setCurrentSessionId() queues a state update that hasn't executed yet.
            // We bypass the hook and call the API directly since we have session.id.
            try {
              const firstMessagePayload = {
                id: messageId,
                messageType: 'chat_message',
                timestamp: new Date(timestamp).toISOString(),
                payload: { text: messageText },
                userText: messageText,
              }

              console.log('💾 [FIX 11] Saving first message directly via API:', {
                sessionId: session.id,
                messageId,
                userText: messageText.substring(0, 30)
              })

              const response = await fetch(`/api/sessions/${session.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [firstMessagePayload] }),
              })

              if (response.ok) {
                const result = await response.json()
                console.log('✅ [FIX 11] First message saved:', result)
              } else {
                console.error('❌ [FIX 11] Failed to save first message:', response.status)
              }

              // Generate and save title from first user message
              if (persistence) {
                const generatedTitle = persistence.generateTitle(messageText)
                console.log('📝 Setting initial title from first message:', generatedTitle)

                // Also save title directly via API (persistence hook may have stale ref)
                await fetch(`/api/sessions/${session.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: generatedTitle }),
                })
                hasTitleFromUserMessageRef.current = true
              }
            } catch (error) {
              console.error('❌ [FIX 11] Error saving first message:', error)
            }

            // Clear input field immediately
            setInputMessage("")

            // FIXED: Send message immediately without artificial delay
            // State has already been updated and message persisted to DB
            const successfulFiles = uploadedFiles.filter(f => f.status === 'success')
            const storeName = successfulFiles.length > 0 ? successfulFiles[0].geminiStoreName : undefined
            const fileCount = successfulFiles.length

            sendMessage(messageText, storeName, fileCount)
            if (successfulFiles.length > 0) {
              clearAllFiles() // Clear uploaded files after sending
            }
            return
          } else {
            console.error('❌ createSession returned null')
            alert('Failed to create session. Please check your connection and try again.')
            return
          }
        } catch (error) {
          console.error('❌ Error creating session:', error)
          alert(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}. Please try refreshing the page.`)
          return
        }
      }

      // For resumed sessions, connect on first message
      if (isResumedSession && !connected && !connecting) {
        console.log('🔌 Connecting WebSocket for first message in resumed session')
        connect()
        // Mark as no longer resumed (we're now actively chatting)
        setIsResumedSession(false)

        // IMPORTANT: Add user message to UI immediately (before sending)
        const messageId = crypto.randomUUID()
        const timestamp = Date.now()

        // Track this as a user message ID
        userMessageIdsRef.current.add(messageId)

        setUserMessages(prev => [...prev, {
          id: messageId,
          text: messageText,
          timestamp: timestamp
        }])

        // Persist user message to database
        if (currentSessionId && persistence) {
          console.log('💾 Persisting user message for resumed session:', messageId)
          persistence.queueMessage({
            message_id: messageId,
            session_id: currentSessionId,
            timestamp: new Date(timestamp).toISOString(),
            type: 'chat_message',
            payload: { text: messageText }
          } as DirectorMessage, messageText)
        }

        // Clear input field immediately
        setInputMessage("")

        // FIXED: Reduced delay from 1000ms to 200ms for better performance
        // WebSocket typically connects in 100-300ms
        // If connection not ready, message is already in UI/DB and user can retry
        const successfulFiles = uploadedFiles.filter(f => f.status === 'success')
        const storeName = successfulFiles.length > 0 ? successfulFiles[0].geminiStoreName : undefined
        const fileCount = successfulFiles.length

        setTimeout(() => {
          sendMessage(messageText, storeName, fileCount)
          if (successfulFiles.length > 0) {
            clearAllFiles() // Clear uploaded files after sending
          }
        }, 200)
        return
      }

      // Normal check for connection
      if (!isReady) return

      const messageId = crypto.randomUUID()
      const timestamp = Date.now()

      // Track this as a user message ID
      userMessageIdsRef.current.add(messageId)

      // Add user message to local state
      setUserMessages(prev => [...prev, {
        id: messageId,
        text: messageText,
        timestamp: timestamp
      }])

      // Queue message for persistence
      if (currentSessionId && persistence) {
        persistence.queueMessage({
          message_id: messageId,
          session_id: currentSessionId,
          timestamp: new Date(timestamp).toISOString(),
          type: 'chat_message',
          payload: { text: messageText }
        } as DirectorMessage, messageText)

        // Generate title from first user message if not already set
        if (!hasTitleFromUserMessageRef.current && !hasTitleFromPresentationRef.current) {
          const generatedTitle = persistence.generateTitle(messageText)
          console.log('📝 Setting initial title from first message:', generatedTitle)
          persistence.updateMetadata({
            title: generatedTitle
          })
          hasTitleFromUserMessageRef.current = true
        }
      }

      const successfulFiles = uploadedFiles.filter(f => f.status === 'success')
      const storeName = successfulFiles.length > 0 ? successfulFiles[0].geminiStoreName : undefined
      const fileCount = successfulFiles.length

      const success = sendMessage(messageText, storeName, fileCount)
      if (success) {
        setInputMessage("")
        if (successfulFiles.length > 0) {
          clearAllFiles() // Clear uploaded files after sending
        }
      }
    } finally {
      // Reset guard after a delay to allow state updates to propagate
      setTimeout(() => {
        isExecutingSendRef.current = false
      }, 500)
    }
  }, [inputMessage, isReady, sendMessage, currentSessionId, persistence, isResumedSession, connected, connecting, connect, isUnsavedSession, createSession, router, uploadedFiles, clearAllFiles])

  // Handle action button clicks
  const handleActionClick = useCallback((action: ActionRequest['payload']['actions'][0], actionRequestMessageId: string) => {
    const messageId = crypto.randomUUID()
    const timestamp = Date.now()

    // Mark this action request as answered (prevent duplicate buttons on refresh)
    answeredActionsRef.current.add(actionRequestMessageId)
    console.log(`✅ Marked action request ${actionRequestMessageId} as answered`)

    if (action.requires_input) {
      // For actions that require input, set state and focus chat input
      setPendingActionInput({ action, messageId, timestamp })

      // Focus the textarea after a brief delay to ensure state is set
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    } else {
      // Track this as a user message ID
      userMessageIdsRef.current.add(messageId)

      // Add user message to local state (show label to user)
      setUserMessages(prev => [...prev, {
        id: messageId,
        text: action.label,
        timestamp: timestamp
      }])

      // Queue action message for persistence
      if (currentSessionId && persistence) {
        persistence.queueMessage({
          message_id: messageId,
          session_id: currentSessionId,
          timestamp: new Date(timestamp).toISOString(),
          type: 'chat_message',
          payload: { text: action.label, action_value: action.value }
        } as DirectorMessage, action.label)
      }

      // FIXED: If accepting strawman, show loading animation for final generation
      if (action.value === 'accept_strawman') {
        setIsGeneratingFinal(true)
        console.log('🎨 Starting final deck generation - showing loader')
      }

      // CRITICAL FIX: Send the action VALUE (not label) to backend
      // Example: sends "accept_strawman" instead of "Looks perfect!"
      sendMessage(action.value)
    }
  }, [sendMessage, currentSessionId, persistence])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <header className="bg-white border-b h-16 flex-shrink-0">
          <div className="h-full px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Hamburger Menu - Chat History */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowChatHistory(true)}
                className="flex-shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>

              <Link href="/" className="flex items-center gap-2 group">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 transition-transform group-hover:scale-105">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  deckster
                </span>
              </Link>
              <Badge variant="secondary" className="hidden sm:flex">
                Director v3.4
              </Badge>
            </div>

            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <Badge
                variant={connected ? "default" : connecting ? "secondary" : "destructive"}
                className="hidden sm:flex"
              >
                {connecting ? "Connecting..." : connected ? "Connected" : "Disconnected"}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="h-5 w-5" />
              </Button>
              <UserProfileMenu />
            </div>
          </div>
        </header>

        {/* Connection Error Alert */}
        {wsError && (
          <div className="px-4 py-2 bg-white border-b">
            <ConnectionError onRetry={() => window.location.reload()} />
          </div>
        )}

        {/* Main Content Area - 25/75 Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Chat (25%) */}
          <div className="w-1/4 flex flex-col bg-white border-r relative">
            {/* Format Panel - Overlays chat when open */}
            <FormatPanel
              isOpen={showFormatPanel}
              onClose={() => setShowFormatPanel(false)}
              currentSlide={1} // TODO: Get from PresentationViewer state
              onLayoutChange={async (layout: SlideLayoutId) => {
                console.log('Layout change requested:', layout)
                // TODO: Implement via postMessage to iframe
              }}
              // Layout Service v7.5.3 API integration
              onGetSelectionInfo={layoutServiceApis?.getSelectionInfo}
              onUpdateSectionContent={layoutServiceApis?.updateSectionContent}
              onAIRegenerate={async (instruction, sectionId, currentContent) => {
                // Simple AI regeneration using Claude API
                // In production, this would call the Director Service
                setIsAIRegenerating(true)
                try {
                  // For now, return a placeholder - will be connected to Director Service
                  console.log('🤖 AI Regenerate request:', { instruction, sectionId, currentContent })
                  // Simulate AI response with instruction-based modification
                  const modifiedContent = `<p>${instruction}: ${currentContent}</p>`
                  return modifiedContent
                } finally {
                  setIsAIRegenerating(false)
                }
              }}
              isRegenerating={isAIRegenerating}
            />

            {/* Text Box Format Panel - Overlays chat when text box selected */}
            <TextBoxFormatPanel
              isOpen={showTextBoxPanel}
              isCollapsed={isTextBoxPanelCollapsed}
              onCollapsedChange={setIsTextBoxPanelCollapsed}
              onClose={() => {
                setShowTextBoxPanel(false)
                setSelectedTextBoxId(null)
                setSelectedTextBoxFormatting(null)
              }}
              elementId={selectedTextBoxId}
              formatting={selectedTextBoxFormatting}
              onSendCommand={async (action, params) => {
                if (!layoutServiceApis?.sendTextBoxCommand) {
                  throw new Error('Layout Service not ready')
                }
                return layoutServiceApis.sendTextBoxCommand(action, {
                  elementId: selectedTextBoxId,
                  ...params
                })
              }}
              onDelete={async () => {
                if (!layoutServiceApis?.sendTextBoxCommand || !selectedTextBoxId) return
                try {
                  await layoutServiceApis.sendTextBoxCommand('deleteTextBox', {
                    elementId: selectedTextBoxId
                  })
                  setShowTextBoxPanel(false)
                  setSelectedTextBoxId(null)
                  setSelectedTextBoxFormatting(null)
                } catch (error) {
                  console.error('Failed to delete text box:', error)
                }
              }}
              presentationId={presentationId}
              slideIndex={1} // TODO: Get current slide from PresentationViewer
            />

            {/* Element Format Panel - Overlays chat when element selected */}
            {selectedElementType && (
              <ElementFormatPanel
                isOpen={showElementPanel}
                isCollapsed={isElementPanelCollapsed}
                onCollapsedChange={setIsElementPanelCollapsed}
                onClose={() => {
                  setShowElementPanel(false)
                  setSelectedElementId(null)
                  setSelectedElementType(null)
                  setSelectedElementProperties(null)
                }}
                elementId={selectedElementId}
                elementType={selectedElementType}
                properties={selectedElementProperties}
                onSendCommand={async (action, params) => {
                  if (!layoutServiceApis?.sendElementCommand) {
                    throw new Error('Layout Service not ready')
                  }
                  // Use sendElementCommand which routes to AI backend or Layout Service as appropriate
                  return layoutServiceApis.sendElementCommand(action, {
                    elementId: selectedElementId,
                    ...params
                  })
                }}
                onDelete={async () => {
                  if (!layoutServiceApis?.sendElementCommand || !selectedElementId) return
                  try {
                    await layoutServiceApis.sendElementCommand('deleteElement', {
                      elementId: selectedElementId
                    })
                    setShowElementPanel(false)
                    setSelectedElementId(null)
                    setSelectedElementType(null)
                    setSelectedElementProperties(null)
                  } catch (error) {
                    console.error('Failed to delete element:', error)
                  }
                }}
                presentationId={presentationId}
                slideIndex={1} // TODO: Get current slide from PresentationViewer
              />
            )}

            {/* Chat Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {/* Interleave user messages and bot messages by timestamp */}
                {(() => {
                  const combined = [
                    ...userMessages.map(m => ({ ...m, messageType: 'user' as const })),
                    ...messages.map(m => {
                      let classificationMethod = 'DEFAULT';

                      // PRIORITY 1: Check Director's role field (proper fix from Director team)
                      if ((m as any).role === 'user') {
                        userMessageIdsRef.current.add(m.message_id);
                        classificationMethod = 'ROLE_FIELD';

                        // Extract text from Director's message format
                        // Director sends either {payload: {text: '...'}} or {content: '...'}
                        const text = m.payload?.text || (m as any).content || '';

                        // Convert ISO timestamp to numeric milliseconds for proper sorting
                        // IMPORTANT: Ensure 'Z' suffix for UTC parsing (Director sends without timezone suffix)
                        // Without 'Z', JavaScript treats timestamp as local time, causing timezone offset bugs
                        const normalizedTimestamp = m.timestamp?.endsWith('Z') ? m.timestamp : m.timestamp + 'Z';
                        const timestamp = new Date(normalizedTimestamp).getTime();

                        console.log('✅ Director role field detected, transforming to user message format:', {
                          message_id: m.message_id,
                          role: (m as any).role,
                          text: text.substring(0, 30),
                          timestamp,
                          method: 'ROLE_FIELD (Director fix)',
                          classifiedAs: 'USER'
                        });

                        // Transform to user message format that renderer expects
                        return {
                          id: m.message_id,
                          text: text,
                          timestamp: timestamp,
                          messageType: 'user' as const
                        };
                      }

                      // PRIORITY 2: Check if message ID is in our tracking ref
                      let isUserMessage = userMessageIdsRef.current.has(m.message_id);
                      if (isUserMessage) {
                        classificationMethod = 'USER_MESSAGE_IDS_REF';
                      }

                      // PRIORITY 3: Content matching fallback (backward compatibility workaround)
                      if (!isUserMessage && m.payload?.text) {
                        const normalizedContent = (typeof m.payload.text === 'string' ? m.payload.text : '').trim().toLowerCase();
                        const matchingUserId = userMessageContentMapRef.current.get(normalizedContent);
                        if (matchingUserId) {
                          isUserMessage = true;
                          classificationMethod = 'CONTENT_MATCH';
                          // Add this message ID to tracking for future renders
                          userMessageIdsRef.current.add(m.message_id);
                          console.log('🎯 Content match fallback (pre-Director-fix message):', {
                            directorMessageId: m.message_id,
                            matchedUserId: matchingUserId,
                            content: normalizedContent.substring(0, 30)
                          });
                        }
                      }

                      console.log('🔍 Message classification:', {
                        message_id: m.message_id,
                        payload: m.payload?.text?.substring(0, 30),
                        hasRole: !!(m as any).role,
                        role: (m as any).role,
                        method: classificationMethod,
                        isInUserMessageIds: userMessageIdsRef.current.has(m.message_id),
                        classifiedAs: isUserMessage ? 'USER' : 'BOT'
                      });
                      return { ...m, messageType: (isUserMessage ? 'user' : 'bot') as const };
                    })
                  ];

                  console.log('📊 Message rendering - userMessages:', userMessages.length, 'botMessages:', messages.length, 'combined:', combined.length);

                  // Deduplicate messages by ID (prevents duplicate display)
                  // Also deduplicate by content for cases where Director sends historical messages with new IDs
                  // WORKAROUND: Prefer user messages from database over Director's bot-classified versions
                  const seenIds = new Set<string>();
                  const seenContent = new Map<string, any>(); // content → first message seen

                  const deduplicated = combined.filter(item => {
                    const id = item.messageType === 'user' ? item.id : (item as any).message_id;
                    const content = item.messageType === 'user'
                      ? item.text
                      : (item as any).payload?.text || JSON.stringify((item as any).payload);

                    // Skip if we've seen this exact ID
                    if (seenIds.has(id)) {
                      console.log('🚫 Skipping duplicate message ID:', id);
                      return false;
                    }

                    // Check content duplication with preference for user messages
                    const contentKey = `${content}`.trim().toLowerCase();
                    const existingMessage = seenContent.get(contentKey);

                    if (existingMessage) {
                      // If we already have this content, prefer user message over bot message
                      if (item.messageType === 'user' && existingMessage.messageType !== 'user') {
                        // Current is user, existing is bot → replace with user version
                        console.log('🔄 Replacing bot message with user message:', {
                          content: contentKey.substring(0, 30),
                          botId: existingMessage.id || existingMessage.message_id,
                          userId: id
                        });
                        // Remove the bot version from seen IDs so we can add user version
                        seenIds.delete(existingMessage.id || existingMessage.message_id);
                        seenContent.set(contentKey, item);
                        seenIds.add(id);
                        return true; // Keep this user message, will remove bot version later
                      } else if (item.messageType !== 'user' && existingMessage.messageType === 'user') {
                        // Current is bot, existing is user → skip bot version
                        console.log('🚫 Skipping bot version of user message:', contentKey.substring(0, 50));
                        return false;
                      } else {
                        // Both same type → skip duplicate
                        console.log('🚫 Skipping duplicate message content:', contentKey.substring(0, 50));
                        return false;
                      }
                    }

                    seenIds.add(id);
                    seenContent.set(contentKey, item);
                    return true;
                  });

                  console.log('📊 After deduplication:', deduplicated.length);

                  const sorted = deduplicated.sort((a, b) => {
                    // User messages have numeric timestamps
                    // Bot messages should have clientTimestamp (added in hook or when restoring)
                    // Fallback: parse ISO timestamp if clientTimestamp missing
                    // FIX: Always append 'Z' suffix to ensure UTC parsing when Director sends timestamps without timezone
                    const parseTimestamp = (ts: string | undefined): number => {
                      if (!ts) return 0;
                      // Ensure 'Z' suffix for UTC parsing - Director may send timestamps without timezone indicator
                      const normalized = ts.endsWith('Z') ? ts : ts + 'Z';
                      return new Date(normalized).getTime();
                    };

                    const timeA = a.messageType === 'user'
                      ? a.timestamp
                      : (a as any).clientTimestamp || parseTimestamp((a as any).timestamp);

                    const timeB = b.messageType === 'user'
                      ? b.timestamp
                      : (b as any).clientTimestamp || parseTimestamp((b as any).timestamp);

                    console.log('⏰ Comparing timestamps:', {
                      messageA: a.messageType === 'user' ? (a as any).text?.substring(0, 20) : (a as any).payload?.text?.substring(0, 20),
                      typeA: a.messageType,
                      timeA,
                      messageB: b.messageType === 'user' ? (b as any).text?.substring(0, 20) : (b as any).payload?.text?.substring(0, 20),
                      typeB: b.messageType,
                      timeB,
                      order: timeA - timeB
                    });

                    return timeA - timeB;
                  });

                  // Filter out duplicate welcome messages if we've already seen one
                  const filtered = sorted.filter((item, index) => {
                    if (item.messageType === 'bot') {
                      const msg = item as DirectorMessage;
                      if (msg.type === 'chat_message') {
                        const chatMsg = msg as V2ChatMessage;
                        const isWelcome = chatMsg.payload.text.toLowerCase().includes("hello! i'm deckster") ||
                          chatMsg.payload.text.toLowerCase().includes("what presentation would you like to build");

                        // If this is a welcome message and we've seen one before (resumed session), skip it
                        if (isWelcome && hasSeenWelcomeRef.current && index > 0) {
                          console.log('🚫 Filtering duplicate welcome message on reconnect');
                          return false;
                        }

                        // Mark that we've seen a welcome message
                        if (isWelcome) {
                          hasSeenWelcomeRef.current = true;
                        }
                      }
                    }
                    return true;
                  });

                  console.log('📊 After filtering:', filtered.length, 'messages');
                  console.log('📊 Final message list:', filtered.map((m, i) => ({
                    index: i,
                    type: m.messageType,
                    id: m.messageType === 'user' ? m.id : (m as any).message_id,
                    text: m.messageType === 'user' ? m.text : (m as any).payload?.text?.substring(0, 50)
                  })));

                  // Group consecutive strawman-related messages (slide_update, presentation_url, action_request)
                  const processedMessages: Array<typeof filtered[0] | {
                    messageType: 'bot',
                    type: 'combined_strawman',
                    message_id: string,
                    slideUpdate?: SlideUpdate,
                    presentationUrl?: PresentationURL,
                    actionRequest?: ActionRequest
                  }> = [];

                  let i = 0;
                  while (i < filtered.length) {
                    const current = filtered[i];

                    // Check if this starts a strawman group
                    if (current.messageType === 'bot') {
                      const botMsg = current as DirectorMessage;

                      // Look for slide_update followed by presentation_url and optionally action_request
                      if (botMsg.type === 'slide_update') {
                        const slideUpdate = botMsg as SlideUpdate;
                        let presentationUrl: PresentationURL | undefined;
                        let actionRequest: ActionRequest | undefined;
                        let consumed = 1;

                        // Check next message for presentation_url
                        if (i + 1 < filtered.length && filtered[i + 1].messageType === 'bot') {
                          const nextMsg = filtered[i + 1] as DirectorMessage;
                          if (nextMsg.type === 'presentation_url') {
                            presentationUrl = nextMsg as PresentationURL;
                            consumed++;

                            // Check message after that for action_request
                            if (i + 2 < filtered.length && filtered[i + 2].messageType === 'bot') {
                              const thirdMsg = filtered[i + 2] as DirectorMessage;
                              if (thirdMsg.type === 'action_request') {
                                actionRequest = thirdMsg as ActionRequest;
                                consumed++;
                              }
                            }
                          }
                        }

                        // If we found at least slide_update + presentation_url, create combined message
                        if (presentationUrl) {
                          processedMessages.push({
                            messageType: 'bot',
                            type: 'combined_strawman',
                            message_id: `combined_${slideUpdate.message_id}`,
                            slideUpdate,
                            presentationUrl,
                            actionRequest
                          });
                          i += consumed;
                          continue;
                        }
                      }
                    }

                    // Not part of a group, add as-is
                    processedMessages.push(current);
                    i++;
                  }

                  return processedMessages.map((item, index) => {
                    if (item.messageType === 'user') {
                      // Render user message
                      return (
                        <div key={item.id} className="flex gap-3 justify-end animate-in slide-in-from-right duration-300">
                          <div className="flex-1 max-w-[85%]">
                            <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.text}</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 mt-1">
                            <div className="bg-blue-100 rounded-full p-1.5">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                          </div>
                        </div>
                      )
                    }

                    const msg = item as any;
                    return (
                      <React.Fragment key={msg.message_id || msg.id}>
                        {/* Bot messages */}
                        {(() => {
                          // Handle combined strawman message (slide_update + presentation_url + action_request)
                          if (msg.type === 'combined_strawman') {
                            const { slideUpdate, presentationUrl, actionRequest } = msg;

                            return (
                              <div className="flex gap-3 animate-in slide-in-from-left duration-300">
                                <div className="flex-shrink-0 mt-1">
                                  <div className="bg-green-100 rounded-full p-1.5">
                                    <Bot className="h-4 w-4 text-green-600" />
                                  </div>
                                </div>
                                <div className="flex-1 max-w-[85%]">
                                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl rounded-tl-sm shadow-sm overflow-hidden">
                                    {/* Slide Structure Section */}
                                    <div className="px-4 py-3 border-b border-green-200">
                                      <div className="flex items-start gap-2">
                                        <span className="text-xl">📊</span>
                                        <div className="flex-1">
                                          <p className="text-sm font-semibold text-green-900">
                                            {slideUpdate?.payload.metadata.main_title}
                                          </p>
                                          <p className="text-xs text-green-700 mt-1 flex items-center gap-2 flex-wrap">
                                            <span className="font-medium">{slideUpdate?.payload.slides.length} slides</span>
                                            <span className="text-green-400">•</span>
                                            <span>{slideUpdate?.payload.metadata.presentation_duration} min</span>
                                            <span className="text-green-400">•</span>
                                            <span className="capitalize">{slideUpdate?.payload.metadata.overall_theme}</span>
                                          </p>
                                        </div>
                                      </div>
                                      <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                        {slideUpdate?.payload.slides.map((slide, i) => (
                                          <div key={i} className="text-xs bg-white/80 backdrop-blur rounded-lg px-3 py-2 border border-green-100">
                                            <div className="flex items-center gap-2">
                                              <span className="font-semibold text-green-700 min-w-[1.5rem]">
                                                {slide.slide_number}.
                                              </span>
                                              <span className="font-medium text-gray-800 flex-1">
                                                {slide.title}
                                              </span>
                                              <span className="text-gray-500 text-[10px] uppercase tracking-wide">
                                                {slide.slide_type}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Presentation Ready Section */}
                                    {presentationUrl && (
                                      <div className="px-4 py-3 border-b border-green-200 bg-white/40">
                                        <div className="flex items-start gap-2">
                                          <span className="text-xl">✅</span>
                                          <div className="flex-1">
                                            <p className="text-sm font-semibold text-green-900">
                                              {presentationUrl.payload.message}
                                            </p>
                                            <p className="text-xs text-green-700 mt-1">
                                              {presentationUrl.payload.slide_count} slides ready to view
                                            </p>
                                          </div>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="mt-3 w-full bg-white hover:bg-green-50 border-green-300 text-green-700 hover:text-green-800"
                                          onClick={() => window.open(presentationUrl.payload.url, '_blank')}
                                        >
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          Open presentation
                                        </Button>
                                      </div>
                                    )}

                                    {/* Action Buttons Section */}
                                    {actionRequest && !answeredActionsRef.current.has(actionRequest.message_id) && (
                                      <div className="px-4 py-3 bg-white/60">
                                        <p className="text-sm font-medium text-gray-900 mb-3">{actionRequest.payload.prompt_text}</p>
                                        <div className="flex flex-wrap gap-2">
                                          {actionRequest.payload.actions.map((action, i) => (
                                            <Button
                                              key={i}
                                              size="sm"
                                              variant={action.primary ? "default" : "outline"}
                                              onClick={() => handleActionClick(action, actionRequest.message_id)}
                                              className={action.primary
                                                ? "bg-green-600 hover:bg-green-700 shadow-sm"
                                                : "hover:bg-gray-50 border-gray-300"
                                              }
                                            >
                                              {action.label}
                                            </Button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          } else if (msg.type === 'chat_message') {
                            const chatMsg = msg as V2ChatMessage
                            // Detect if this is a preview link message
                            const isPreviewLink = chatMsg.payload.text.includes('📊') &&
                              chatMsg.payload.text.toLowerCase().includes('preview');

                            return (
                              <div className="flex gap-3 animate-in slide-in-from-left duration-300">
                                <div className="flex-shrink-0 mt-1">
                                  <div className="bg-purple-100 rounded-full p-1.5">
                                    <Bot className="h-4 w-4 text-purple-600" />
                                  </div>
                                </div>
                                <div className="flex-1 max-w-[85%]">
                                  <div className={`rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm ${isPreviewLink
                                    ? 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                                    : 'bg-white border border-gray-200'
                                    }`}>
                                    <div className="text-sm max-w-none text-gray-800" style={{ fontSize: '0.875rem' }}>
                                      <ReactMarkdown
                                        components={{
                                          a: ({ node, ...props }) => (
                                            <a
                                              {...props}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors"
                                            />
                                          ),
                                          p: ({ node, ...props }) => <p {...props} className="leading-relaxed mb-0" style={{ fontSize: 'inherit' }} />,
                                          strong: ({ node, ...props }) => <strong {...props} className="font-semibold text-gray-900" style={{ fontSize: 'inherit' }} />,
                                          ul: ({ node, ...props }) => <ul {...props} className="space-y-1 my-2" style={{ fontSize: 'inherit' }} />,
                                          li: ({ node, ...props }) => <li {...props} className="leading-relaxed" style={{ fontSize: 'inherit' }} />
                                        }}
                                      >
                                        {chatMsg.payload.text}
                                      </ReactMarkdown>
                                    </div>
                                    {chatMsg.payload.sub_title && (
                                      <p className="text-xs text-gray-600 mt-1">{chatMsg.payload.sub_title}</p>
                                    )}
                                    {chatMsg.payload.list_items && chatMsg.payload.list_items.length > 0 && (
                                      <ul className="text-xs mt-2 space-y-1">
                                        {chatMsg.payload.list_items.map((item, i) => (
                                          <li key={i} className="ml-4 list-disc">{item}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          } else if (msg.type === 'action_request') {
                            const actionMsg = msg as ActionRequest
                            // Don't render if this action has already been answered
                            if (answeredActionsRef.current.has(actionMsg.message_id)) {
                              return null
                            }
                            return (
                              <div className="space-y-3 animate-in slide-in-from-left duration-300">
                                <div className="flex gap-3">
                                  <div className="flex-shrink-0 mt-1">
                                    <div className="bg-purple-100 rounded-full p-1.5">
                                      <Bot className="h-4 w-4 text-purple-600" />
                                    </div>
                                  </div>
                                  <div className="flex-1 max-w-[85%]">
                                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
                                      <p className="text-sm font-medium text-gray-900">{actionMsg.payload.prompt_text}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="ml-11 flex flex-wrap gap-2">
                                  {actionMsg.payload.actions.map((action, i) => (
                                    <Button
                                      key={i}
                                      size="sm"
                                      variant={action.primary ? "default" : "outline"}
                                      onClick={() => handleActionClick(action, actionMsg.message_id)}
                                      className={action.primary
                                        ? "bg-blue-600 hover:bg-blue-700 shadow-sm"
                                        : "hover:bg-gray-50 border-gray-300"
                                      }
                                    >
                                      {action.label}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )
                          } else if (msg.type === 'slide_update') {
                            const slideMsg = msg as SlideUpdate
                            return (
                              <div className="flex gap-3 animate-in slide-in-from-left duration-300">
                                <div className="flex-shrink-0 mt-1">
                                  <div className="bg-purple-100 rounded-full p-1.5">
                                    <Bot className="h-4 w-4 text-purple-600" />
                                  </div>
                                </div>
                                <div className="flex-1 max-w-[85%]">
                                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                                    <div className="flex items-start gap-2">
                                      <span className="text-xl">📊</span>
                                      <div className="flex-1">
                                        <p className="text-sm font-semibold text-blue-900">
                                          {slideMsg.payload.metadata.main_title}
                                        </p>
                                        <p className="text-xs text-blue-700 mt-1 flex items-center gap-2 flex-wrap">
                                          <span className="font-medium">{slideMsg.payload.slides.length} slides</span>
                                          <span className="text-blue-400">•</span>
                                          <span>{slideMsg.payload.metadata.presentation_duration} min</span>
                                          <span className="text-blue-400">•</span>
                                          <span className="capitalize">{slideMsg.payload.metadata.overall_theme}</span>
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                      {slideMsg.payload.slides.map((slide, i) => (
                                        <div key={i} className="text-xs bg-white/80 backdrop-blur rounded-lg px-3 py-2 border border-blue-100">
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold text-blue-700 min-w-[1.5rem]">
                                              {slide.slide_number}.
                                            </span>
                                            <span className="font-medium text-gray-800 flex-1">
                                              {slide.title}
                                            </span>
                                            <span className="text-gray-500 text-[10px] uppercase tracking-wide">
                                              {slide.slide_type}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          } else if (msg.type === 'presentation_url') {
                            const presMsg = msg as PresentationURL
                            return (
                              <div className="flex gap-3 animate-in slide-in-from-left duration-300">
                                <div className="flex-shrink-0 mt-1">
                                  <div className="bg-green-100 rounded-full p-1.5">
                                    <Bot className="h-4 w-4 text-green-600" />
                                  </div>
                                </div>
                                <div className="flex-1 max-w-[85%]">
                                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                                    <div className="flex items-start gap-2">
                                      <span className="text-xl">✅</span>
                                      <div className="flex-1">
                                        <p className="text-sm font-semibold text-green-900">
                                          {presMsg.payload.message}
                                        </p>
                                        <p className="text-xs text-green-700 mt-1">
                                          {presMsg.payload.slide_count} slides ready to view
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="mt-3 w-full bg-white hover:bg-green-50 border-green-300 text-green-700 hover:text-green-800"
                                      onClick={() => window.open(presMsg.payload.url, '_blank')}
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      Open presentation
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          return null
                        })()}
                      </React.Fragment>
                    )
                  });
                })()}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Chat Input */}
            <div className="p-4 border-t bg-gray-50/50">
              {/* File Upload UI (Feature Flag Controlled) */}
              {features.enableFileUploads && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <FileUploadButton
                      onFilesSelected={handleFilesSelected}
                      maxFiles={5}
                      currentFileCount={uploadedFiles.length}
                      disabled={features.enableEarlySessionCreation ? isLoadingSession : (!currentSessionId || isLoadingSession)}
                      onRequestSession={features.enableEarlySessionCreation ? handleRequestSession : undefined}
                      isCreatingSession={features.enableEarlySessionCreation ? isCreatingSession : false}
                    />
                    {uploadedFiles.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFiles}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {uploadedFiles.map((file) => (
                        <FileChip
                          key={file.id}
                          file={file}
                          onRemove={() => removeFile(file.id)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Action Input Banner */}
              {pendingActionInput && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-medium text-sm">
                      {pendingActionInput.action.label}
                    </span>
                    <span className="text-blue-500 text-xs">
                      - Type your input below and press Enter
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPendingActionInput(null)
                      setInputMessage("")
                    }}
                    className="h-6 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                  >
                    Cancel
                  </Button>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                      if (e.key === 'Escape' && pendingActionInput) {
                        e.preventDefault()
                        setPendingActionInput(null)
                        setInputMessage("")
                      }
                    }}
                    placeholder={
                      !user
                        ? "Authenticating..."
                        : isLoadingSession
                        ? "Loading session..."
                        : !connected && !connecting
                          ? "Disconnected - send a message to reconnect"
                          : connecting
                            ? "Connecting to Director..."
                            : pendingActionInput
                              ? `Type your changes here... (ESC to cancel)`
                              : "Type your message... (Shift+Enter for new line)"
                    }
                    disabled={!user || isLoadingSession}
                    className="resize-none border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl shadow-sm"
                    rows={3}
                  />
                  {/* Only show loading overlay when actually loading session, not when WebSocket disconnected */}
                  {isLoadingSession && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] rounded-xl flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={!isReady || !inputMessage.trim()}
                  size="icon"
                  className="self-end bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm h-10 w-10"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* Right Panel - Presentation Display (75%) */}
          <div className="flex-1 flex flex-col bg-gray-100">
            {presentationUrl && !isGeneratingFinal ? (
              <PresentationViewer
                presentationUrl={presentationUrl}
                presentationId={presentationId}
                slideCount={slideCount}
                slideStructure={slideStructure}
                strawmanPreviewUrl={strawmanPreviewUrl}
                finalPresentationUrl={finalPresentationUrl}
                activeVersion={activeVersion}
                onVersionSwitch={switchVersion}
                showControls={true}
                downloadControls={
                  <PresentationDownloadControls
                    presentationUrl={presentationUrl}
                    presentationId={presentationId}
                    slideCount={slideCount}
                    stage={currentStage}
                  />
                }
                onSlideChange={(slideNum) => {
                  console.log(`📍 Viewing slide ${slideNum}`)
                }}
                onEditModeChange={(isEditing) => {
                  console.log(`✏️ Edit mode: ${isEditing ? 'ON' : 'OFF'}`)
                }}
                onTextBoxSelected={(elementId, formatting) => {
                  setSelectedTextBoxId(elementId)
                  setSelectedTextBoxFormatting(formatting)
                  setShowTextBoxPanel(true)
                  setIsTextBoxPanelCollapsed(false) // Auto-expand on selection
                  // Close element panel when text box is selected
                  setShowElementPanel(false)
                  setShowFormatPanel(false)
                }}
                onTextBoxDeselected={() => {
                  setSelectedTextBoxId(null)
                  setSelectedTextBoxFormatting(null)
                  setIsTextBoxPanelCollapsed(true) // Auto-collapse on deselection
                  // Keep panel in DOM but collapsed
                }}
                onElementSelected={(elementId, elementType, properties) => {
                  setSelectedElementId(elementId)
                  setSelectedElementType(elementType)
                  setSelectedElementProperties(properties)
                  setShowElementPanel(true)
                  setIsElementPanelCollapsed(false) // Auto-expand on selection
                  // Close text box panel when element is selected
                  setShowTextBoxPanel(false)
                  setShowFormatPanel(false)
                }}
                onElementDeselected={() => {
                  setSelectedElementId(null)
                  setSelectedElementType(null)
                  setSelectedElementProperties(null)
                  setIsElementPanelCollapsed(true) // Auto-collapse on deselection
                }}
                onApiReady={setLayoutServiceApis}
                className="flex-1"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                {(currentStatus || isGeneratingFinal || isGeneratingStrawman) ? (
                  // FIXED: Show slide building animation when actively processing OR generating final OR generating strawman
                  <SlideBuildingLoader
                    statusText={
                      isGeneratingFinal
                        ? "Generating your final presentation..."
                        : isGeneratingStrawman
                        ? "Building your strawman presentation..."
                        : currentStatus?.text
                    }
                    estimatedTime={currentStatus?.estimated_time ?? undefined}
                    className="w-full px-8"
                    mode={isGeneratingFinal ? 'default' : 'strawman'}
                  />
                ) : (
                  // Show default placeholder when idle
                  <div className="text-center">
                    <Sparkles className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg text-gray-600">Your presentation will appear here</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Start by telling Director what presentation you'd like to create
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat History Sidebar */}
      <ChatHistorySidebar
        isOpen={showChatHistory}
        onClose={() => setShowChatHistory(false)}
        currentSessionId={currentSessionId || undefined}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
      />

      {/* Onboarding Modal */}
      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </div>
  )
}

export default function BuilderPage() {
  return (
    <WebSocketErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
          <div className="text-center">
            <div className="h-10 w-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-600">Loading builder...</p>
          </div>
        </div>
      }>
        <BuilderContent />
      </Suspense>
    </WebSocketErrorBoundary>
  )
}