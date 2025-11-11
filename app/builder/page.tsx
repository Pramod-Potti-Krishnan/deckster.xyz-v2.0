"use client"

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useDecksterWebSocketV2, type DirectorMessage, type ChatMessage as V2ChatMessage, type ActionRequest, type StatusUpdate, type PresentationURL, type SlideUpdate } from "@/hooks/use-deckster-websocket-v2"
import { useChatSessions } from "@/hooks/use-chat-sessions"
import { useSessionPersistence } from "@/hooks/use-session-persistence"
import ReactMarkdown from 'react-markdown'
import { WebSocketErrorBoundary } from "@/components/error-boundary"
import { ConnectionError } from "@/components/connection-error"
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
  Share,
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

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

function BuilderContent() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Session management
  const { loadSession, createSession } = useChatSessions()
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [showChatHistory, setShowChatHistory] = useState(false)

  // Track if this is a resumed session with existing messages
  // If true, we DON'T auto-connect WebSocket (to avoid duplicate welcome messages)
  const [isResumedSession, setIsResumedSession] = useState(false)

  // Track if this is a brand new session (not yet saved to database)
  // We only save to database when user sends first message
  const [isUnsavedSession, setIsUnsavedSession] = useState(false)

  // WebSocket v2 integration with session support
  // NOTE: We never pass existingSessionId - always use fresh WebSocket session ID
  // This prevents Director from sending welcome messages when reconnecting to existing sessions
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
    sendMessage,
    clearMessages,
    restoreMessages,
    connect,
    disconnect,
    isReady,
    sessionId: wsSessionId
  } = useDecksterWebSocketV2({
    autoConnect: false, // We'll control connection manually
    reconnectOnError: false,
    maxReconnectAttempts: 0,
    reconnectDelay: 5000,
    onSessionStateChange: (state) => {
      // Session state changed - update metadata in database
      if (currentSessionId && persistence) {
        persistence.updateMetadata({
          currentStage: state.currentStage,
          strawmanPreviewUrl: state.presentationUrl,
          strawmanPresentationId: state.presentationId,
          slideCount: state.slideCount,
          lastMessageAt: new Date()
        })
      }
    }
  })

  // Session persistence
  const persistence = useSessionPersistence({
    sessionId: currentSessionId || '',
    enabled: !!currentSessionId && connected,
    onError: (error) => {
      console.error('Persistence error:', error)
    }
  })

  // Local UI state
  const [inputMessage, setInputMessage] = useState("")
  const [userMessages, setUserMessages] = useState<Array<{ id: string; text: string; timestamp: number }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Track if we've generated a title from user message yet
  const hasTitleFromUserMessageRef = useRef(false)
  const hasTitleFromPresentationRef = useRef(false)

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
      if (!user || isAuthLoading) return

      setIsLoadingSession(true)

      // Reset title tracking refs for new/loaded session
      hasTitleFromUserMessageRef.current = false
      hasTitleFromPresentationRef.current = false

      try {
        const sessionParam = searchParams?.get('session_id')

        if (sessionParam && sessionParam !== 'new') {
          // Load existing session from URL
          console.log('📂 Loading session from URL:', sessionParam)
          const session = await loadSession(sessionParam)

          if (session) {
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

              session.messages.forEach((msg: any) => {
                if (msg.userText) {
                  // User message
                  userMsgs.push({
                    id: msg.id,
                    text: msg.userText,
                    timestamp: new Date(msg.timestamp).getTime()
                  })
                } else {
                  // Bot message - convert from DB format to WebSocket format
                  botMsgs.push({
                    message_id: msg.id,
                    session_id: session.id,
                    timestamp: msg.timestamp,
                    type: msg.messageType as any,
                    payload: msg.payload
                  })
                }
              })

              // Restore user messages
              setUserMessages(userMsgs)

              // Restore bot messages and session state
              restoreMessages(botMsgs, {
                presentationUrl: session.finalPresentationUrl || session.strawmanPreviewUrl,
                presentationId: session.finalPresentationId || session.strawmanPresentationId,
                slideCount: session.slideCount,
              })

              // Mark as resumed session - DON'T auto-connect WebSocket
              setIsResumedSession(true)
              console.log(`✅ Restored ${userMsgs.length} user messages and ${botMsgs.length} bot messages (resumed session - no auto-connect)`)
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
          console.log('🆕 Starting new session (unsaved until first message)')
          setIsUnsavedSession(true)
          setIsResumedSession(false)
          setCurrentSessionId(null) // No session ID yet
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

  // Helper to create new session
  const createNewSession = async () => {
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

  // Handle session selection from sidebar
  const handleSessionSelect = useCallback((sessionId: string) => {
    if (sessionId === currentSessionId) return

    console.log('📂 Switching to session:', sessionId)
    router.push(`/builder?session_id=${sessionId}`)
    // Page will reload with new session
    window.location.href = `/builder?session_id=${sessionId}`
  }, [currentSessionId, router])

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

  // Auto-connect WebSocket for NEW sessions only (not resumed sessions)
  useEffect(() => {
    // Auto-connect for saved new sessions (has sessionId, not resumed)
    if (currentSessionId && !isLoadingSession && !connecting && !connected && !isResumedSession) {
      console.log('🔌 Auto-connecting WebSocket for NEW session:', currentSessionId)
      connect()
    }
    // Auto-connect for unsaved sessions (no sessionId yet, waiting for first message)
    else if (isUnsavedSession && !isLoadingSession && !connecting && !connected) {
      console.log('🔌 Auto-connecting WebSocket for UNSAVED session (no DB session yet)')
      connect()
    }
    else if (isResumedSession) {
      console.log('⏸️ Skipping auto-connect for RESUMED session (has existing messages)')
    }
  }, [currentSessionId, isLoadingSession, connecting, connected, connect, isResumedSession, isUnsavedSession])

  // Persist bot messages received from WebSocket
  useEffect(() => {
    if (!currentSessionId || !persistence || messages.length === 0) return

    // Get the last message
    const lastMessage = messages[messages.length - 1]

    // Queue message for persistence
    persistence.queueMessage(lastMessage)

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

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, userMessages])

  // Handle sending messages
  const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputMessage.trim()) return

    const messageText = inputMessage.trim()

    // For unsaved sessions, create database session first
    if (isUnsavedSession && !currentSessionId) {
      console.log('💾 Creating database session for first message')
      const newSessionId = crypto.randomUUID()
      const session = await createSession(newSessionId)

      if (session) {
        setCurrentSessionId(session.id)
        setIsUnsavedSession(false)
        // Update URL
        router.push(`/builder?session_id=${session.id}`)
        console.log('✅ Database session created:', session.id)

        // Now send the message (will continue below after state update)
        // Use a small delay to ensure state is updated
        setTimeout(() => {
          const success = sendMessage(messageText)
          if (success) {
            setInputMessage("")
          }
        }, 100)
        return
      } else {
        alert('Failed to create session. Please try again.')
        return
      }
    }

    // For resumed sessions, connect on first message
    if (isResumedSession && !connected && !connecting) {
      console.log('🔌 Connecting WebSocket for first message in resumed session')
      connect()
      // Mark as no longer resumed (we're now actively chatting)
      setIsResumedSession(false)
      // Wait a bit for connection, then send (user can retry if needed)
      setTimeout(() => {
        if (sendMessage(messageText)) {
          setInputMessage("")
        }
      }, 1000)
      return
    }

    // Normal check for connection
    if (!isReady) return

    const messageId = crypto.randomUUID()
    const timestamp = Date.now()

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

    const success = sendMessage(messageText)
    if (success) {
      setInputMessage("")
    }
  }, [inputMessage, isReady, sendMessage, currentSessionId, persistence, isResumedSession, connected, connecting, connect, isUnsavedSession, createSession, router])

  // Handle action button clicks
  const handleActionClick = useCallback((action: ActionRequest['payload']['actions'][0]) => {
    const messageId = crypto.randomUUID()
    const timestamp = Date.now()

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

    if (action.requires_input) {
      // For actions that require input, prompt user for text
      const userInput = window.prompt(action.label);
      if (userInput && userInput.trim()) {
        sendMessage(userInput.trim());
      }
    } else {
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
              {/* Hamburger Menu Button */}
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowShare(true)}
              >
                <Share className="h-5 w-5" />
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
          <div className="w-1/4 flex flex-col bg-white border-r">
            {/* Status Bar */}
            {currentStatus && (
              <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-sm">{currentStatus.text}</span>
                </div>
                {currentStatus.progress !== null && (
                  <Progress value={currentStatus.progress} className="mt-2" />
                )}
                {currentStatus.estimated_time && (
                  <p className="text-xs text-gray-600 mt-1">
                    Estimated time: {currentStatus.estimated_time} seconds
                  </p>
                )}
              </div>
            )}

            {/* Chat Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {/* Interleave user messages and bot messages by timestamp */}
                {(() => {
                  const combined = [
                    ...userMessages.map(m => ({ ...m, messageType: 'user' as const })),
                    ...messages.map(m => ({ ...m, messageType: 'bot' as const }))
                  ];

                  const sorted = combined.sort((a, b) => {
                    // User messages have numeric timestamps
                    const timeA = a.messageType === 'user'
                      ? a.timestamp
                      : (a as any).clientTimestamp || 0; // Use client-side timestamp added in hook

                    const timeB = b.messageType === 'user'
                      ? b.timestamp
                      : (b as any).clientTimestamp || 0;

                    return timeA - timeB;
                  });

                  return sorted.map((item, index) => {
                  if (item.messageType === 'user') {
                    // Render user message
                    return (
                      <div key={item.id} className="flex gap-2 justify-end">
                        <div className="flex-1 max-w-[80%]">
                          <div className="bg-blue-600 text-white rounded-lg p-3">
                            <p className="text-sm whitespace-pre-wrap">{item.text}</p>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <User className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                    )
                  }

                  const msg = item as DirectorMessage & { messageType: 'bot' }
                  return (
                    <React.Fragment key={msg.message_id}>
                {/* Bot messages */}
                {(() => {
                  if (msg.type === 'chat_message') {
                    const chatMsg = msg as V2ChatMessage
                    // Detect if this is a preview link message
                    const isPreviewLink = chatMsg.payload.text.includes('📊') &&
                                          chatMsg.payload.text.toLowerCase().includes('preview');

                    return (
                      <div className="flex gap-2">
                        <div className="flex-shrink-0">
                          <Bot className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className={`rounded-lg p-3 ${
                            isPreviewLink
                              ? 'bg-blue-50 border border-blue-200'
                              : 'bg-gray-100'
                          }`}>
                            <div className="text-sm prose prose-sm max-w-none">
                              <ReactMarkdown
                                components={{
                                  a: ({node, ...props}) => (
                                    <a
                                      {...props}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline font-medium"
                                    />
                                  ),
                                  p: ({node, ...props}) => <p {...props} className="text-sm mb-0" />,
                                  strong: ({node, ...props}) => <strong {...props} className="font-semibold" />
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
                    return (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <div className="flex-shrink-0">
                            <Bot className="h-6 w-6 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="bg-gray-100 rounded-lg p-3">
                              <p className="text-sm font-medium">{actionMsg.payload.prompt_text}</p>
                            </div>
                          </div>
                        </div>
                        <div className="ml-8 flex flex-wrap gap-2">
                          {actionMsg.payload.actions.map((action, i) => (
                            <Button
                              key={i}
                              size="sm"
                              variant={action.primary ? "default" : "outline"}
                              onClick={() => handleActionClick(action)}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )
                  } else if (msg.type === 'status_update') {
                    const statusMsg = msg as StatusUpdate
                    return (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{statusMsg.payload.text}</span>
                        {statusMsg.payload.progress !== null && (
                          <span className="text-xs">
                            ({statusMsg.payload.progress}%)
                          </span>
                        )}
                      </div>
                    )
                  } else if (msg.type === 'slide_update') {
                    const slideMsg = msg as SlideUpdate
                    return (
                      <div className="flex gap-2">
                        <div className="flex-shrink-0">
                          <Bot className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-blue-800">
                              📊 Presentation Plan: {slideMsg.payload.metadata.main_title}
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                              {slideMsg.payload.slides.length} slides • {slideMsg.payload.metadata.presentation_duration} minutes • Theme: {slideMsg.payload.metadata.overall_theme}
                            </p>
                            <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                              {slideMsg.payload.slides.map((slide, i) => (
                                <div key={i} className="text-xs bg-white rounded p-2">
                                  <span className="font-medium text-gray-700">
                                    {slide.slide_number}. {slide.title}
                                  </span>
                                  <span className="text-gray-500 ml-2">({slide.slide_type})</span>
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
                      <div className="flex gap-2">
                        <div className="flex-shrink-0">
                          <Bot className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-green-800">
                              ✅ {presMsg.payload.message}
                            </p>
                            <p className="text-xs text-green-600 mt-1">
                              {presMsg.payload.slide_count} slides generated successfully
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2"
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
            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder={!isReady ? "Connecting to Director..." : "Type your message..."}
                  disabled={!isReady}
                  className="resize-none"
                  rows={3}
                />
                <Button
                  type="submit"
                  disabled={!isReady || !inputMessage.trim()}
                  size="icon"
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* Right Panel - Presentation Display (75%) */}
          <div className="flex-1 flex flex-col bg-gray-100 relative">
            {/* Download Controls - Floating at top-right */}
            <div className="absolute top-4 right-4 z-10">
              <PresentationDownloadControls
                presentationId={presentationId}
                stage={currentStage}
              />
            </div>

            {presentationUrl ? (
              <div className="flex-1 flex items-center justify-center p-8">
                {/* 16:9 aspect ratio container */}
                <div className="w-full h-full flex items-center justify-center">
                  <div
                    className="relative w-full bg-black shadow-2xl"
                    style={{
                      aspectRatio: '16 / 9',
                      maxHeight: 'calc(100% - 2rem)',
                      maxWidth: 'calc((100vh - 2rem - 4rem) * 16 / 9)' // Account for header height
                    }}
                  >
                    <iframe
                      src={presentationUrl}
                      className="absolute inset-0 w-full h-full border-none"
                      title="Presentation"
                      allow="fullscreen"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg text-gray-600">Your presentation will appear here</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Start by telling Director what presentation you'd like to create
                  </p>
                </div>
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
      <BuilderContent />
    </WebSocketErrorBoundary>
  )
}