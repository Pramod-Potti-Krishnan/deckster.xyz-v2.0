"use client"

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useDecksterWebSocketV2, type DirectorMessage, type ActionRequest, type SlideUpdate } from "@/hooks/use-deckster-websocket-v2"
import { useChatSessions } from "@/hooks/use-chat-sessions"
import { useSessionPersistence } from "@/hooks/use-session-persistence"
import { WebSocketErrorBoundary } from "@/components/error-boundary"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatHistorySidebar } from "@/components/chat-history-sidebar"
import { OnboardingModal } from "@/components/onboarding-modal"
import { useFileUpload } from '@/hooks/use-file-upload'
import { features } from '@/lib/config'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { SlideGenerationPanel } from '@/components/slide-generation-panel'
import { TextBoxFormatPanel } from '@/components/textbox-format-panel'
import { TextBoxFormatting } from '@/components/presentation-viewer'
import { ElementFormatPanel } from '@/components/element-format-panel'
import { ElementType, ElementProperties } from '@/types/elements'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { GenerationPanel } from '@/components/generation-panel'
import { useGenerationPanel } from '@/hooks/use-generation-panel'
import { useBlankElements } from '@/hooks/use-blank-elements'
import { useTextLabsSession } from '@/hooks/use-textlabs-session'
import {
  ContentContextForm,
  ContentContext,
  DEFAULT_CONTENT_CONTEXT,
} from '@/components/content-context-form'
import {
  RegenerationWarningDialog,
  useRegenerationWarning
} from '@/components/regeneration-warning-dialog'
import { ContentContextPayload } from '@/hooks/use-deckster-websocket-v2'

// Extracted components
import { MessageList } from '@/components/builder/message-list'
import { ChatInput } from '@/components/builder/chat-input'
import { BuilderHeader } from '@/components/builder/builder-header'
import { PresentationArea } from '@/components/builder/presentation-area'

// Extracted hooks
import { useBuilderSession } from '@/hooks/use-builder-session'
import { useTextLabsGeneration } from '@/hooks/use-textlabs-generation'

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

function BuilderContent() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Session management
  const { loadSession, createSession } = useChatSessions()

  // UI state
  const [inputMessage, setInputMessage] = useState("")
  const [showChatHistory, setShowChatHistory] = useState(false)
  const [researchEnabled, setResearchEnabled] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
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
  const [showChat, setShowChat] = useState(true)
  // Text box selection state
  const [showTextBoxPanel, setShowTextBoxPanel] = useState(false)
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)
  const [selectedTextBoxFormatting, setSelectedTextBoxFormatting] = useState<TextBoxFormatting | null>(null)
  // Element selection state
  const [showElementPanel, setShowElementPanel] = useState(false)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [selectedElementType, setSelectedElementType] = useState<ElementType | null>(null)
  const [selectedElementProperties, setSelectedElementProperties] = useState<ElementProperties | null>(null)
  // Layout Service API handlers
  const [layoutServiceApis, setLayoutServiceApis] = useState<{
    getSelectionInfo: () => Promise<{ hasSelection: boolean; selectedText?: string; sectionId?: string; slideIndex?: number } | null>
    updateSectionContent: (slideIndex: number, sectionId: string, content: string) => Promise<boolean>
    sendTextBoxCommand: (action: string, params: Record<string, any>) => Promise<any>
    sendElementCommand: (action: string, params: Record<string, any>) => Promise<any>
  } | null>(null)


  // Content context for presentation generation
  const [contentContext, setContentContext] = useState<ContentContext>(DEFAULT_CONTENT_CONTEXT)
  const [showContentContextPanel, setShowContentContextPanel] = useState(false)
  const [hasGeneratedContent, setHasGeneratedContent] = useState(false)

  // Toast notifications
  const { toast } = useToast()

  // Current slide tracking
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)

  // Portal target for toolbar in header
  const [toolbarPortalTarget, setToolbarPortalTarget] = useState<HTMLDivElement | null>(null)

  // Text Labs Generation Panel
  const generationPanel = useGenerationPanel()
  const blankElements = useBlankElements()

  // LHS column is open when any panel or chat is visible
  const isLHSOpen = showChat || generationPanel.isOpen || showFormatPanel
    || showTextBoxPanel || showElementPanel || showContentContextPanel

  // FIXED: Track when generating final/strawman presentations
  const [isGeneratingFinal, setIsGeneratingFinal] = useState(false)
  const [isGeneratingStrawman, setIsGeneratingStrawman] = useState(false)
  const [isUnsavedSession, setIsUnsavedSession] = useState(false)

  // Guard to prevent concurrent executions of handleSendMessage
  const isExecutingSendRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // CRITICAL: currentSessionId must be declared here in page.tsx (not inside useBuilderSession)
  // so useSessionPersistence gets the correct sessionId synchronously — no multi-render delay.
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlSessionId = params.get('session_id')
      if (urlSessionId && urlSessionId !== 'new') return urlSessionId
    }
    return null
  })

  const persistence = useSessionPersistence({
    sessionId: currentSessionId || '',
    enabled: !!currentSessionId && !isUnsavedSession,
    debounceMs: 500,
    onError: (error) => {
      console.error('Persistence error:', error)
    }
  })

  // CRITICAL FIX: Use refs to avoid stale closures in onSessionStateChange callback
  const persistenceRef = useRef(persistence)
  useEffect(() => {
    persistenceRef.current = persistence
  }, [persistence])

  const currentSessionIdRef = useRef(currentSessionId)
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  // WebSocket v2 integration
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
    blankPresentationUrl,
    blankPresentationId,
    isBlankPresentation,
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
    // Don't auto-connect when restoring an existing session from URL.
    // The useBuilderSession hook will connect AFTER DB load + restoreMessages,
    // preventing Director's blank state from flashing before restored content.
    autoConnect: features.immediateConnection && !currentSessionId,
    existingSessionId: currentSessionId || undefined,
    reconnectOnError: false,
    maxReconnectAttempts: 0,
    reconnectDelay: 5000,
    onSessionStateChange: (state) => {
      console.log('🔔 CALLBACK INVOKED!', {
        currentSessionId: currentSessionIdRef.current,
        hasPersistence: !!persistenceRef.current,
        currentStage: state.currentStage,
        hasUrl: !!state.presentationUrl,
        hasPresentationId: !!state.presentationId
      });

      if (currentSessionIdRef.current && persistenceRef.current) {
        const isStrawman = state.currentStage === 4
        const isFinal = state.currentStage === 6

        const updates: any = {
          currentStage: state.currentStage,
          slideCount: state.slideCount,
          lastMessageAt: new Date(),
          stateCache: {
            activeVersion: state.activeVersion,
            slideStructure: state.slideStructure
          }
        }

        if (isStrawman) {
          updates.strawmanPreviewUrl = state.presentationUrl
          updates.strawmanPresentationId = state.presentationId
          console.log('💾 Saving strawman URLs:', { url: state.presentationUrl, id: state.presentationId, activeVersion: state.activeVersion })
        } else if (isFinal) {
          updates.finalPresentationUrl = state.presentationUrl
          updates.finalPresentationId = state.presentationId
          console.log('💾 Saving final URLs:', { url: state.presentationUrl, id: state.presentationId, activeVersion: state.activeVersion })
        }

        persistenceRef.current.updateMetadata(updates)
      } else {
        console.error('❌ PERSISTENCE BLOCKED:', {
          reason: !currentSessionIdRef.current ? 'No currentSessionId' : 'No persistenceRef.current',
          currentSessionId: currentSessionIdRef.current,
          hasPersistenceRef: !!persistenceRef.current
        });
      }
    }
  })

  // Builder session hook (session init, loading, switching, persistence effects)
  const session = useBuilderSession({
    user,
    isAuthLoading,
    searchParams,
    loadSession,
    createSession,
    persistence,
    connected,
    connecting,
    connect,
    clearMessages,
    restoreMessages,
    updateCacheUserMessages,
    messages,
    toast,
    isUnsavedSession,
    setIsUnsavedSession,
    currentSessionId,
    setCurrentSessionId,
  })

  // Text Labs session (depends on presentationId from WebSocket)
  const textLabsSession = useTextLabsSession(presentationId)

  // Track active blank element for real-time canvas<->modal position sync
  const trackElementRef = useRef(blankElements.trackElement)
  trackElementRef.current = blankElements.trackElement
  useEffect(() => {
    trackElementRef.current(generationPanel.blankElementId)
  }, [generationPanel.blankElementId])

  // Text Labs generation hook
  const { handleGenerate: handleTextLabsGenerate, handleOpenPanel: handleOpenGenerationPanel } = useTextLabsGeneration({
    generationPanel,
    blankElements,
    textLabsSession,
    layoutServiceApis,
    currentSlideIndex,
    toast,
  })

  // File upload state
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

  // Helper: Convert ContentContext to ContentContextPayload format for WebSocket
  const toContentContextPayload = useCallback((ctx: ContentContext): ContentContextPayload => ({
    audience: { audience_type: ctx.audience_type },
    purpose: { purpose_type: ctx.purpose_type },
    time: { duration_minutes: ctx.duration_minutes }
  }), [])

  // Regeneration warning dialog
  const regenerationWarning = useRegenerationWarning({
    currentContext: contentContext,
    onRegenerate: async (newContext: ContentContext) => {
      console.log('🔄 Regenerating content with new context:', newContext)
      setContentContext(newContext)
      setShowContentContextPanel(false)
    }
  })

  // FIXED: Clear loading state when final presentation URL arrives
  useEffect(() => {
    if (finalPresentationUrl && isGeneratingFinal) {
      setIsGeneratingFinal(false)
      console.log('✅ Final presentation ready - hiding loader')
    }
  }, [finalPresentationUrl, isGeneratingFinal])

  // Infer current stage from available data
  const currentStage = useMemo(() => {
    if (presentationUrl) return 6;
    if (slideCount && slideCount > 0) return 5;
    if (slideStructure && (slideStructure as any).length > 0) return 4;
    return 3;
  }, [presentationUrl, slideCount, slideStructure])

  // Set strawman generation flag
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
  }, [messages, session.userMessages])

  // Check if user is new and should see onboarding
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const isNewUser = urlParams.get('new') === 'true'

    if (isNewUser && user) {
      setShowOnboarding(true)
      window.history.replaceState({}, '', '/builder')
    }
  }, [user])

  // Handle sending messages
  const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputMessage.trim()) return

    if (!user) {
      console.warn('⚠️ Cannot send message: user not authenticated')
      return
    }

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

        session.userMessageIdsRef.current.add(messageId)

        session.setUserMessages(prev => [...prev, {
          id: messageId,
          text: action.label,
          timestamp: timestamp
        }])

        if (currentSessionId && persistence) {
          persistence.queueMessage({
            message_id: messageId,
            session_id: currentSessionId,
            timestamp: new Date(timestamp).toISOString(),
            type: 'chat_message',
            payload: { text: action.label, action_value: action.value }
          } as unknown as DirectorMessage, action.label)
        }

        const successfulFiles = uploadedFiles.filter(f => f.status === 'success')
        const storeName = successfulFiles.length > 0 ? successfulFiles[0].geminiStoreName : undefined
        const fileCount = successfulFiles.length

        const success = sendMessage(messageText, storeName, fileCount, toContentContextPayload(contentContext))
        if (success) {
          setInputMessage("")
          setPendingActionInput(null)
          if (successfulFiles.length > 0) {
            clearAllFiles()
          }
          setHasGeneratedContent(true)
        }

        setTimeout(() => {
          isExecutingSendRef.current = false
        }, 500)
        return
      }

      // For unsaved sessions, create database session first
      if (isUnsavedSession) {
        console.log('💾 Creating database session for first message')
        const newSessionId = currentSessionId || wsSessionId

        try {
          const dbSession = await createSession(newSessionId)

          if (dbSession) {
            session.justCreatedSessionRef.current = dbSession.id
            setIsUnsavedSession(false)
            if (!currentSessionId) {
              setCurrentSessionId(dbSession.id)
              router.push(`/builder?session_id=${dbSession.id}`)
            }
            console.log('✅ Database session created:', dbSession.id)

            const messageId = crypto.randomUUID()
            const timestamp = Date.now()

            session.userMessageIdsRef.current.add(messageId)

            session.setUserMessages(prev => [...prev, {
              id: messageId,
              text: messageText,
              timestamp: timestamp
            }])

            // FIX 11: Save first message directly via API
            try {
              const firstMessagePayload = {
                id: messageId,
                messageType: 'chat_message',
                timestamp: new Date(timestamp).toISOString(),
                payload: { text: messageText },
                userText: messageText,
              }

              console.log('💾 [FIX 11] Saving first message directly via API:', {
                sessionId: dbSession.id,
                messageId,
                userText: messageText.substring(0, 30)
              })

              const response = await fetch(`/api/sessions/${dbSession.id}/messages`, {
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

              if (persistence) {
                const generatedTitle = persistence.generateTitle(messageText)
                console.log('📝 Setting initial title from first message:', generatedTitle)

                await fetch(`/api/sessions/${dbSession.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: generatedTitle }),
                })
                session.hasTitleFromUserMessageRef.current = true
              }
            } catch (error) {
              console.error('❌ [FIX 11] Error saving first message:', error)
            }

            setInputMessage("")

            const successfulFiles = uploadedFiles.filter(f => f.status === 'success')
            const storeName = successfulFiles.length > 0 ? successfulFiles[0].geminiStoreName : undefined
            const fileCount = successfulFiles.length

            sendMessage(messageText, storeName, fileCount, toContentContextPayload(contentContext))
            setHasGeneratedContent(true)
            if (successfulFiles.length > 0) {
              clearAllFiles()
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
      if (session.isResumedSession && !connected && !connecting) {
        console.log('🔌 Connecting WebSocket for first message in resumed session')
        connect()
        session.setIsResumedSession(false)

        const messageId = crypto.randomUUID()
        const timestamp = Date.now()

        session.userMessageIdsRef.current.add(messageId)

        session.setUserMessages(prev => [...prev, {
          id: messageId,
          text: messageText,
          timestamp: timestamp
        }])

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

        setInputMessage("")

        const successfulFiles = uploadedFiles.filter(f => f.status === 'success')
        const storeName = successfulFiles.length > 0 ? successfulFiles[0].geminiStoreName : undefined
        const fileCount = successfulFiles.length

        setTimeout(() => {
          sendMessage(messageText, storeName, fileCount, toContentContextPayload(contentContext))
          setHasGeneratedContent(true)
          if (successfulFiles.length > 0) {
            clearAllFiles()
          }
        }, 200)
        return
      }

      // Normal check for connection
      if (!isReady) return

      const messageId = crypto.randomUUID()
      const timestamp = Date.now()

      session.userMessageIdsRef.current.add(messageId)

      session.setUserMessages(prev => [...prev, {
        id: messageId,
        text: messageText,
        timestamp: timestamp
      }])

      if (currentSessionId && persistence) {
        persistence.queueMessage({
          message_id: messageId,
          session_id: currentSessionId,
          timestamp: new Date(timestamp).toISOString(),
          type: 'chat_message',
          payload: { text: messageText }
        } as DirectorMessage, messageText)

        if (!session.hasTitleFromUserMessageRef.current && !session.hasTitleFromPresentationRef.current) {
          const generatedTitle = persistence.generateTitle(messageText)
          console.log('📝 Setting initial title from first message:', generatedTitle)
          persistence.updateMetadata({
            title: generatedTitle
          })
          session.hasTitleFromUserMessageRef.current = true
        }
      }

      const successfulFiles = uploadedFiles.filter(f => f.status === 'success')
      const storeName = successfulFiles.length > 0 ? successfulFiles[0].geminiStoreName : undefined
      const fileCount = successfulFiles.length

      const success = sendMessage(messageText, storeName, fileCount, toContentContextPayload(contentContext))
      if (success) {
        setInputMessage("")
        setHasGeneratedContent(true)
        if (successfulFiles.length > 0) {
          clearAllFiles()
        }
      }
    } finally {
      setTimeout(() => {
        isExecutingSendRef.current = false
      }, 500)
    }
  }, [inputMessage, isReady, sendMessage, currentSessionId, persistence, session.isResumedSession, connected, connecting, connect, isUnsavedSession, createSession, router, uploadedFiles, clearAllFiles, contentContext, toContentContextPayload])

  // Handle action button clicks
  const handleActionClick = useCallback((action: ActionRequest['payload']['actions'][0], actionRequestMessageId: string) => {
    const messageId = crypto.randomUUID()
    const timestamp = Date.now()

    session.answeredActionsRef.current.add(actionRequestMessageId)
    console.log(`✅ Marked action request ${actionRequestMessageId} as answered`)

    if (action.requires_input) {
      setPendingActionInput({ action, messageId, timestamp })
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    } else {
      session.userMessageIdsRef.current.add(messageId)

      session.setUserMessages(prev => [...prev, {
        id: messageId,
        text: action.label,
        timestamp: timestamp
      }])

      if (currentSessionId && persistence) {
        persistence.queueMessage({
          message_id: messageId,
          session_id: currentSessionId,
          timestamp: new Date(timestamp).toISOString(),
          type: 'chat_message',
          payload: { text: action.label, action_value: action.value }
        } as unknown as DirectorMessage, action.label)
      }

      if (action.value === 'accept_strawman') {
        setIsGeneratingFinal(true)
        console.log('🎨 Starting final deck generation - showing loader')
      }

      sendMessage(action.value)
    }
  }, [sendMessage, currentSessionId, persistence])

  // Wrapped session select handler (clears local UI state too)
  const handleSessionSelectWrapped = useCallback((sessionId: string) => {
    setIsGeneratingFinal(false)
    setIsGeneratingStrawman(false)
    setShowChatHistory(false)
    session.handleSessionSelect(sessionId)
  }, [session.handleSessionSelect])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <BuilderHeader
          wsError={wsError}
          onOpenChatHistory={() => setShowChatHistory(true)}
          toolbarSlotRef={setToolbarPortalTarget}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Chat (w-80 when open, 0 when collapsed) */}
          <div className={cn(
            "flex flex-col bg-white relative overflow-hidden min-w-0 flex-shrink-0 transition-[width] duration-300 ease-out",
            isLHSOpen ? "w-96" : "w-0"
          )}>
            {/* Content Context Panel - Overlays chat when open */}
            {showContentContextPanel && (
              <div className="absolute inset-0 z-30 bg-white flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Presentation Settings</h3>
                  <button
                    className="text-gray-500 hover:text-gray-700"
                    onClick={() => setShowContentContextPanel(false)}
                  >
                    ✕
                  </button>
                </div>
                <div className="p-4 overflow-auto flex-1">
                  <ContentContextForm
                    value={contentContext}
                    onChange={(newContext) => {
                      if (hasGeneratedContent) {
                        regenerationWarning.showWarning(newContext)
                      } else {
                        setContentContext(newContext)
                      }
                    }}
                    disabled={regenerationWarning.isRegenerating}
                  />
                  {hasGeneratedContent && (
                    <p className="mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                      Changing these settings will regenerate your presentation content.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Slide Generation Panel - Overlays chat when open */}
            <SlideGenerationPanel
              isOpen={showFormatPanel}
              onClose={() => setShowFormatPanel(false)}
              currentSlide={currentSlideIndex + 1}
            />

            {/* Text Box Format Panel */}
            <TextBoxFormatPanel
              isOpen={showTextBoxPanel}
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
              slideIndex={currentSlideIndex}
              sessionId={currentSessionId}
            />

            {/* Element/Slide Format Panel */}
            {presentationId && (
              <ElementFormatPanel
                isOpen={showElementPanel}
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
                slideIndex={currentSlideIndex}
              />
            )}

            {/* Generation Panel */}
            {features.useTextLabsGeneration && (
              <GenerationPanel
                isOpen={generationPanel.isOpen}
                elementType={generationPanel.elementType}
                onClose={() => {
                  generationPanel.closePanel()
                }}
                onReopen={generationPanel.reopenPanel}
                onGenerate={handleTextLabsGenerate}
                onElementTypeChange={generationPanel.changeElementType}
                isGenerating={generationPanel.isGenerating}
                error={generationPanel.error}
                slideIndex={currentSlideIndex}
                elementContext={blankElements.activePosition}
              />
            )}

            {/* Chat Messages — only shown when Deck handle is active */}
            {showChat && (
              <>
                <ScrollArea className="flex-1">
                  <div className="px-3 py-4 space-y-4">
                    <MessageList
                      userMessages={session.userMessages}
                      messages={messages}
                      userMessageIdsRef={session.userMessageIdsRef}
                      userMessageContentMapRef={session.userMessageContentMapRef}
                      hasSeenWelcomeRef={session.hasSeenWelcomeRef}
                      answeredActionsRef={session.answeredActionsRef}
                      onActionClick={handleActionClick}
                      messagesEndRef={messagesEndRef}
                    />
                  </div>
                </ScrollArea>

                <ChatInput
                  inputMessage={inputMessage}
                  onInputChange={setInputMessage}
                  onSubmit={handleSendMessage}
                  uploadedFiles={uploadedFiles}
                  onFilesSelected={handleFilesSelected}
                  onRemoveFile={removeFile}
                  onClearAllFiles={clearAllFiles}
                  pendingActionInput={pendingActionInput}
                  onCancelAction={() => {
                    setPendingActionInput(null)
                    setInputMessage("")
                  }}
                  researchEnabled={researchEnabled}
                  onResearchEnabledChange={setResearchEnabled}
                  webSearchEnabled={webSearchEnabled}
                  onWebSearchEnabledChange={setWebSearchEnabled}
                  isReady={isReady}
                  isLoadingSession={session.isLoadingSession}
                  connected={connected}
                  connecting={connecting}
                  user={user}
                  currentSessionId={currentSessionId}
                  onRequestSession={session.handleRequestSession}
                />
              </>
            )}
          </div>

          {/* Handle strip — sits at right edge of panel, moves with it */}
          <div className="relative w-0 flex-shrink-0 z-20">
            {/* Element handle */}
            {features.useTextLabsGeneration && (
              <button
                type="button"
                onClick={() => {
                  if (generationPanel.isOpen) {
                    generationPanel.closePanel()
                  } else {
                    generationPanel.reopenPanel()
                  }
                }}
                className={cn(
                  "absolute top-[33%] -translate-y-1/2 left-0",
                  "w-4 py-3 rounded-r-md shadow-sm border border-l-0",
                  "flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                  "transition-colors",
                  generationPanel.isOpen
                    ? "bg-purple-200 hover:bg-purple-300 border-purple-400 text-purple-700"
                    : "bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-600"
                )}
                title={generationPanel.isOpen ? 'Close element panel' : 'Open element panel'}
              >
                {generationPanel.isOpen ? (
                  <ChevronLeft className="h-2.5 w-2.5" />
                ) : (
                  <ChevronRight className="h-2.5 w-2.5" />
                )}
                <span className="[writing-mode:vertical-rl] text-[8px] font-medium select-none leading-none">
                  Element
                </span>
              </button>
            )}

            {/* Slide handle */}
            <button
              type="button"
              onClick={() => setShowFormatPanel(prev => !prev)}
              className={cn(
                "absolute top-[45%] -translate-y-1/2 left-0",
                "w-4 py-3 rounded-r-md shadow-sm border border-l-0",
                "flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                "transition-colors",
                showFormatPanel
                  ? "bg-blue-200 hover:bg-blue-300 border-blue-400 text-blue-700"
                  : "bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-600"
              )}
              title={showFormatPanel ? 'Close slide panel' : 'Open slide panel'}
            >
              {showFormatPanel ? (
                <ChevronLeft className="h-2.5 w-2.5" />
              ) : (
                <ChevronRight className="h-2.5 w-2.5" />
              )}
              <span className="[writing-mode:vertical-rl] text-[8px] font-medium select-none leading-none">
                Slide
              </span>
            </button>

            {/* Deck handle */}
            <button
              type="button"
              onClick={() => setShowChat(prev => !prev)}
              className={cn(
                "absolute top-[57%] -translate-y-1/2 left-0",
                "w-4 py-3 rounded-r-md shadow-sm border border-l-0",
                "flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                "transition-colors",
                showChat
                  ? "bg-purple-200 hover:bg-purple-300 border-purple-400 text-purple-700"
                  : "bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-600"
              )}
              title={showChat ? 'Close chat panel' : 'Open chat panel'}
            >
              {showChat ? (
                <ChevronLeft className="h-2.5 w-2.5" />
              ) : (
                <ChevronRight className="h-2.5 w-2.5" />
              )}
              <span className="[writing-mode:vertical-rl] text-[8px] font-medium select-none leading-none">
                Deck
              </span>
            </button>
          </div>

          {/* Right Panel - Presentation Display (flex-1) */}
          {session.isLoadingSession ? (
            <div className="flex-1 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="h-8 w-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Loading session...</p>
              </div>
            </div>
          ) : (
          <PresentationArea
            presentationUrl={presentationUrl}
            presentationId={presentationId}
            slideCount={slideCount}
            slideStructure={slideStructure}
            strawmanPreviewUrl={strawmanPreviewUrl}
            finalPresentationUrl={finalPresentationUrl}
            activeVersion={activeVersion}
            onVersionSwitch={switchVersion}
            currentStage={currentStage}
            currentSlideIndex={currentSlideIndex}
            onSlideChange={(slideNum) => {
              setCurrentSlideIndex(slideNum - 1)
            }}
            currentStatus={currentStatus}
            isGeneratingFinal={isGeneratingFinal}
            isGeneratingStrawman={isGeneratingStrawman}
            onApiReady={setLayoutServiceApis}
            onTextBoxSelected={(elementId, formatting) => {
              setSelectedTextBoxId(elementId)
              setSelectedTextBoxFormatting(formatting)
              setShowTextBoxPanel(true)
              setShowElementPanel(false)
              setShowFormatPanel(false)
            }}
            onTextBoxDeselected={() => {
              setSelectedTextBoxId(null)
              setSelectedTextBoxFormatting(null)
            }}
            onElementSelected={(elementId, elementType, properties) => {
              setSelectedElementId(elementId)
              setSelectedElementType(elementType)
              setSelectedElementProperties(properties)
              setShowElementPanel(true)
              setShowTextBoxPanel(false)
              setShowFormatPanel(false)
            }}
            onElementDeselected={() => {
              setSelectedElementId(null)
              setSelectedElementType(null)
              setSelectedElementProperties(null)
            }}
            blankElements={blankElements}
            generationPanel={generationPanel}
            onOpenGenerationPanel={features.useTextLabsGeneration ? handleOpenGenerationPanel : undefined}
            connected={connected}
            connecting={connecting}
            showContentContextPanel={showContentContextPanel}
            onToggleContentContextPanel={() => setShowContentContextPanel(!showContentContextPanel)}
            hasGeneratedContent={hasGeneratedContent}
            contentContext={contentContext}
            toolbarPortalTarget={toolbarPortalTarget}
          />
          )}
        </div>
      </div>

      {/* Chat History Sidebar */}
      <ChatHistorySidebar
        isOpen={showChatHistory}
        onClose={() => setShowChatHistory(false)}
        currentSessionId={currentSessionId || undefined}
        onSessionSelect={handleSessionSelectWrapped}
        onNewChat={session.handleNewChat}
      />

      {/* Onboarding Modal */}
      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />

      {/* Regeneration Warning Dialog */}
      <RegenerationWarningDialog {...regenerationWarning.dialogProps} />
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
