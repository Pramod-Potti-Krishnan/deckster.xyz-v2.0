"use client"

import React, { useMemo, useEffect, useRef, useState } from "react"
import ReactMarkdown from 'react-markdown'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sparkles,
  ExternalLink,
  User,
  ChevronDown,
} from "lucide-react"
import {
  type DirectorMessage,
  type ChatMessage as V2ChatMessage,
  type ActionRequest,
  type SlideUpdate,
  type PresentationURL,
  type SlideContextItem,
} from "@/hooks/use-deckster-websocket-v2"
import { debugLog } from "@/lib/debug-log"

export interface MessageListProps {
  sessionId?: string | null
  userMessages: Array<{ id: string; text: string; timestamp: number }>
  messages: DirectorMessage[]
  userMessageIdsRef: React.RefObject<Set<string>>
  userMessageContentMapRef: React.RefObject<Map<string, string>>
  hasSeenWelcomeRef: React.RefObject<boolean>
  answeredActionsRef: React.RefObject<Set<string>>
  onActionClick: (action: ActionRequest['payload']['actions'][0], messageId: string) => void
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  // Rich strawman: per-slide context keyed by slide_index. Drives narrative_role chip + key_message subtitle.
  slideContextByIndex?: Record<number, SlideContextItem> | null
  // Thinking-stream: increments once the real strawman slide_update lands.
  ephemeralFadeToken?: number
  // Thinking-stream: IDs of ephemeral chat_messages currently in the transcript.
  ephemeralMessageIds?: string[]
  // Thinking-stream: called after the fade animation finishes so the WS hook can drain its tracked IDs.
  onEphemeralFadeComplete?: () => void
}

export function MessageList({
  sessionId,
  userMessages,
  messages,
  userMessageIdsRef,
  userMessageContentMapRef,
  hasSeenWelcomeRef,
  answeredActionsRef,
  onActionClick,
  messagesEndRef,
  slideContextByIndex,
  ephemeralFadeToken,
  ephemeralMessageIds,
  onEphemeralFadeComplete,
}: MessageListProps) {
  // Thinking-stream fade-out: when slide_update lands, fade tracked ephemeral
  // chat bubbles to opacity 0 over 300ms then unmount them on the next tick.
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set())
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const [expandedThinkingGroups, setExpandedThinkingGroups] = useState<Set<string>>(new Set())
  const lastFadeTokenRef = useRef(0)

  useEffect(() => {
    setFadingIds(new Set())
    setRemovedIds(new Set())
    setExpandedThinkingGroups(new Set())
    lastFadeTokenRef.current = 0
  }, [sessionId])

  useEffect(() => {
    if (!ephemeralFadeToken) {
      lastFadeTokenRef.current = 0
      return
    }
    if (ephemeralFadeToken === lastFadeTokenRef.current || !ephemeralMessageIds?.length) return
    lastFadeTokenRef.current = ephemeralFadeToken

    const idsToFade = ephemeralMessageIds
    setFadingIds(prev => {
      const next = new Set(prev)
      for (const id of idsToFade) next.add(id)
      return next
    })
    const t = setTimeout(() => {
      setRemovedIds(prev => {
        const next = new Set(prev)
        for (const id of idsToFade) next.add(id)
        return next
      })
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      onEphemeralFadeComplete?.()
    }, 350) // 300ms transition + 50ms buffer
    return () => clearTimeout(t)
  }, [ephemeralFadeToken, ephemeralMessageIds, messagesEndRef, onEphemeralFadeComplete])
  // Combine, classify, deduplicate, sort, filter, and group messages
  const processedMessages = useMemo(() => {
    const trackedEphemeralIds = new Set(ephemeralMessageIds || [])
    const combined = [
      ...userMessages.map(m => ({ ...m, messageType: 'user' as const })),
      ...messages.map(m => {
        const mAny = m as any;
        let classificationMethod = 'DEFAULT';

        // PRIORITY 1: Check Director's role field (proper fix from Director team)
        if (mAny.role === 'user') {
          userMessageIdsRef.current.add(m.message_id);
          classificationMethod = 'ROLE_FIELD';

          const text = mAny.payload?.text || mAny.content || '';
          const normalizedTimestamp = m.timestamp?.endsWith('Z') ? m.timestamp : m.timestamp + 'Z';
          const timestamp = new Date(normalizedTimestamp).getTime();

          debugLog('✅ Director role field detected, transforming to user message format:', {
            message_id: m.message_id,
            role: mAny.role,
            text: text.substring(0, 30),
            timestamp,
            method: 'ROLE_FIELD (Director fix)',
            classifiedAs: 'USER'
          });

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
        if (!isUserMessage && mAny.payload?.text) {
          const normalizedContent = (typeof mAny.payload.text === 'string' ? mAny.payload.text : '').trim().toLowerCase();
          const matchingUserId = userMessageContentMapRef.current.get(normalizedContent);
          if (matchingUserId) {
            isUserMessage = true;
            classificationMethod = 'CONTENT_MATCH';
            userMessageIdsRef.current.add(m.message_id);
            debugLog('🎯 Content match fallback (pre-Director-fix message):', {
              directorMessageId: m.message_id,
              matchedUserId: matchingUserId,
              content: normalizedContent.substring(0, 30)
            });
          }
        }

        debugLog('🔍 Message classification:', {
          message_id: m.message_id,
          payload: mAny.payload?.text?.substring(0, 30),
          hasRole: !!mAny.role,
          role: mAny.role,
          method: classificationMethod,
          isInUserMessageIds: userMessageIdsRef.current.has(m.message_id),
          classifiedAs: isUserMessage ? 'USER' : 'BOT'
        });
        return { ...m, messageType: isUserMessage ? 'user' as const : 'bot' as const };
      })
    ];

    debugLog('📊 Message rendering - userMessages:', userMessages.length, 'botMessages:', messages.length, 'combined:', combined.length);

    // Deduplicate messages by ID and content
    const seenIds = new Set<string>();
    const seenContent = new Map<string, any>();

    const deduplicated = combined.filter(item => {
      const id = item.messageType === 'user' ? item.id : (item as any).message_id;
      const content = item.messageType === 'user'
        ? item.text
        : (item as any).payload?.text || JSON.stringify((item as any).payload);

      if (seenIds.has(id)) {
        return false;
      }

      const contentKey = `${content}`.trim().toLowerCase();
      const existingMessage = seenContent.get(contentKey);

      if (existingMessage) {
        if (item.messageType === 'user' && existingMessage.messageType !== 'user') {
          seenIds.delete(existingMessage.id || existingMessage.message_id);
          seenContent.set(contentKey, item);
          seenIds.add(id);
          return true;
        } else if (item.messageType !== 'user' && existingMessage.messageType === 'user') {
          return false;
        } else {
          return false;
        }
      }

      seenIds.add(id);
      seenContent.set(contentKey, item);
      return true;
    });

    debugLog('📊 After deduplication:', deduplicated.length);

    const parseTimestamp = (ts: string | undefined): number => {
      if (!ts) return 0;
      const normalized = ts.endsWith('Z') ? ts : ts + 'Z';
      return new Date(normalized).getTime();
    };

    const sorted = deduplicated.sort((a, b) => {
      const timeA = a.messageType === 'user'
        ? a.timestamp
        : (a as any).clientTimestamp || parseTimestamp((a as any).timestamp);
      const timeB = b.messageType === 'user'
        ? b.timestamp
        : (b as any).clientTimestamp || parseTimestamp((b as any).timestamp);
      return timeA - timeB;
    });

    // Filter out duplicate welcome messages
    const filtered = sorted.filter((item, index) => {
      if (item.messageType === 'bot') {
        const msg = item as DirectorMessage;
        if (msg.type === 'chat_message') {
          const chatMsg = msg as V2ChatMessage;
          const isWelcome = chatMsg.payload.text.toLowerCase().includes("hello! i'm deckster") ||
            chatMsg.payload.text.toLowerCase().includes("what presentation would you like to build");

          if (isWelcome && hasSeenWelcomeRef.current && index > 0) {
            debugLog('🚫 Filtering duplicate welcome message on reconnect');
            return false;
          }

          if (isWelcome) {
            hasSeenWelcomeRef.current = true;
          }
        }
      }
      return true;
    });

    debugLog('📊 After filtering:', filtered.length, 'messages');
    debugLog('📊 Final message list:', filtered.map((m, i) => ({
      index: i,
      type: m.messageType,
      id: m.messageType === 'user' ? m.id : (m as any).message_id,
      text: m.messageType === 'user' ? m.text : (m as any).payload?.text?.substring(0, 50)
    })));

    // Group consecutive strawman-related messages
    const processedMessages: Array<typeof filtered[0] | {
      messageType: 'bot',
      type: 'combined_strawman',
      message_id: string,
      slideUpdate?: SlideUpdate,
      presentationUrl?: PresentationURL,
      actionRequest?: ActionRequest
    } | {
      messageType: 'bot',
      type: 'thinking_stream',
      message_id: string,
      messages: V2ChatMessage[]
    }> = [];

    let i = 0;
    while (i < filtered.length) {
      const current = filtered[i];

      if (current.messageType === 'bot') {
        const botMsg = current as DirectorMessage;

        if (botMsg.type === 'chat_message' && (botMsg as V2ChatMessage).payload.ephemeral === true) {
          const thinkingMessages: V2ChatMessage[] = []
          while (i < filtered.length && filtered[i].messageType === 'bot') {
            const maybeThinking = filtered[i] as DirectorMessage
            if (maybeThinking.type !== 'chat_message' || !(maybeThinking as V2ChatMessage).payload.ephemeral) {
              break
            }
            thinkingMessages.push(maybeThinking as V2ChatMessage)
            i++
          }

          if (thinkingMessages.length > 0) {
            const hasLaterStrawman = filtered.slice(i).some((item) => {
              if (item.messageType !== 'bot') return false
              const maybeSlideUpdate = item as DirectorMessage
              return maybeSlideUpdate.type === 'slide_update' &&
                (maybeSlideUpdate as SlideUpdate).payload.operation === 'full_update' &&
                !(maybeSlideUpdate as SlideUpdate).payload.is_blank
            })
            const isLiveTrackedGroup = thinkingMessages.some(m => trackedEphemeralIds.has(m.message_id))

            if (!hasLaterStrawman || isLiveTrackedGroup) {
              processedMessages.push({
                messageType: 'bot',
                type: 'thinking_stream',
                message_id: `thinking_${thinkingMessages[0].message_id}`,
                messages: thinkingMessages
              })
            }
            continue;
          }
        }

        if (botMsg.type === 'slide_update') {
          const slideUpdate = botMsg as SlideUpdate;
          let presentationUrl: PresentationURL | undefined;
          let actionRequest: ActionRequest | undefined;
          let consumed = 1;

          if (i + 1 < filtered.length && filtered[i + 1].messageType === 'bot') {
            const nextMsg = filtered[i + 1] as DirectorMessage;
            if (nextMsg.type === 'presentation_url') {
              presentationUrl = nextMsg as PresentationURL;
              consumed++;

              if (i + 2 < filtered.length && filtered[i + 2].messageType === 'bot') {
                const thirdMsg = filtered[i + 2] as DirectorMessage;
                if (thirdMsg.type === 'action_request') {
                  actionRequest = thirdMsg as ActionRequest;
                  consumed++;
                }
              }
            }
          }

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

      processedMessages.push(current);
      i++;
    }

    return processedMessages;
  }, [userMessages, messages, ephemeralMessageIds, userMessageIdsRef, userMessageContentMapRef, hasSeenWelcomeRef, answeredActionsRef]);

  return (
    <>
      {processedMessages.map((item, index) => {
        if (item.messageType === 'user') {
          return (
            <div key={item.id} className="flex gap-3 justify-end animate-in fade-in duration-200">
              <div className="flex-1 max-w-[85%] text-right">
                <p className="text-[11px] font-medium text-gray-500 mb-0.5">You</p>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{item.text}</p>
              </div>
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center">
                <User className="h-3 w-3 text-white" />
              </div>
            </div>
          )
        }

        const msg = item as any;
        return (
          <React.Fragment key={msg.message_id || msg.id}>
            {(() => {
              if (msg.type === 'combined_strawman') {
                const { slideUpdate, presentationUrl, actionRequest } = msg;

                return (
                  <div className="flex gap-3 animate-in fade-in duration-200">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-500 mb-0.5">Director</p>

                      {/* Slide Structure Card */}
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm">📊</span>
                          <p className="text-xs font-medium text-gray-900">
                            {slideUpdate?.payload.metadata.main_title}
                          </p>
                        </div>
                        <p className="text-[11px] text-gray-500 mb-2">
                          {slideUpdate?.payload.slides.length} slides · {slideUpdate?.payload.metadata.presentation_duration} min · {slideUpdate?.payload.metadata.overall_theme}
                        </p>
                        <div className="space-y-1 max-h-36 overflow-y-auto">
                          {slideUpdate?.payload.slides.map((slide: any, i: number) => {
                            const ctx = slideContextByIndex?.[i]
                            return (
                              <div key={i} className="text-[11px] py-1 px-2 bg-white rounded border border-gray-100">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-gray-400">{slide.slide_number}.</span>
                                  <span className="text-gray-700">{slide.title}</span>
                                  {ctx?.narrative_role && (
                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-normal capitalize">
                                      {ctx.narrative_role.replace(/_/g, ' ')}
                                    </Badge>
                                  )}
                                  <span className="text-gray-400 text-[10px] uppercase ml-auto">{slide.slide_type}</span>
                                </div>
                                {ctx?.key_message && (
                                  <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 pl-3">{ctx.key_message}</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Presentation Ready */}
                      {presentationUrl && (
                        <div className="mt-2 flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                          <span className="text-sm">✅</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700">{presentationUrl.payload.message}</p>
                            <p className="text-[10px] text-gray-500">{presentationUrl.payload.slide_count} slides</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[11px] h-7 px-2 border-gray-200 hover:bg-white"
                            onClick={() => window.open(presentationUrl.payload.url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Open
                          </Button>
                        </div>
                      )}

                      {/* Action Buttons */}
                      {actionRequest && !answeredActionsRef.current.has(actionRequest.message_id) && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-700 mb-2">{actionRequest.payload.prompt_text}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {actionRequest.payload.actions.map((action: any, i: number) => (
                              <Button
                                key={i}
                                size="sm"
                                variant={action.primary ? "default" : "outline"}
                                onClick={() => onActionClick(action, actionRequest.message_id)}
                                className={action.primary
                                  ? "text-xs h-7 bg-gray-900 hover:bg-gray-800"
                                  : "text-xs h-7 border-gray-200 hover:bg-gray-50"
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
                );
              } else if (msg.type === 'thinking_stream') {
                const thinkingMessages = (msg.messages || []) as V2ChatMessage[]
                const visibleMessages = thinkingMessages.filter(m => !removedIds.has(m.message_id))
                if (visibleMessages.length === 0) return null

                const latestMessage = visibleMessages[visibleMessages.length - 1]
                const isFading = visibleMessages.some(m => fadingIds.has(m.message_id))
                const isExpanded = expandedThinkingGroups.has(msg.message_id)
                const canExpand = visibleMessages.length > 1

                return (
                  <div className={`flex gap-3 animate-in fade-in duration-200 transition-opacity duration-300 ${isFading ? 'opacity-0' : ''}`}>
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-500 mb-0.5">Director</p>
                      <div className="rounded-lg border border-purple-100 bg-purple-50/60 px-2.5 py-2">
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 text-left disabled:cursor-default"
                          disabled={!canExpand}
                          onClick={() => {
                            if (!canExpand) return
                            setExpandedThinkingGroups(prev => {
                              const next = new Set(prev)
                              if (next.has(msg.message_id)) {
                                next.delete(msg.message_id)
                              } else {
                                next.add(msg.message_id)
                              }
                              return next
                            })
                          }}
                          aria-expanded={isExpanded}
                        >
                          <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center gap-0.5">
                            <span className="h-1 w-1 rounded-full bg-purple-500 animate-pulse" />
                            <span className="h-1 w-1 rounded-full bg-purple-500 animate-pulse [animation-delay:120ms]" />
                            <span className="h-1 w-1 rounded-full bg-purple-500 animate-pulse [animation-delay:240ms]" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs text-gray-700">
                            {latestMessage.payload.text}
                          </span>
                          {canExpand && (
                            <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-purple-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 max-h-24 overflow-y-auto border-t border-purple-100 pt-2 space-y-1">
                            {visibleMessages.map((thought) => (
                              <p key={thought.message_id} className="text-[11px] leading-relaxed text-gray-500">
                                {thought.payload.text}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              } else if (msg.type === 'chat_message') {
                const chatMsg = msg as V2ChatMessage
                if (removedIds.has(chatMsg.message_id)) return null
                const isFading = fadingIds.has(chatMsg.message_id)
                return (
                  <div className={`flex gap-3 animate-in fade-in duration-200 transition-opacity duration-300 ${isFading ? 'opacity-0' : ''}`}>
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-500 mb-0.5">Director</p>
                      <div className="text-xs text-gray-700 leading-relaxed">
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
                            p: ({ node, ...props }) => <p {...props} className="leading-relaxed mb-1 last:mb-0" />,
                            strong: ({ node, ...props }) => <strong {...props} className="font-semibold text-gray-900" />,
                            ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-4 mb-1 space-y-0.5" />,
                            li: ({ node, ...props }) => <li {...props} className="leading-relaxed" />
                          }}
                        >
                          {chatMsg.payload.text}
                        </ReactMarkdown>
                      </div>
                      {chatMsg.payload.sub_title && (
                        <p className="text-[11px] text-gray-500 mt-1">{chatMsg.payload.sub_title}</p>
                      )}
                      {chatMsg.payload.list_items && chatMsg.payload.list_items.length > 0 && (
                        <ul className="text-[11px] mt-1.5 space-y-0.5">
                          {chatMsg.payload.list_items.map((listItem, i) => (
                            <li key={i} className="ml-4 list-disc text-gray-600">{listItem}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )
              } else if (msg.type === 'action_request') {
                const actionMsg = msg as ActionRequest
                if (answeredActionsRef.current.has(actionMsg.message_id)) {
                  return null
                }
                return (
                  <div className="flex gap-3 animate-in fade-in duration-200">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-500 mb-0.5">Director</p>
                      <p className="text-xs text-gray-700 mb-2">{actionMsg.payload.prompt_text}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {actionMsg.payload.actions.map((action, i) => (
                          <Button
                            key={i}
                            size="sm"
                            variant={action.primary ? "default" : "outline"}
                            onClick={() => onActionClick(action, actionMsg.message_id)}
                            className={action.primary
                              ? "text-xs h-7 bg-gray-900 hover:bg-gray-800"
                              : "text-xs h-7 border-gray-200 hover:bg-gray-50"
                            }
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              } else if (msg.type === 'slide_update') {
                const slideMsg = msg as SlideUpdate
                return (
                  <div className="flex gap-3 animate-in fade-in duration-200">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-500 mb-0.5">Director</p>
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm">📊</span>
                          <p className="text-xs font-medium text-gray-900">
                            {slideMsg.payload.metadata.main_title}
                          </p>
                        </div>
                        <p className="text-[11px] text-gray-500 mb-2">
                          {slideMsg.payload.slides.length} slides · {slideMsg.payload.metadata.presentation_duration} min · {slideMsg.payload.metadata.overall_theme}
                        </p>
                        <div className="space-y-1 max-h-36 overflow-y-auto">
                          {slideMsg.payload.slides.map((slide, i) => {
                            const ctx = slideContextByIndex?.[i]
                            return (
                              <div key={i} className="text-[11px] py-1 px-2 bg-white rounded border border-gray-100">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-gray-400">{slide.slide_number}.</span>
                                  <span className="text-gray-700">{slide.title}</span>
                                  {ctx?.narrative_role && (
                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-normal capitalize">
                                      {ctx.narrative_role.replace(/_/g, ' ')}
                                    </Badge>
                                  )}
                                  <span className="text-gray-400 text-[10px] uppercase ml-auto">{slide.slide_type}</span>
                                </div>
                                {ctx?.key_message && (
                                  <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 pl-3">{ctx.key_message}</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              } else if (msg.type === 'presentation_url') {
                const presMsg = msg as PresentationURL
                return (
                  <div className="flex gap-3 animate-in fade-in duration-200">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-500 mb-0.5">Director</p>
                      <div className="mt-2 flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="text-sm">✅</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700">{presMsg.payload.message}</p>
                          <p className="text-[10px] text-gray-500">{presMsg.payload.slide_count} slides</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[11px] h-7 px-2 border-gray-200 hover:bg-white"
                          onClick={() => window.open(presMsg.payload.url, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open
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
      })}
      <div ref={messagesEndRef} />
    </>
  )
}
