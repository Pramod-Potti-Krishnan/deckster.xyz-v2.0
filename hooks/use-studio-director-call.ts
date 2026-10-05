"use client"

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { DirectorMessage } from './use-deckster-websocket-v2'
import { useDirectorCall } from '@/components/builder/voice-interactive/use-director-call'
import { latestDirectorReply, latestPendingAsk, type DirectorReplyPolicy } from '@/lib/studio-voice-interactive'
import { classifyDirectorMessage, getDirectorActionPolicy } from '@/lib/studio-director-message-policy'
import { studioVoiceElementVisible, type createStudioVoiceOwner, type StudioVoiceOwnerObservation } from '@/lib/studio-voice-owner'
import type { StudioVoiceTranscriptProvenance } from '@/lib/studio-voice-transcript-provenance'

export interface StudioDirectorCallOptions {
  enabled: boolean
  authority: ReturnType<typeof createStudioVoiceOwner>
  observation: StudioVoiceOwnerObservation
  messages: readonly DirectorMessage[]
  userMessages: readonly { text: string }[]
  userMessageIdsRef: RefObject<Set<string>>
  userMessageContentMapRef: RefObject<Map<string, string>>
  answeredActionsRef: RefObject<Set<string>>
  /** Same value supplied to the actual MessageList, including null legacy policy. */
  messageListSessionId: string | null
  transcript: StudioVoiceTranscriptProvenance | null
  chatRootRef: RefObject<HTMLDivElement | null>
  transcriptRootRef: RefObject<HTMLDivElement | null>
  textareaRef: RefObject<HTMLTextAreaElement | null>
}

/** Shared projection only: no send, transport, build, draft or answer ownership. */
export function useStudioDirectorCall(options: StudioDirectorCallOptions) {
  const { enabled, authority, observation, messages, transcript } = options
  const [surfaceAvailable, setSurfaceAvailable] = useState(false)
  const effectiveObservation = { ...observation, eligible: observation.eligible && surfaceAvailable }
  const owner = authority.observe(effectiveObservation)
  const assistantIds = new Set<string>()
  const userIds = new Set(options.userMessageIdsRef.current)
  for (const message of messages) {
    const decision = classifyDirectorMessage(message, {
      userMessageIds: userIds, userMessageContentMap: options.userMessageContentMapRef.current,
    })
    if (decision.trackUserId) userIds.add(message.message_id)
    if (!decision.isUserMessage) assistantIds.add(message.message_id)
  }
  const replyPolicy: DirectorReplyPolicy | null = owner && transcript?.isCurrent()
    && transcript.userId === observation.authUserId && transcript.sessionId === observation.sessionId
    ? { owner, displayedSessionId: observation.sessionId, assistantMessageIds: assistantIds,
        liveMessageIds: transcript.live, restoredMessageIds: transcript.restored,
        ephemeralMessageIds: transcript.ephemeral } : null
  const currentRef = useRef({ options, owner })
  currentRef.current = { options, owner }
  const currentSurfaceAvailable = useCallback(() => {
    const current = currentRef.current
    const chat = current.options.chatRootRef.current
    const root = current.options.transcriptRootRef.current
    const doc = chat?.ownerDocument
    return Boolean(current.options.observation.eligible && studioVoiceElementVisible(chat)
      && studioVoiceElementVisible(root) && chat.contains(root) && doc && !doc.fullscreenElement
      && !doc.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'))
  }, [])
  useLayoutEffect(() => {
    if (!enabled) return
    let lastAvailable: boolean | null = null
    const observe = () => {
      const available = currentSurfaceAvailable()
      if (available === lastAvailable) return
      lastAvailable = available
      if (!available) authority.retire()
      setSurfaceAvailable(available)
    }
    observe()
    const doc = options.chatRootRef.current?.ownerDocument
    if (!doc) return
    const observer = new MutationObserver(observe)
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['inert', 'aria-hidden', 'hidden', 'class', 'style', 'data-state', 'role'] })
    doc.addEventListener('fullscreenchange', observe)
    doc.defaultView?.addEventListener('resize', observe)
    return () => {
      observer.disconnect()
      doc.removeEventListener('fullscreenchange', observe)
      doc.defaultView?.removeEventListener('resize', observe)
    }
  }, [enabled, authority, currentSurfaceAvailable, observation.eligible, options.chatRootRef])
  const isCurrentCallOwner = useCallback((candidate: object) => {
    const current = currentRef.current
    const receipt = current.options.transcript
    return current.owner === candidate && authority.isCurrent(candidate) && currentSurfaceAvailable()
      && !!receipt?.isCurrent() && receipt.userId === current.options.observation.authUserId
      && receipt.sessionId === current.options.observation.sessionId
  }, [authority, currentSurfaceAvailable])
  const getQuestionRoot = useCallback(() => {
    const current = currentRef.current
    if (!owner || current.owner !== owner || !isCurrentCallOwner(owner)
      || !current.options.observation.eligible) return null
    const chat = current.options.chatRootRef.current
    const root = current.options.transcriptRootRef.current
    return studioVoiceElementVisible(chat) && studioVoiceElementVisible(root) && chat.contains(root) ? root : null
  }, [owner, isCurrentCallOwner])
  const focusComposer = useCallback(() => {
    const focus = () => {
      const current = currentRef.current
      if (!owner || current.owner !== owner || !authority.isCurrent(owner) || !getQuestionRoot()) return
      const textarea = current.options.textareaRef.current
      const chat = current.options.chatRootRef.current
      if (textarea && !textarea.disabled && textarea.getAttribute('aria-disabled') !== 'true'
        && chat?.contains(textarea) && studioVoiceElementVisible(textarea)) textarea.focus()
    }
    // Retained and queued focus each recheck the same original owner.
    if (owner && authority.isCurrent(owner) && getQuestionRoot()) requestAnimationFrame(focus)
  }, [authority, owner, getQuestionRoot])
  const isCurrentAsk = useCallback((id: string) => {
    const current = currentRef.current
    const root = getQuestionRoot()
    if (!root || current.owner !== owner || !owner || !authority.isCurrent(owner)) return false
    const policy = getDirectorActionPolicy(current.options.messages,
      current.options.answeredActionsRef.current, current.options.messageListSessionId)
    const ask = latestPendingAsk(current.options.messages, {
      displayedSessionId: current.options.observation.sessionId,
      historicalStatuses: policy.historicalActions, activeActionIds: policy.activeActionIds,
    })
    if (ask?.id !== id) return false
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-studio-director-ask][data-director-action-id]'))
      .filter(card => card.getAttribute('data-director-action-id') === id
        && card.getAttribute('data-studio-director-ask') !== 'history'
        && !card.hasAttribute('data-studio-director-history-action'))
    if (cards.length !== 1 || !studioVoiceElementVisible(cards[0])) return false
    const control = cards[0].querySelector<HTMLElement>('button:not([disabled]):not([aria-disabled="true"]), textarea:not([disabled]):not([aria-disabled="true"]), input:not([disabled]):not([aria-disabled="true"])')
    return studioVoiceElementVisible(control)
  }, [authority, owner, getQuestionRoot])
  const policy = getDirectorActionPolicy(messages, options.answeredActionsRef.current, options.messageListSessionId)
  const call = useDirectorCall({
    enabled, owner, eligible: effectiveObservation.eligible, isCurrentOwner: isCurrentCallOwner,
    messages, replyPolicy, focusComposer,
    scope: [observation.authUserId, observation.sessionId, observation.presentationId,
      observation.presentationUrl, observation.presentationId || observation.presentationUrl ? observation.activeVersion : null,
      observation.templateIdentity],
  })
  return {
    call, eligible: effectiveObservation.eligible,
    latestDirectorText: latestDirectorReply(messages, replyPolicy)?.text ?? null,
    latestUserText: owner ? options.userMessages[options.userMessages.length - 1]?.text ?? null : null,
    pendingAsk: owner ? latestPendingAsk(messages, {
      displayedSessionId: observation.sessionId, historicalStatuses: policy.historicalActions,
      activeActionIds: policy.activeActionIds,
    }) : null,
    isCurrentAsk, getQuestionRoot, focusComposer,
  }
}
