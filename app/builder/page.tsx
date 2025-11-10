"use client"

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useDecksterWebSocketV2, type DirectorMessage, type ChatMessage as V2ChatMessage, type ActionRequest, type StatusUpdate, type PresentationURL, type SlideUpdate } from "@/hooks/use-deckster-websocket-v2"
import ReactMarkdown from 'react-markdown'
import { WebSocketErrorBoundary } from "@/components/error-boundary"
import { ConnectionError } from "@/components/connection-error"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserProfileMenu } from "@/components/user-profile-menu"
import { Textarea } from "@/components/ui/textarea"
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

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

function BuilderContent() {
  const { user, isLoading: isAuthLoading } = useAuth()

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
    sendMessage,
    clearMessages,
    isReady
  } = useDecksterWebSocketV2({
    autoConnect: true,
    reconnectOnError: false, // Disabled for now to stop loop
    maxReconnectAttempts: 0,
    reconnectDelay: 5000
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

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, userMessages])

  // Handle sending messages
  const handleSendMessage = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputMessage.trim() || !isReady) return

    const messageText = inputMessage.trim()

    // Add user message to local state
    setUserMessages(prev => [...prev, {
      id: `user_${Date.now()}`,
      text: messageText,
      timestamp: Date.now() // Store as milliseconds for easier comparison
    }])

    const success = sendMessage(messageText)
    if (success) {
      setInputMessage("")
    }
  }, [inputMessage, isReady, sendMessage])

  // Handle action button clicks
  const handleActionClick = useCallback((action: ActionRequest['payload']['actions'][0]) => {
    // Add user message to local state (show label to user)
    setUserMessages(prev => [...prev, {
      id: `user_${Date.now()}`,
      text: action.label,
      timestamp: Date.now() // Store as milliseconds for easier comparison
    }])

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
  }, [sendMessage])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <header className="bg-white border-b h-16 flex-shrink-0">
          <div className="h-full px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
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
                    <React.Fragment key={(msg as any).clientTimestamp || Math.random()}>
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
          <div className="flex-1 flex flex-col bg-gray-100">
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