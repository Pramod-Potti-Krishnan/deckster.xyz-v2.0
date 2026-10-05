"use client"

import { useId, useRef, useState } from 'react'
import { Clapperboard, RotateCcw } from 'lucide-react'
import { OnboardingModal } from '@/components/onboarding-modal'
import WorkspaceIntro from '@/components/workspace-intro/workspace-intro'
import type { WorkspaceIntroScreen } from '@/components/workspace-intro/types'
import './studio-onboarding.css'

const STUDIO_INTRO = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

/** Browser-local introduction only; reopening it leaves the current work intact. */
export type StudioIntroReplayProps = {
  className?: string
  /** Omitted keeps the existing manual onboarding guide for unchanged callers. */
  screen?: WorkspaceIntroScreen
  autoStart?: boolean
  enabled?: boolean
  targetSelector?: string
  onActiveChange?: (active: boolean) => void
}

export function StudioIntroReplay({ className = '', screen, autoStart = false, enabled = true, targetSelector, onActiveChange }: StudioIntroReplayProps) {
  if (!STUDIO_INTRO) return null
  if (screen) return <CinematicReplay className={className} screen={screen} autoStart={autoStart} enabled={enabled} targetSelector={targetSelector} onActiveChange={onActiveChange} />
  return <ManualGuideReplay className={className} />
}

function CinematicReplay({ className = '', screen, autoStart, enabled, targetSelector, onActiveChange }: StudioIntroReplayProps & { screen: WorkspaceIntroScreen }) {
  const [replay, setReplay] = useState(0)
  const [active, setActive] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  return <>
    <button ref={triggerRef} type="button" className={className} data-studio-v4-shell="true" data-studio-intro-replay="true"
      aria-label="Replay introduction" aria-controls={id} aria-expanded={active} disabled={!enabled}
      title="Replay workspace introduction" onClick={() => setReplay(value => value + 1)}>
      <Clapperboard size={13} aria-hidden="true" /><span>Replay intro</span>
    </button>
    <WorkspaceIntro id={id} screen={screen} replay={replay} enabled={enabled} autoStart={autoStart} targetSelector={targetSelector} returnFocusRef={triggerRef}
      onActiveChange={next => { setActive(next); onActiveChange?.(next) }} />
  </>
}

function ManualGuideReplay({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return <>
    <button ref={triggerRef} type="button" className={className} data-studio-v4-shell="true" data-studio-intro-replay="true"
      aria-label="Replay introduction" aria-haspopup="dialog" aria-expanded={open} title="Replay Studio introduction · manual guide" onClick={() => setOpen(true)}>
      <RotateCcw size={13} aria-hidden="true" /><span>Replay intro</span>
    </button>
    <OnboardingModal replay open={open} onClose={() => setOpen(false)} onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus() }} />
  </>
}
