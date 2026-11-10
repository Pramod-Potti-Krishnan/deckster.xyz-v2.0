"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { getLayoutServiceUrl } from '@/lib/layout-service-client'
import { fetchSlideInventory } from '@/lib/slide-rail-identity'
import {
  STUDIO_RECONNECT_RESYNC_ENABLED,
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
import { DIRECTOR_CHANGE_WINDOW_MS, NOTICE_CONFIRM_DELAY_MS, STUDIO_DECK_SYNC_TRUTH_ENABLED } from '@/lib/studio-deck-sync-truth' // DECK-SYNC-TRUTH
import { onDeckSaveRefused } from '@/lib/studio-deck-save-refused' // DECK-SAVE-REFUSED-NOTICE

const INVENTORY_TIMEOUT_MS = 8_000

/**
 * MULTITAB J2 P1 (flag NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE): the builder page's side of the "this deck changed in another tab"
 * notice. All the rules live in lib/studio-deck-changed-notice.ts; this only wires them to the browser: a BroadcastChannel (when
 * the browser has one), visibilitychange / focus, and ONE slide-inventory read through the existing fetchSlideInventory.
 *
 * `enabled` false (the flag is off, or there is no session / deck yet) creates nothing: no channel, no listener, no request.
 * `onReload` is the page's existing deck reload; it runs only from the user's click on "Reload deck".
 * P3-4 (NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC): `connectionGeneration` is Director's socket counter (+1 per successful open). A rise
 * for the same session and deck is a reconnect: one inventory read, then a reload when the deck changed and nothing is unsaved.
 */
export function useDeckChangedNotice({
  enabled,
  sessionId,
  presentationId,
  onReload,
  connectionGeneration,
}: {
  enabled: boolean
  sessionId: string | null | undefined
  presentationId: string | null | undefined
  onReload: () => void
  connectionGeneration?: number
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
      ...(STUDIO_RECONNECT_RESYNC_ENABLED && { onResync: () => onReloadRef.current() }),
      ...(STUDIO_DECK_SYNC_TRUTH_ENABLED && { directorWindowMs: DIRECTOR_CHANGE_WINDOW_MS, quietRefresh: () => onReloadRef.current(), confirmDelayMs: NOTICE_CONFIRM_DELAY_MS }), // DECK-SYNC-TRUTH: a difference an announced change explains refreshes quietly; any other must outlast the delay
      doc: typeof document !== 'undefined' ? document : null,
      win: typeof window !== 'undefined' ? window : null,
    })
    controllerRef.current = controller
    const offChange = onDeckChange(change => controller.announce(change))
    const offEdit = onOwnDeckEdit(() => controller.noteOwnEdit())
    const offRefused = onDeckSaveRefused(() => controller.noteSaveRefused()) // DECK-SAVE-REFUSED-NOTICE: Layout refused a stale whole-deck save: this tab shows the notice (flag off: nothing is added)
    const syncUnsaved = () => setUnsaved(getViewerDeckState().unsaved)
    const offViewer = onViewerDeckState(syncUnsaved)
    syncUnsaved()
    return () => {
      offChange()
      offEdit()
      offRefused() // DECK-SAVE-REFUSED-NOTICE
      offViewer()
      controller.dispose()
      if (controllerRef.current === controller) controllerRef.current = null
      setNotice(null)
    }
  }, [active, sessionId, presentationId])

  // P3-4: the first generation seen for a session + deck is its page-load connection, not a reconnect.
  const generationSeenRef = useRef<{ key: string; generation: number } | null>(null)
  useEffect(() => {
    if (!STUDIO_RECONNECT_RESYNC_ENABLED || !active || typeof connectionGeneration !== 'number') return
    const key = `${sessionId}|${presentationId}`
    const seen = generationSeenRef.current
    generationSeenRef.current = { key, generation: connectionGeneration }
    if (!seen || seen.key !== key || connectionGeneration <= seen.generation) return
    void controllerRef.current?.resyncAfterReconnect()
  }, [active, sessionId, presentationId, connectionGeneration])

  const reload = useCallback(() => {
    controllerRef.current?.markReloaded()
    onReloadRef.current()
  }, [])
  const dismiss = useCallback(() => { controllerRef.current?.dismiss() }, [])

  return { notice: active ? notice : null, unsaved, reload, dismiss }
}
