"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useReducedMotionSafe } from "../shared/useReducedMotionSafe"

const ROTATE_INTERVAL_MS = 3500

/**
 * The hero's rotating first line — the visitor's reclaimed moment ("Drink
 * your tea." / "Take that walk."). Cycles with a gentle fade; respects
 * prefers-reduced-motion by staying on the first phrase, which is also what
 * the server renders (no hydration flash, no layout shift — the line box is
 * one line tall regardless of phrase).
 */
export function RotatingHeadline({
  phrases,
}: {
  phrases: ReadonlyArray<string>
}) {
  const [index, setIndex] = useState(0)
  const reduced = useReducedMotionSafe()

  useEffect(() => {
    if (reduced || phrases.length < 2) return
    const id = setInterval(
      () => setIndex((i) => (i + 1) % phrases.length),
      ROTATE_INTERVAL_MS,
    )
    return () => clearInterval(id)
  }, [reduced, phrases.length])

  return (
    <span className="relative block">
      {/* Invisible sizer keeps the line box stable while phrases of
          different widths swap in and out. */}
      <span aria-hidden className="invisible block">
        {phrases[0]}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="absolute inset-0 block"
        >
          {phrases[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
