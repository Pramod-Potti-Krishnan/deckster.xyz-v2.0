"use client"

import { useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { OnboardingModal } from '@/components/onboarding-modal'
import './studio-onboarding.css'

const STUDIO_INTRO = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

/** Browser-local introduction only; reopening it leaves the current work intact. */
export function StudioIntroReplay({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  if (!STUDIO_INTRO) return null
  return <>
    <button ref={triggerRef} type="button" className={className} data-studio-v4-shell="true" data-studio-intro-replay="true"
      aria-label="Replay introduction" aria-haspopup="dialog" aria-expanded={open} title="Replay Studio introduction · manual guide" onClick={() => setOpen(true)}>
      <RotateCcw size={13} aria-hidden="true" /><span>Replay intro</span>
    </button>
    <OnboardingModal replay open={open} onClose={() => setOpen(false)} onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus() }} />
  </>
}
