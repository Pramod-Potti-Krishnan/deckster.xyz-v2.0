"use client"

import { useEffect, useRef, useState } from "react"

const STEP_MS = 3400

/** The published deck presenting itself: slides advance on a progress bar while on screen. */
export function PlayerSlides({ slides, captionLead, total }: { slides: readonly { src: string; alt: string; number: number }[]; captionLead: string; total: number }) {
  const [index, setIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let visible = false
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; setRunning(entry.isIntersecting) })
    io.observe(el)
    const timer = setInterval(() => { if (visible) setIndex((current) => (current + 1) % slides.length) }, STEP_MS)
    return () => { clearInterval(timer); io.disconnect() }
  }, [slides])
  return (
    <div className="player__slide" ref={ref}>
      {slides.map((slide, i) => (
        <img key={slide.src} className={i === index ? "is-on" : undefined} src={slide.src} alt={i === index ? slide.alt : ""} width={1280} height={720} loading={i === 0 ? undefined : "lazy"} decoding="async" />
      ))}
      <span className="player__cap">{captionLead} {slides[index].number} of {total}</span>
      {running && <i className="player__progress" key={index} style={{ ["--dur" as string]: `${STEP_MS}ms` }} />}
    </div>
  )
}
