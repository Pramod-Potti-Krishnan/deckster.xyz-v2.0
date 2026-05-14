"use client"

import { useRef } from "react"
import { useReducedMotionSafe } from "../shared/useReducedMotionSafe"
import { ChatPanel } from "./ChatPanel"
import { SlideCanvas } from "./SlideCanvas"
import { useChoreography } from "./useChoreography"

export function BuilderDemo() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const reducedMotion = useReducedMotionSafe()
  const state = useChoreography({ containerRef, reducedMotion })

  return (
    <div
      ref={containerRef}
      className="relative grid w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-5"
      style={{ minHeight: BUILDER_DEMO_MIN_HEIGHT }}
    >
      <div className="min-h-[320px] lg:min-h-0">
        <ChatPanel state={state} reducedMotion={reducedMotion} />
      </div>
      <div className="min-h-0">
        <SlideCanvas state={state} reducedMotion={reducedMotion} />
      </div>
    </div>
  )
}

/** Shared with the skeleton so the bounding box matches and CLS stays at 0. */
export const BUILDER_DEMO_MIN_HEIGHT = 480
