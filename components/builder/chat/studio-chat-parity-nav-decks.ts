"use client"

// CHAT PARITY, NAVIGATION (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS, default off): the deck list behind /open and /decks <words>. The composer hook calls this on every render with `want` true only while the text is "/open ..." or
// "/decks ..." (lib/studio-chat-parity-nav.ts navWantsDecks). The list is read once when that starts (what the Sessions panel lists: loadSessions({ limit: 50, status: 'active' })) and again when it has gone stale or a copy
// was made; until it arrives the rows say so. A failed read says so and is tried again the next time. Nothing is read with the flag off (the hook is not called then) and nothing else here has an effect.
import { useEffect, useRef, useState } from 'react'
import { NO_DECKS, decksEpoch, decksFromSessions, type ChatParityNavPage, type NavDecks } from '@/lib/studio-chat-parity-nav'

/** How long a read of the deck list stays fresh (ms). */
export const NAV_DECKS_FRESH_MS = 45000

export function useChatNavDecks(want: boolean, load: ChatParityNavPage['loadSessions'] | undefined): NavDecks {
  const [decks, setDecks] = useState<NavDecks>(NO_DECKS)
  const latest = useRef(decks)
  latest.current = decks
  const began = useRef({ at: 0, epoch: -1 })
  const reading = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!want || !load || reading.current) return
    const epoch = decksEpoch()
    if (latest.current.status === 'ready' && began.current.epoch === epoch && Date.now() - began.current.at < NAV_DECKS_FRESH_MS) return
    reading.current = true
    began.current = { at: Date.now(), epoch }
    setDecks(current => (current.items.length ? current : { status: 'loading', items: [] }))
    const lost = () => { if (mounted.current) setDecks(current => (current.items.length ? current : { status: 'failed', items: [] })) }
    void load().then(result => {
      if (!mounted.current) return
      if (result) setDecks({ status: 'ready', items: decksFromSessions(result.sessions) })
      else lost()
    }, lost).finally(() => { reading.current = false })
  }, [want]) // eslint-disable-line react-hooks/exhaustive-deps -- one read per opening of /open or /decks
  return decks
}
