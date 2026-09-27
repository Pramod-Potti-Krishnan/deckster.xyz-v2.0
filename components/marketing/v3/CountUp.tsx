"use client"

import { useEffect, useRef, useState } from "react"

export function CountUp({ end }: { end: number }) {
  const ref = useRef<HTMLElement>(null)
  const [value, setValue] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    let frame = 0
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return
      observer.disconnect()
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setValue(end)
        return
      }
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 1200)
        setValue(Math.round(end * (1 - Math.pow(1 - t, 3))))
        if (t < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }, { threshold: 0.5 })
    observer.observe(element)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [end])

  return <b ref={ref} data-count={end}>{value.toLocaleString()}</b>
}
