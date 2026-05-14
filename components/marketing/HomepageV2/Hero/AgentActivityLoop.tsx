"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AGENT_ACTIVITY_CAPTIONS } from "@/lib/marketing/homepage-v2-content"
import { useReducedMotionSafe } from "../shared/useReducedMotionSafe"

const ROTATE_MS = 2500

export function AgentActivityLoop() {
  const reduced = useReducedMotionSafe()
  const [index, setIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (reduced) return
    if (typeof window === "undefined") return

    const node = containerRef.current
    if (!node) return

    let visible = true
    let focused = document.visibilityState === "visible"
    let intervalId: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (intervalId != null) return
      intervalId = setInterval(() => {
        setIndex((i) => (i + 1) % AGENT_ACTIVITY_CAPTIONS.length)
      }, ROTATE_MS)
    }
    const stop = () => {
      if (intervalId == null) return
      clearInterval(intervalId)
      intervalId = null
    }
    const sync = () => {
      if (visible && focused) start()
      else stop()
    }

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? false
        sync()
      },
      { threshold: 0.25 },
    )
    io.observe(node)

    const onVis = () => {
      focused = document.visibilityState === "visible"
      sync()
    }
    document.addEventListener("visibilitychange", onVis)

    sync()

    return () => {
      stop()
      io.disconnect()
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [reduced])

  const caption = AGENT_ACTIVITY_CAPTIONS[index] ?? AGENT_ACTIVITY_CAPTIONS[0]

  return (
    <div
      ref={containerRef}
      aria-live="polite"
      aria-atomic="true"
      className="mx-auto flex h-9 w-full max-w-2xl items-center justify-center gap-2 px-4"
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)] motion-reduce:shadow-none"
      />
      <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="truncate text-center font-mono text-[12px] leading-tight text-white/70 sm:text-[13px]"
          >
            {caption}
          </motion.p>
        </AnimatePresence>
      </div>
      <span
        aria-hidden
        className="ml-0.5 inline-block h-3.5 w-1.5 shrink-0 bg-white/70 animate-pulse motion-reduce:animate-none"
      />
    </div>
  )
}
