"use client"

import { createContext, useContext, useId, useLayoutEffect, useEffect, useRef, useState, useCallback, type ReactNode, type RefObject } from 'react'
import { Clapperboard } from 'lucide-react'
import WorkspaceIntro from '@/components/workspace-intro/workspace-intro'
import { studioIntroEligibility, type StudioIntroEligibilityInput } from '@/lib/studio-intro-eligibility'
import './studio-introduction.css'

const MODAL = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
const SURFACE = '[data-studio-intro-surface="builder"]'
interface StudioIntroductionActions {
  id: string
  active: boolean
  enabled: boolean
  availableIgnoringOwnAboutModal: boolean
  persistentTriggerRef: RefObject<HTMLButtonElement | null>
  /** Denied entries are dropped; this never queues a replay or changes working state. */
  requestReplay: () => void
}
const IntroductionContext = createContext<StudioIntroductionActions | null>(null)
export const useStudioIntroduction = () => useContext(IntroductionContext)

/** One cinematic owner beside persistent work. All Studio entry buttons share it. */
export function StudioIntroductionProvider({ enabled, eligibility, getEligibility, children }: {
  enabled: boolean
  eligibility: StudioIntroEligibilityInput
  getEligibility?: () => StudioIntroEligibilityInput
  children: ReactNode
}) {
  const id = useId()
  const persistentTriggerRef = useRef<HTMLButtonElement>(null)
  const current = useRef({ enabled, eligibility, getEligibility }); current.current = { enabled, eligibility, getEligibility }
  const alive = useRef(true)
  const attemptedAutomatic = useRef(false)
  const [automatic, setAutomatic] = useState(false)
  const [modalObserved, setModalObserved] = useState(true)
  const [active, setActive] = useState(false)
  const [replay, setReplay] = useState(0)
  const entry = studioIntroEligibility({ ...eligibility,
    modalOpen: eligibility.modalOpen === false && !modalObserved ? false : true })
  const withoutAbout = studioIntroEligibility(eligibility)

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useLayoutEffect(() => {
    if (!enabled) return
    const observe = () => setModalObserved(Boolean(document.querySelector(MODAL)))
    observe()
    const observer = new MutationObserver(observe)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'role'] })
    return () => observer.disconnect()
  }, [enabled])
  useLayoutEffect(() => {
    if (!enabled || attemptedAutomatic.current || eligibility.workspaceReady !== true || !document.querySelector(SURFACE)) return
    // Consume the ready entry even when blocked. Closing a modal never retries it.
    attemptedAutomatic.current = true
    setAutomatic(studioIntroEligibility({ ...eligibility,
      modalOpen: eligibility.modalOpen === false && !document.querySelector(MODAL) ? false : true }).automatic)
  }, [enabled, eligibility.workspaceReady, eligibility])
  useLayoutEffect(() => {
    if (automatic && !entry.automatic) setAutomatic(false)
  }, [automatic, entry.automatic])

  const requestReplay = useCallback(() => {
    const latest = current.current
    if (!alive.current || !latest.enabled || !document.querySelector(SURFACE)) return
    const risks = latest.getEligibility?.() ?? latest.eligibility
    const permitted = studioIntroEligibility({ ...risks,
      modalOpen: risks.modalOpen === false && !document.querySelector(MODAL) ? false : true })
    if (permitted.manual) setReplay(value => value + 1)
  }, [])
  return <IntroductionContext.Provider value={enabled ? {
    id, active, enabled: entry.manual, availableIgnoringOwnAboutModal: withoutAbout.manual,
    persistentTriggerRef, requestReplay,
  } : null}>
    {children}
    {enabled && <WorkspaceIntro id={id} screen="builder" enabled={entry.manual} autoStart={automatic && entry.automatic}
      replay={replay} targetSelector={SURFACE} returnFocusRef={persistentTriggerRef} onActiveChange={setActive} />}
  </IntroductionContext.Provider>
}

export function StudioIntroductionButton({ className = '', persistent = false }: { className?: string; persistent?: boolean }) {
  const intro = useStudioIntroduction()
  if (!intro) return null
  return <button ref={persistent ? intro.persistentTriggerRef : undefined} type="button" className={className}
    data-studio-v4-shell="true" data-studio-intro-replay="true" aria-label="Replay introduction"
    aria-controls={intro.id} aria-expanded={intro.active} disabled={!intro.enabled}
    title="Replay Studio introduction" onClick={intro.requestReplay}>
    <Clapperboard size={13} aria-hidden="true" /><span>Replay intro</span>
  </button>
}

/** About restores its original focus first; only a subsequent frame requests entry. */
export function useStudioAboutReplay({ onOpenChange, restoreFocus }: {
  onOpenChange: (open: boolean) => void
  restoreFocus: () => void
}) {
  const intro = useStudioIntroduction()
  const current = useRef(intro); current.current = intro
  const pending = useRef(false)
  const frame = useRef<number | null>(null)
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); pending.current = false }, [])
  return {
    intro,
    requestFromAbout: () => {
      if (!current.current?.availableIgnoringOwnAboutModal) return
      pending.current = true
      onOpenChange(false)
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault()
      restoreFocus()
      if (!pending.current) return
      pending.current = false
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => { frame.current = null; current.current?.requestReplay() })
    },
  }
}
