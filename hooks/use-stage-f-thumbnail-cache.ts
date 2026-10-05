"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createStageFThumbnailCache,
  mergeRestoredStageFThumbnailUrls,
  restoreStageFThumbnailCache,
  stageFThumbnailCacheKey,
  type SlideThumbnailUrlsByIndex,
  type SlideThumbnailUrlsByPresentation,
} from '@/lib/stage-f-thumbnails'
import type { StudioSlideThumbnailMutationPlan } from '@/lib/studio-slide-thumbnail-mutations'

type ThumbnailUpdate = SlideThumbnailUrlsByPresentation |
  ((previous: SlideThumbnailUrlsByPresentation) => SlideThumbnailUrlsByPresentation)

export interface StudioThumbnailMutationOwner {
  readonly presentationId: string | null
}

/** An unchanged value copied from a restored v1 map is not native order proof.
 * Existing live values and changed entries admitted by the live setter survive. */
function admittedLiveUrls(
  previous: SlideThumbnailUrlsByPresentation,
  live: SlideThumbnailUrlsByPresentation,
  next: SlideThumbnailUrlsByPresentation,
): SlideThumbnailUrlsByPresentation {
  return Object.fromEntries(Object.entries(next).map(([id, values]) => [id,
    Object.fromEntries(Object.entries(values).filter(([index, value]) => (
      typeof value === 'string' && value.trim()
      && (/^(0|[1-9]\d*)$/.test(index) && Number.isSafeInteger(Number(index)))
      && (live[id]?.[Number(index)] === value || previous[id]?.[Number(index)] !== value)
    ))),
  ]))
}

function exactMappedPlan(plan: StudioSlideThumbnailMutationPlan): boolean {
  if (!plan || plan.mode !== 'mapped' || !Number.isSafeInteger(plan.beforeCount) || plan.beforeCount < 1
    || !Number.isSafeInteger(plan.nativeCount) || plan.nativeCount < 1
    || !Array.isArray(plan.oldIndexByNewIndex) || plan.oldIndexByNewIndex.length !== plan.nativeCount) return false
  const mapping = Array.from(plan.oldIndexByNewIndex)
  const indices = mapping.filter(index => index !== null)
  return indices.every(index => Number.isSafeInteger(index) && index >= 0 && index < plan.beforeCount)
    && new Set(indices).size === indices.length
}

/** Optional local recovery of actual received previews. No renderer/service fetch. */
export function useStageFThumbnailCache({
  enabled,
  ownerUserId,
  sessionId,
}: {
  enabled: boolean
  ownerUserId: string
  sessionId: string | null
}) {
  const scope = stageFThumbnailCacheKey(ownerUserId, sessionId ?? '')
  const scopeRef = useRef({ key: scope })
  if (scopeRef.current.key !== scope) scopeRef.current = { key: scope }
  const renderScope = scopeRef.current
  const aliveRef = useRef(true)
  const mutationMountRef = useRef(0)
  const mutationScopeRef = useRef({ scope: renderScope, enabled, revisions: new Map<string, number>() })
  if (mutationScopeRef.current.scope !== renderScope || mutationScopeRef.current.enabled !== enabled) {
    mutationScopeRef.current = { scope: renderScope, enabled, revisions: new Map<string, number>() }
  }
  const renderMutationScope = mutationScopeRef.current
  const [record, setRecord] = useState<{
    scope: string | null
    hydrated: boolean
    urls: SlideThumbnailUrlsByPresentation
    liveUrls: SlideThumbnailUrlsByPresentation
    liveScope: typeof renderScope
    invalidated: string[]
  }>({ scope, hydrated: false, urls: {}, liveUrls: {}, liveScope: renderScope, invalidated: [] })

  const currentRecordRef = useRef(record)
  currentRecordRef.current = record

  useEffect(() => {
    aliveRef.current = true
    mutationMountRef.current += 1
    return () => { aliveRef.current = false; mutationMountRef.current += 1 }
  }, [])

  useEffect(() => {
    let restored: SlideThumbnailUrlsByPresentation = {}
    if (enabled && scope && ownerUserId && sessionId && sessionId !== 'new') {
      try {
        restored = restoreStageFThumbnailCache(
          JSON.parse(window.sessionStorage.getItem(scope) ?? 'null'),
          ownerUserId, sessionId, Date.now(),
        )
      } catch { /* Storage is optional. */ }
    }
    setRecord(previous => {
      if (!aliveRef.current || scopeRef.current !== renderScope) return previous
      const invalidated = previous.scope === scope ? previous.invalidated : []
      return {
        scope,
        hydrated: true,
        urls: mergeRestoredStageFThumbnailUrls(
          Object.fromEntries(Object.entries(restored).filter(([id]) => !invalidated.includes(id))),
          previous.scope === scope ? previous.urls : {},
        ),
        liveUrls: previous.scope === scope && previous.liveScope === renderScope ? previous.liveUrls : {},
        liveScope: renderScope,
        invalidated,
      }
    })
  }, [scope, renderScope, enabled, ownerUserId, sessionId])

  useEffect(() => {
    if (!enabled || !scope || !ownerUserId || !sessionId || sessionId === 'new' ||
      record.scope !== scope || !record.hydrated || scopeRef.current !== renderScope) return
    try {
      const cached = createStageFThumbnailCache(record.urls, ownerUserId, sessionId, Date.now())
      if (cached) window.sessionStorage.setItem(scope, JSON.stringify(cached))
      else window.sessionStorage.removeItem(scope)
    } catch { /* Quota/private mode must not block live previews. */ }
  }, [enabled, ownerUserId, sessionId, scope, renderScope, record])

  const setThumbnailUrls = useCallback((update: ThumbnailUpdate, receivedPresentationId?: string) => {
    if (!aliveRef.current || scopeRef.current !== renderScope) return
    setRecord(previous => {
      if (!aliveRef.current || scopeRef.current !== renderScope) return previous
      // Index-only service receipts cannot establish their position in an order
      // changed by native CRUD. Keep proved survivors, and refuse these late
      // receipts until a separate identity-bearing admission is available.
      if (receivedPresentationId !== undefined && previous.scope === scope
        && previous.invalidated.includes(receivedPresentationId)) return previous
      const current = previous.scope === scope ? previous.urls : {}
      const urls = typeof update === 'function' ? update(current) : update
      if (previous.scope === scope && urls === previous.urls) return previous
      return {
        scope, hydrated: previous.scope === scope && previous.hydrated, urls,
        liveUrls: admittedLiveUrls(current, previous.scope === scope && previous.liveScope === renderScope ? previous.liveUrls : {}, urls),
        liveScope: renderScope,
        invalidated: previous.scope === scope ? previous.invalidated : [],
      }
    })
  }, [scope, renderScope])

  const setReceivedThumbnailUrls = useCallback((presentationId: string, update: ThumbnailUpdate) => {
    if (typeof presentationId !== 'string' || !presentationId || presentationId !== presentationId.trim()) return
    setThumbnailUrls(update, presentationId)
  }, [setThumbnailUrls])

  const invalidateThumbnailUrls = useCallback((presentationId: string) => {
    if (!aliveRef.current || scopeRef.current !== renderScope) return
    const revisions = mutationScopeRef.current.revisions
    revisions.set(presentationId, (revisions.get(presentationId) ?? 0) + 1)
    setRecord(previous => {
      if (!aliveRef.current || scopeRef.current !== renderScope) return previous
      const current = previous.scope === scope ? previous.urls : {}
      const { [presentationId]: _removed, ...urls } = current
      const { [presentationId]: _removedLive, ...liveUrls } = previous.scope === scope && previous.liveScope === renderScope ? previous.liveUrls : {}
      const invalidated = previous.scope === scope ? previous.invalidated : []
      return {
        scope, urls, liveUrls, liveScope: renderScope, hydrated: previous.scope === scope && previous.hydrated,
        invalidated: invalidated.includes(presentationId) ? invalidated : [...invalidated, presentationId],
      }
    })
  }, [scope, renderScope])

  /** Capture at the owned native command boundary. Caller must supply its exact
   * current Viewer owner object again after ACK (including deck/frame ABA).
   * V1 restored index maps are deliberately excluded from remapping input. */
  const captureThumbnailMutation = useCallback((presentationId: string, owner: StudioThumbnailMutationOwner) => {
    const captureRecord = currentRecordRef.current
    const capturedLive = captureRecord.scope === scope && captureRecord.liveScope === renderScope
      ? { ...captureRecord.liveUrls[presentationId] } : {}
    const mutationScope = renderMutationScope
    let revision = mutationScope.revisions.get(presentationId) ?? 0
    const mount = mutationMountRef.current
    // A newer admitted structural intent owns the next proof, even before ACK.
    if (enabled && scope && owner && typeof owner === 'object' && !Array.isArray(owner)
      && owner.presentationId === presentationId && typeof presentationId === 'string'
      && presentationId && presentationId === presentationId.trim() && aliveRef.current
      && mount !== 0 && scopeRef.current === renderScope && mutationScopeRef.current === mutationScope) {
      revision += 1
      mutationScope.revisions.set(presentationId, revision)
    }
    let consumed = false
    let fenced = false
    const isCurrent = (currentOwner: StudioThumbnailMutationOwner) => !consumed && enabled
      && Boolean(scope) && Boolean(owner) && typeof owner === 'object' && !Array.isArray(owner)
      && owner === currentOwner && owner.presentationId === presentationId
      && typeof presentationId === 'string' && Boolean(presentationId) && presentationId === presentationId.trim()
      && aliveRef.current && mount !== 0 && mutationMountRef.current === mount && scopeRef.current === renderScope
      && mutationScopeRef.current === mutationScope
      && (mutationScope.revisions.get(presentationId) ?? 0) === revision
    // Successful structural ACK invalidates the displayed old order immediately.
    // This capture alone retains its dispatch-proven survivors for later remap.
    const fence = (currentOwner: StudioThumbnailMutationOwner): boolean => {
      if (fenced || !isCurrent(currentOwner)) return false
      fenced = true
      revision += 1
      mutationScope.revisions.set(presentationId, revision)
      const fenceRevision = revision
      setRecord(previous => {
        if (!aliveRef.current || mutationMountRef.current !== mount || scopeRef.current !== renderScope
          || mutationScopeRef.current !== mutationScope
          || (mutationScope.revisions.get(presentationId) ?? 0) !== fenceRevision) return previous
        const current = previous.scope === scope ? previous.urls : {}
        const { [presentationId]: _removed, ...urls } = current
        const { [presentationId]: _removedLive, ...liveUrls } = previous.scope === scope && previous.liveScope === renderScope ? previous.liveUrls : {}
        const invalidated = previous.scope === scope ? previous.invalidated : []
        return { scope, hydrated: previous.scope === scope && previous.hydrated,
          urls, liveUrls, liveScope: renderScope,
          invalidated: invalidated.includes(presentationId) ? invalidated : [...invalidated, presentationId] }
      })
      return true
    }
    const commit = (currentOwner: StudioThumbnailMutationOwner, plan: StudioSlideThumbnailMutationPlan) => {
      if (consumed || !enabled || !scope || !owner || typeof owner !== 'object' || Array.isArray(owner)
        || owner !== currentOwner || owner.presentationId !== presentationId
        || typeof presentationId !== 'string' || !presentationId || presentationId !== presentationId.trim()
        || !aliveRef.current || mount === 0 || mutationMountRef.current !== mount || scopeRef.current !== renderScope
        || mutationScopeRef.current !== mutationScope
        || (mutationScope.revisions.get(presentationId) ?? 0) !== revision || !exactMappedPlan(plan)) return
      consumed = true
      const commitRevision = revision + 1
      mutationScope.revisions.set(presentationId, commitRevision)
      const mapping = [...plan.oldIndexByNewIndex]
      setRecord(previous => {
        if (!aliveRef.current || mutationMountRef.current !== mount || scopeRef.current !== renderScope
          || mutationScopeRef.current !== mutationScope
          || (mutationScope.revisions.get(presentationId) ?? 0) !== commitRevision) return previous
        const current = previous.scope === scope ? previous.urls : {}
        const live = previous.scope === scope && previous.liveScope === renderScope ? previous.liveUrls : {}
        const mapped: SlideThumbnailUrlsByIndex = {}
        mapping.forEach((oldIndex, newIndex) => {
          if (oldIndex !== null && Object.prototype.hasOwnProperty.call(capturedLive, oldIndex)) {
            mapped[newIndex] = capturedLive[oldIndex]
          }
        })
        const invalidated = previous.scope === scope ? previous.invalidated : []
        return {
          scope, hydrated: previous.scope === scope && previous.hydrated,
          urls: { ...current, [presentationId]: mapped },
          liveUrls: { ...live, [presentationId]: mapped },
          liveScope: renderScope,
          invalidated: invalidated.includes(presentationId) ? invalidated : [...invalidated, presentationId],
        }
      })
    }
    return Object.assign(commit, { fence })
  }, [enabled, scope, renderScope, renderMutationScope])

  return {
    thumbnailUrls: record.scope === scope ? record.urls : {},
    setThumbnailUrls,
    setReceivedThumbnailUrls,
    invalidateThumbnailUrls,
    captureThumbnailMutation,
  }
}
