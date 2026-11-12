"use client"

import { useEffect, useRef, useState } from "react"

/**
 * "Bring your ___ deck." — the accent word changes while the slide is on screen.
 * All words share one grid cell sized to the widest, so the headline never reflows or wraps as they change.
 */
export function CycleWord({ words, className }: { words: readonly string[]; className?: string }) {
  const [index, setIndex] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || words.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let visible = false
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    io.observe(el)
    const timer = setInterval(() => { if (visible) setIndex((current) => (current + 1) % words.length) }, 2200)
    return () => { clearInterval(timer); io.disconnect() }
  }, [words])
  return (
    <span ref={ref} className={`cyc${className ? ` ${className}` : ""}`}>
      {words.map((word, i) => <span key={word} className={`cyc__w${i === index ? " is-on" : ""}`} aria-hidden={i !== index}>{word}</span>)}
    </span>
  )
}
