"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getLayoutServiceUrl } from '@/lib/layout-service-client'
import {
  buildRailRows,
  createSlideInventoryController,
  learnRailTitles,
  railTitlesStorageKey,
  restoreRailTitles,
  serializeRailTitles,
  type RailTitleMemory,
  type SlideInventoryState,
  type SlideRailRow,
} from '@/lib/slide-rail-identity'

const IDLE: SlideInventoryState = { status: 'idle', inventory: null }

/**
 * Identity-keyed rows for the Studio slide rail, read from Layout's slide inventory
 * (F8 / S-03). Returns `rows: null` whenever the rail must behave as it does today:
 * the flag is off, there is no presentation yet, the endpoint is absent (backend flag
 * off), or the read has not answered. Never throws, never blocks the rail.
 *
 * `refreshSignals` are any values whose change means "the deck may have changed"
 * (slide count, a preview frame). `refresh()` is for structural acks.
 */
export function useSlideRailIdentity({
  enabled,
  presentationId,
  ownerUserId,
  structureSlides,
  refreshSignals,
}: {
  enabled: boolean
  presentationId: string | null | undefined
  ownerUserId: string | null | undefined
  /** Director's slide rows, ONLY when no native CRUD has touched the deck since they
   *  arrived (the trust today's rich path applies). Used to learn titles by position. */
  structureSlides: ReadonlyArray<unknown> | null
  refreshSignals: ReadonlyArray<unknown>
}): { rows: SlideRailRow[] | null; refresh: () => void } {
  const active = enabled && Boolean(presentationId)
  const [snapshot, setSnapshot] = useState<{ presentationId: string | null; state: SlideInventoryState }>(
    { presentationId: null, state: IDLE },
  )
  const controllerRef = useRef<ReturnType<typeof createSlideInventoryController> | null>(null)

  useEffect(() => {
    if (!active || !presentationId) {
      controllerRef.current = null
      return
    }
    const controller = createSlideInventoryController({
      presentationId,
      getBaseUrl: () => getLayoutServiceUrl(),
      fetchImpl: (input, init) => fetch(input, init),
      onChange: state => setSnapshot({ presentationId, state }),
    })
    controllerRef.current = controller
    controller.refresh()
    return () => {
      controller.dispose()
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [active, presentationId])

  const signalsKey = refreshSignals
  useEffect(() => {
    controllerRef.current?.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, signalsKey as unknown[])

  // Explicit calls come from structural acks (insert/delete/duplicate/reorder/layout): read at once.
  const refresh = useCallback(() => { controllerRef.current?.refresh(true) }, [])

  const inventory = active && snapshot.presentationId === presentationId
    && snapshot.state.status === 'ready' ? snapshot.state.inventory : null

  // Remembered titles by slide_id: restored per tab, learned only from an aligned structure.
  const storageKey = active && ownerUserId && presentationId ? railTitlesStorageKey(ownerUserId, presentationId) : null
  const memoryRef = useRef<{ key: string | null; titles: RailTitleMemory }>({ key: null, titles: new Map() })
  const titles = useMemo(() => {
    if (!inventory) return memoryRef.current.titles
    let base = memoryRef.current.key === storageKey ? memoryRef.current.titles : new Map<string, string>()
    if (storageKey && memoryRef.current.key !== storageKey && ownerUserId && presentationId) {
      try {
        base = restoreRailTitles(window.sessionStorage.getItem(storageKey), ownerUserId, presentationId)
      } catch { /* Storage is optional. */ }
    }
    return learnRailTitles(base, inventory, structureSlides)
  }, [inventory, structureSlides, storageKey, ownerUserId, presentationId])

  useEffect(() => {
    if (!inventory) return
    memoryRef.current = { key: storageKey, titles }
    if (!storageKey || !ownerUserId || !presentationId) return
    try {
      const serialized = serializeRailTitles(titles, ownerUserId, presentationId)
      if (serialized) window.sessionStorage.setItem(storageKey, serialized)
      else window.sessionStorage.removeItem(storageKey)
    } catch { /* Quota/private mode must not affect the rail. */ }
  }, [inventory, titles, storageKey, ownerUserId, presentationId])

  const rows = useMemo(() => inventory ? buildRailRows(inventory, titles) : null, [inventory, titles])
  return { rows, refresh }
}
