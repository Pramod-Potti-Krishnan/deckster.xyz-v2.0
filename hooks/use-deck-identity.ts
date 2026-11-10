'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

import {
  DECK_IDENTITY_FORM_EVENT,
  DECK_IDENTITY_STORAGE_KEY,
  buildDeckIdentity,
  isDeckIdentityEnabled,
  readDeckIdentityForm,
  writeDeckIdentityForm,
  type DeckIdentity,
  type DeckIdentityForm,
} from '@/lib/deck-identity'

/**
 * Reads the two inputs to `deck_identity` — the signed-in profile name and the
 * per-browser "Presenter details" form — and recomputes the wire object when
 * either changes.
 *
 * Returns `null` when the flag is off, so every call site can spread it
 * unconditionally and still emit no `deck_identity` key.
 *
 * The form starts empty on the first render deliberately: reading localStorage
 * during render would mismatch the server-rendered HTML.
 */
export function useDeckIdentity(): DeckIdentity | null {
  const { data: session } = useSession()
  const enabled = isDeckIdentityEnabled()
  const [form, setForm] = useState<DeckIdentityForm>({})

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const sync = () => setForm(readDeckIdentityForm())
    sync()

    // Same tab (our own writes) + other tabs (the native storage event).
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== DECK_IDENTITY_STORAGE_KEY) return
      sync()
    }
    window.addEventListener(DECK_IDENTITY_FORM_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(DECK_IDENTITY_FORM_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [enabled])

  const sessionName = session?.user?.name ?? null

  return useMemo(() => {
    if (!enabled) return null
    return buildDeckIdentity({ sessionName, form, now: new Date() })
  }, [enabled, sessionName, form])
}

/**
 * The editing half: the current stored form plus a setter that persists and
 * notifies. Used by the Builder's "Presenter details" dialog.
 */
export function useDeckIdentityForm(): {
  form: DeckIdentityForm
  presenter: string | null
  save: (next: DeckIdentityForm) => void
} {
  const { data: session } = useSession()
  const [form, setForm] = useState<DeckIdentityForm>({})

  useEffect(() => {
    if (typeof window === 'undefined') return
    const sync = () => setForm(readDeckIdentityForm())
    sync()
    window.addEventListener(DECK_IDENTITY_FORM_EVENT, sync)
    return () => window.removeEventListener(DECK_IDENTITY_FORM_EVENT, sync)
  }, [])

  const save = useCallback((next: DeckIdentityForm) => {
    setForm(writeDeckIdentityForm(next))
  }, [])

  return { form, presenter: session?.user?.name ?? null, save }
}
