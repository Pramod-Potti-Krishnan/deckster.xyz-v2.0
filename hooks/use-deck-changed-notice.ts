"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { getLayoutServiceUrl } from '@/lib/layout-service-client'
import { fetchSlideInventory } from '@/lib/slide-rail-identity'
import {
  createDeckChangedController,
  getDeckChangedTabId,
  getViewerDeckState,
  onDeckChange,
  onOwnDeckEdit,
  onViewerDeckState,
  type DeckChangedChannel,
  type DeckChangedController,
  type DeckChangedNotice,
} from '@/lib/studio-deck-changed-notice'

const INVENTORY_TIMEOUT_MS = 8_000

/**
 * MULTITAB J2 P1 (flag NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE): the builder page's side of the "this deck changed in another tab"
 * notice. All the rules live in lib/studio-deck-changed-notice.ts; this only wires them to the browser: a BroadcastChannel (when
 * the browser has one), visibilitychange / focus, and ONE slide-inventory read through the existing fetchSlideInventory.
 *
 * `enabled` false (the flag is off, or there is no session / deck yet) creates nothing: no channel, no listener, no request.
 * `onReload` is the page's existing deck reload; it runs only from the user's click on "Reload deck".
 */
export function useDeckChangedNotice({
  enabled,
  sessionId,
  presentationId,
  onReload,
}: {
  enabled: boolean
  sessionId: string | null | undefined
  presentationId: string | null | undefined
  onReload: () => void
}): { notice: DeckChangedNotice | null; unsaved: boolean; reload: () => void; dismiss: () => void } {
  const [notice, setNotice] = useState<DeckChangedNotice | null>(null)
  const [unsaved, setUnsaved] = useState(false)
  const controllerRef = useRef<DeckChangedController | null>(null)
  const onReloadRef = useRef(onReload)
  onReloadRef.current = onReload

  const active = enabled && Boolean(sessionId) && Boolean(presentationId)

  useEffect(() => {
    if (!active || !sessionId || !presentationId) return
    const controller = createDeckChangedController({
      sessionId,
      presentationId,
      tabId: getDeckChangedTabId(),
      // Feature-detected; a BroadcastChannel is a DeckChangedChannel (the controller only reads `event.data`).
      createChannel: name => (typeof BroadcastChannel === 'function' ? new BroadcastChannel(name) as unknown as DeckChangedChannel : null),
      readInventory: async () => {
        const abort = typeof AbortController === 'function' ? new AbortController() : null
        const timer = abort ? setTimeout(() => abort.abort(), INVENTORY_TIMEOUT_MS) : null
        try {
          const result = await fetchSlideInventory({
            baseUrl: getLayoutServiceUrl(),
            presentationId,
            fetchImpl: (input, init) => fetch(input, init),
            signal: abort?.signal,
          })
          return result.kind === 'ok' ? result.inventory : null
        } catch {
          return null
        } finally {
          if (timer !== null) clearTimeout(timer)
        }
      },
      getViewerState: getViewerDeckState,
      onNotice: setNotice,
      doc: typeof document !== 'undefined' ? document : null,
      win: typeof window !== 'undefined' ? window : null,
    })
    controllerRef.current = controller
    const offChange = onDeckChange(change => controller.announce(change))
    const offEdit = onOwnDeckEdit(() => controller.noteOwnEdit())
    const syncUnsaved = () => setUnsaved(getViewerDeckState().unsaved)
    const offViewer = onViewerDeckState(syncUnsaved)
    syncUnsaved()
    return () => {
      offChange()
      offEdit()
      offViewer()
      controller.dispose()
      if (controllerRef.current === controller) controllerRef.current = null
      setNotice(null)
    }
  }, [active, sessionId, presentationId])

  const reload = useCallback(() => {
    controllerRef.current?.markReloaded()
    onReloadRef.current()
  }, [])
  const dismiss = useCallback(() => { controllerRef.current?.dismiss() }, [])

  return { notice: active ? notice : null, unsaved, reload, dismiss }
}
