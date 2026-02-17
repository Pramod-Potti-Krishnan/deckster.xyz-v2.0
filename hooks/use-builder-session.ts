"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { features } from '@/lib/config'
import { type DirectorMessage, type SlideUpdate } from "@/hooks/use-deckster-websocket-v2"

interface UseBuilderSessionParams {
  user: any
  isAuthLoading: boolean
  searchParams: ReturnType<typeof import("next/navigation").useSearchParams>
  loadSession: (sessionId: string) => Promise<any>
  createSession: (sessionId: string) => Promise<any>
  persistence: {
    queueMessage: (msg: DirectorMessage, userText?: string) => void
    updateMetadata: (data: any) => void
    generateTitle: (text: string) => string
  } | null
  // WebSocket methods
  connected: boolean
  connecting: boolean
  connect: () => void
  disconnect: () => void
  clearMessages: () => void
  restoreMessages: (messages: DirectorMessage[], sessionState: any) => void
  updateCacheUserMessages: (messages: Array<{ id: string; text: string; timestamp: number }>) => void
  messages: DirectorMessage[]
  toast: (opts: any) => any
  isUnsavedSession: boolean
  setIsUnsavedSession: (v: boolean) => void
  // Session ID — lifted to page.tsx so useSessionPersistence gets it synchronously
  currentSessionId: string | null
  setCurrentSessionId: (id: string | null) => void
}

export function useBuilderSession({
  user,
  isAuthLoading,
  searchParams,
  loadSession,
  createSession,
  persistence,
  connected,
  connecting,
  connect,
  disconnect,
  clearMessages,
  restoreMessages,
  updateCacheUserMessages,
  messages,
  toast,
  isUnsavedSession,
  setIsUnsavedSession,
  currentSessionId,
  setCurrentSessionId,
}: UseBuilderSessionParams) {
  const router = useRouter()

  const currentSessionIdRef = useRef(currentSessionId)

  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [isResumedSession, setIsResumedSession] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)

  const [userMessages, setUserMessages] = useState<Array<{ id: string; text: string; timestamp: number }>>(() => {
    if (typeof window === 'undefined') return [];
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

  // Refs
  const lastLoadedSessionRef = useRef<string | null>(null)
  const justCreatedSessionRef = useRef<string | null>(null)
  const hasTitleFromUserMessageRef = useRef(false)
  const hasTitleFromPresentationRef = useRef(false)
  const hasSeenWelcomeRef = useRef(false)
  const userMessageIdsRef = useRef<Set<string>>(new Set())
  const userMessageContentMapRef = useRef<Map<string, string>>(new Map())
  const answeredActionsRef = useRef<Set<string>>(new Set())

  // Keep currentSessionIdRef in sync
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  // Sync user messages to session cache
  useEffect(() => {
    if (userMessages.length > 0) {
      updateCacheUserMessages(userMessages)
    }
  }, [userMessages, updateCacheUserMessages])

  // Retroactive recovery of missing user messages from Director's history
  useEffect(() => {
    if (!currentSessionId || messages.length === 0) return;

    const directorUserMessages = messages.filter((m: any) => m.role === 'user');
    if (directorUserMessages.length === 0) return;

    const existingUserMessageIds = new Set(userMessages.map(um => um.id));
    const existingUserMessageTexts = new Set(userMessages.map(um => um.text.trim().toLowerCase()));

    const missingUserMessages = directorUserMessages.filter((m: any) => {
      const text = m.payload?.text || m.content || '';
      const normalizedText = text.trim().toLowerCase();
      return !existingUserMessageIds.has(m.message_id) && !existingUserMessageTexts.has(normalizedText);
    });

    if (missingUserMessages.length > 0) {
      console.log('🔄 [FIX 9] Recovering missing user messages from Director history:', missingUserMessages.length);

      const recoveredMessages = missingUserMessages.map((m: any) => {
        const text = m.payload?.text || m.content || '';
        return {
          id: m.message_id,
          text: text,
          timestamp: new Date(m.timestamp).getTime()
        };
      });

      setUserMessages(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newMessages = recoveredMessages.filter(rm => !existingIds.has(rm.id));
        if (newMessages.length === 0) return prev;
        console.log('✅ [FIX 9] Adding recovered user messages to state:', newMessages.length);
        return [...prev, ...newMessages].sort((a, b) => a.timestamp - b.timestamp);
      });

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

      missingUserMessages.forEach((m: any) => {
        userMessageIdsRef.current.add(m.message_id);
        const text = m.payload?.text || m.content || '';
        userMessageContentMapRef.current.set(text.trim().toLowerCase(), m.message_id);
      });

      console.log('✅ [FIX 9] Recovery complete - recovered', missingUserMessages.length, 'user messages');
    }
  }, [currentSessionId, messages, userMessages, persistence]);

  // Helper to create new session
  const createNewSession = useCallback(async () => {
    lastLoadedSessionRef.current = null
    const newSessionId = crypto.randomUUID()
    const session = await createSession(newSessionId)

    if (session) {
      setUserMessages([])
      clearMessages()
      setIsResumedSession(false)
      setCurrentSessionId(session.id)
      router.push(`/builder?session_id=${session.id}`)
      console.log('✅ New session created:', session.id)
    }
  }, [createSession, clearMessages, router])

  // Session initialization - load or create session
  useEffect(() => {
    const initializeSession = async () => {
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

      if (currentSessionId && !isLoadingSession) {
        const urlSessionId = searchParams?.get('session_id') ||
                           (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('session_id') : null)

        console.log('✅ [SESSION-GUARD] Session already initialized', {
          currentSessionId,
          urlSessionId,
          matches: urlSessionId === currentSessionId,
          action: urlSessionId === currentSessionId ? 'SKIP' : 'PROCEED'
        })

        if (urlSessionId === currentSessionId || !urlSessionId) {
          return
        }

        console.log('⚠️ [SESSION-GUARD] URL session differs from current, will re-initialize', {
          current: currentSessionId,
          url: urlSessionId
        })
      }

      setIsLoadingSession(true)
      hasTitleFromUserMessageRef.current = false
      hasTitleFromPresentationRef.current = false
      answeredActionsRef.current.clear()
      console.log('🔄 Cleared answeredActionsRef for session initialization')

      try {
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

          if (lastLoadedSessionRef.current === sessionParam) {
            console.log('⏭️ Skipping re-initialization of already-loaded session:', sessionParam)
            setIsLoadingSession(false)
            return
          }

          if (justCreatedSessionRef.current === sessionParam) {
            console.log('⏭️ Skipping re-initialization of just-created session:', sessionParam)
            justCreatedSessionRef.current = null
            setIsLoadingSession(false)
            return
          }

          lastLoadedSessionRef.current = sessionParam

          console.log('📂 Loading session from URL:', sessionParam)
          const session = await loadSession(sessionParam)

          if (session) {
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

            if (session.title) {
              console.log('📝 Session already has title:', session.title)
              hasTitleFromPresentationRef.current = true
            }

            if (session.messages && session.messages.length > 0) {
              console.log(`📥 Restoring ${session.messages.length} messages from database`)

              const userMsgs: Array<{ id: string; text: string; timestamp: number }> = []
              const botMsgs: DirectorMessage[] = []
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
                  console.log('👤 Classified as USER message');
                  console.log('👤 Loading user message:', { id: msg.id, text: msg.userText.substring(0, 50), timestamp: msg.timestamp });

                  userMsgs.push({
                    id: msg.id,
                    text: msg.userText,
                    timestamp: new Date(msg.timestamp).getTime()
                  })
                } else {
                  console.log('🤖 Classified as BOT message');
                  console.log('🤖 Loading bot message:', { id: msg.id, type: msg.messageType, timestamp: msg.timestamp });

                  if (msg.messageType === 'action_request') {
                    lastActionRequestId = msg.id
                  }

                  botMsgs.push({
                    message_id: msg.id,
                    session_id: session.id,
                    timestamp: msg.timestamp,
                    type: msg.messageType as any,
                    payload: msg.payload,
                    clientTimestamp: new Date(
                      msg.timestamp?.endsWith('Z') ? msg.timestamp : msg.timestamp + 'Z'
                    ).getTime()
                  } as any)
                }
              })

              setUserMessages(userMsgs)

              userMsgs.forEach(msg => {
                userMessageIdsRef.current.add(msg.id)
                console.log('✅ Added to userMessageIdsRef:', msg.id, msg.text.substring(0, 30));
              })
              console.log(`✅ Repopulated userMessageIdsRef with ${userMsgs.length} user message IDs`)
              console.log('📊 Total user message IDs tracked:', userMessageIdsRef.current.size)

              userMessageContentMapRef.current.clear();
              userMsgs.forEach(msg => {
                const normalizedContent = msg.text.trim().toLowerCase();
                userMessageContentMapRef.current.set(normalizedContent, msg.id);
                console.log('🗺️ Mapped user message content:', normalizedContent.substring(0, 30), '→', msg.id);
              })
              console.log('🗺️ Created content map with', userMessageContentMapRef.current.size, 'user messages')

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

              setIsResumedSession(true)
              hasSeenWelcomeRef.current = true
              console.log(`✅ Restored ${userMsgs.length} user messages and ${botMsgs.length} bot messages (resumed session - will auto-connect)`)
            } else {
              setIsResumedSession(false)
              console.log('📝 Existing session but no messages - will auto-connect')
            }
          } else {
            console.warn('⚠️ Session not found, creating new')
            await createNewSession()
          }
        } else {
          console.log('🆕 [SESSION-BRANCH] No session in URL', {
            currentSessionId,
            immediateConnection: features.immediateConnection,
            action: features.immediateConnection ? 'GENERATE new ID' : (currentSessionId ? 'PRESERVE existing' : 'SET to null')
          })

          if (features.immediateConnection) {
            if (!currentSessionId) {
              const newSessionId = crypto.randomUUID()
              console.log('🚀 [BUILDER-V2] Generating immediate session ID:', newSessionId)
              setCurrentSessionId(newSessionId)
              setIsUnsavedSession(true)
              try { sessionStorage.setItem(`deckster_unsaved_${newSessionId}`, 'true') } catch {}
              setIsResumedSession(false)
              router.replace(`/builder?session_id=${newSessionId}`, { scroll: false })
            } else {
              console.log('✅ [BUILDER-V2] Session ID already exists:', currentSessionId)
              if (typeof window !== 'undefined' && !window.location.search.includes('session_id=')) {
                router.replace(`/builder?session_id=${currentSessionId}`, { scroll: false })
              }
            }
          } else {
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
        }
      } catch (error) {
        console.error('❌ Error initializing session:', error)
        await createNewSession()
      } finally {
        setIsLoadingSession(false)
      }
    }

    initializeSession()
  }, [user, isAuthLoading, searchParams])

  // Loading timeout safety net
  useEffect(() => {
    if (isLoadingSession) {
      const timeout = setTimeout(() => {
        console.warn('⏰ isLoadingSession timeout - forcing reset after 10 seconds')
        setIsLoadingSession(false)
      }, 10000)
      return () => clearTimeout(timeout)
    }
  }, [isLoadingSession])

  // Handler to create draft session for file uploads
  const handleRequestSession = useCallback(async () => {
    if (currentSessionId && !isUnsavedSession) {
      console.log('📎 Session already exists in DB:', currentSessionId)
      return
    }

    setIsCreatingSession(true)

    try {
      console.log('📎 Creating draft session for file upload')
      const sessionIdToCreate = currentSessionId || crypto.randomUUID()
      const session = await createSession(sessionIdToCreate)

      if (session) {
        setCurrentSessionId(session.id)
        setIsUnsavedSession(false)
        try { sessionStorage.removeItem(`deckster_unsaved_${session.id}`) } catch {}
        // Only update URL if session ID changed (avoid redundant navigation)
        if (session.id !== currentSessionId) {
          router.push(`/builder?session_id=${session.id}`)
        }
        console.log('✅ Draft session created:', session.id)
      } else {
        throw new Error('Session creation returned null')
      }
    } catch (error) {
      console.error('❌ Error creating draft session:', error)
      throw error
    } finally {
      setIsCreatingSession(false)
    }
  }, [currentSessionId, isUnsavedSession, createSession, router, setIsUnsavedSession])

  // Handle session selection from sidebar
  const handleSessionSelect = useCallback((sessionId: string) => {
    if (sessionId === currentSessionId) return

    console.log('📂 Switching to session:', sessionId)

    const cacheKeys = Object.keys(sessionStorage).filter(key =>
      key.startsWith('deckster_session_')
    )
    cacheKeys.forEach(key => {
      sessionStorage.removeItem(key)
      console.log(`🗑️ Cleared cache: ${key}`)
    })

    setUserMessages([])
    clearMessages()

    setIsLoadingSession(true)

    router.push(`/builder?session_id=${sessionId}`)
  }, [currentSessionId, router, clearMessages])

  // Handle new chat from sidebar
  const handleNewChat = useCallback(() => {
    console.log('🆕 Starting new unsaved session')
    disconnect()
    setUserMessages([])
    clearMessages()
    setIsUnsavedSession(true)
    setIsResumedSession(false)
    setCurrentSessionId(null)
    router.push('/builder')
  }, [router, clearMessages, disconnect, setIsUnsavedSession])

  // Auto-connect WebSocket
  useEffect(() => {
    if (currentSessionId && !isLoadingSession && !connecting && !connected) {
      const sessionType = isResumedSession ? 'RESUMED' : 'NEW'
      console.log(`🔌 Auto-connecting WebSocket for ${sessionType} session:`, currentSessionId)
      connect()
    } else if (isUnsavedSession && !isLoadingSession && !connecting && !connected) {
      console.log('🔌 Auto-connecting WebSocket for UNSAVED session (no DB session yet)')
      connect()
    }
  }, [currentSessionId, isLoadingSession, connecting, connected, connect, isResumedSession, isUnsavedSession])

  // Persist bot messages received from WebSocket
  useEffect(() => {
    if (!currentSessionId || !persistence || messages.length === 0 || isUnsavedSession) return

    const lastMessage = messages[messages.length - 1]

    if ((lastMessage as any).role === 'user') {
      const userText = (lastMessage as any).payload?.text || (lastMessage as any).content || '';
      console.log('💾 Persisting Director-replayed user message:', lastMessage.message_id, userText.substring(0, 30))
      userMessageIdsRef.current.add(lastMessage.message_id)
      persistence.queueMessage(lastMessage, userText)
      return
    }

    if (lastMessage.type !== 'chat_message') {
      console.log('💾 Persisting bot message:', lastMessage.type, lastMessage.message_id)
      persistence.queueMessage(lastMessage)
    } else if (!userMessageIdsRef.current.has(lastMessage.message_id)) {
      console.log('💾 Persisting bot chat_message (welcome/initial):', lastMessage.message_id)
      persistence.queueMessage(lastMessage)
    }

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
  }, [messages, currentSessionId, persistence, isUnsavedSession])

  // Update session title from presentation metadata
  useEffect(() => {
    if (!currentSessionId || !persistence || messages.length === 0 || isUnsavedSession) return

    const lastMessage = messages[messages.length - 1]

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
  }, [messages, currentSessionId, persistence, isUnsavedSession])

  return {
    // State
    currentSessionId,
    setCurrentSessionId,
    currentSessionIdRef,
    isLoadingSession,
    setIsLoadingSession,
    isResumedSession,
    setIsResumedSession,
    isCreatingSession,
    userMessages,
    setUserMessages,

    // Refs
    lastLoadedSessionRef,
    justCreatedSessionRef,
    hasTitleFromUserMessageRef,
    hasTitleFromPresentationRef,
    hasSeenWelcomeRef,
    userMessageIdsRef,
    userMessageContentMapRef,
    answeredActionsRef,

    // Handlers
    createNewSession,
    handleRequestSession,
    handleSessionSelect,
    handleNewChat,
  }
}
