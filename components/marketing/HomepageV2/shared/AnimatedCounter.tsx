"use client"

import { useEffect, useRef, useState } from "react"
import { useInView } from "framer-motion"
import { useReducedMotionSafe } from "./useReducedMotionSafe"

export function AnimatedCounter({
  target,
  duration = 1800,
  suffix = "",
  className,
}: {
  target: number
  duration?: number
  suffix?: string
  className?: string
}) {
  const reduced = useReducedMotionSafe()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const [value, setValue] = useState(reduced ? target : 0)

  useEffect(() => {
    if (!inView || reduced) return
    let raf = 0
    let start = 0
    const tick = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(target * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, reduced, target, duration])

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString()}
      {suffix}
    </span>
  )
}
