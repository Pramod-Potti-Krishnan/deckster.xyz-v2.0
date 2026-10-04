"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createStageFThumbnailCache,
  mergeRestoredStageFThumbnailUrls,
  restoreStageFThumbnailCache,
  stageFThumbnailCacheKey,
  type SlideThumbnailUrlsByPresentation,
} from '@/lib/stage-f-thumbnails'

type ThumbnailUpdate = SlideThumbnailUrlsByPresentation |
  ((previous: SlideThumbnailUrlsByPresentation) => SlideThumbnailUrlsByPresentation)

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
  const [record, setRecord] = useState<{
    scope: string | null
    hydrated: boolean
    urls: SlideThumbnailUrlsByPresentation
    invalidated: string[]
  }>({ scope, hydrated: false, urls: {}, invalidated: [] })

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
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

  const setThumbnailUrls = useCallback((update: ThumbnailUpdate) => {
    if (!aliveRef.current || scopeRef.current !== renderScope) return
    setRecord(previous => {
      if (!aliveRef.current || scopeRef.current !== renderScope) return previous
      const current = previous.scope === scope ? previous.urls : {}
      const urls = typeof update === 'function' ? update(current) : update
      if (previous.scope === scope && urls === previous.urls) return previous
      return {
        scope, hydrated: previous.scope === scope && previous.hydrated, urls,
        invalidated: previous.scope === scope ? previous.invalidated : [],
      }
    })
  }, [scope, renderScope])

  const invalidateThumbnailUrls = useCallback((presentationId: string) => {
    if (!aliveRef.current || scopeRef.current !== renderScope) return
    setRecord(previous => {
      if (!aliveRef.current || scopeRef.current !== renderScope) return previous
      const current = previous.scope === scope ? previous.urls : {}
      const { [presentationId]: _removed, ...urls } = current
      const invalidated = previous.scope === scope ? previous.invalidated : []
      return {
        scope, urls, hydrated: previous.scope === scope && previous.hydrated,
        invalidated: invalidated.includes(presentationId) ? invalidated : [...invalidated, presentationId],
      }
    })
  }, [scope, renderScope])

  return {
    thumbnailUrls: record.scope === scope ? record.urls : {},
    setThumbnailUrls,
    invalidateThumbnailUrls,
  }
}
