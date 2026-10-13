"use client"

// PASS2 #4 (flag NEXT_PUBLIC_STUDIO_OUTLINE_CANVAS): the outline review on the canvas, as in the accepted v4 mockup's
// story-outline view. Reads the outline frame only; its one action is the caller's onApprove, which presses Director's own
// approve action through the chat card's handler. Selecting a slide here is local and sends nothing.
import { useEffect, useRef, useState } from "react"
import { ArrowRight, Check, FileText, Sparkles } from "lucide-react"
import type { SlideContextItem, SlideUpdate } from "@/hooks/use-deckster-websocket-v2"
import "./studio-outline-canvas.css"

interface StudioOutlineCanvasProps {
  outline: SlideUpdate["payload"]
  contextByIndex?: Record<number, SlideContextItem> | null
  /** Resolves once the approval was handed over (or refused); the button is busy until then. */
  onApprove: () => unknown
}

const two = (value: number) => String(value).padStart(2, "0")

export function StudioOutlineCanvas({ outline, contextByIndex, onApprove }: StudioOutlineCanvasProps) {
  const slides = outline.slides
  const [selected, setSelected] = useState(0)
  const [approving, setApproving] = useState(false)
  const index = Math.min(selected, slides.length - 1)
  const slide = slides[index]
  const purpose = contextByIndex?.[index]?.key_message || slide.narrative
  const audience = outline.metadata?.target_audience
  // The viewer it covers stays mounted; while covered it is inert, and exactly what this made inert is restored on unmount.
  const sectionRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const self = sectionRef.current
    const covered = Array.from(self?.parentElement?.children ?? []).filter(el => el !== self && !el.hasAttribute("inert"))
    covered.forEach(el => el.setAttribute("inert", ""))
    return () => covered.forEach(el => el.removeAttribute("inert"))
  }, [])
  const approve = async () => {
    if (approving) return
    setApproving(true)
    try { await onApprove() } finally { setApproving(false) }
  }
  return (
    <section ref={sectionRef} data-studio-outline-canvas="true" aria-label="Outline review">
      <div data-studio-outline-canvas-part="body">
        <div data-studio-outline-canvas-part="heading">
          <div>
            <span data-studio-outline-canvas-part="eyebrow">Your story, in sequence</span>
            <h2>A clear path through the story.</h2>
            <p>{slides.length} slides{audience ? ` · ${audience}` : ""} · Review the structure before we build.</p>
          </div>
          <span data-studio-outline-canvas-part="badge">Outline</span>
        </div>
        <div data-studio-outline-canvas-part="main">
          <div data-studio-outline-canvas-part="slide" aria-live="polite">
            <span data-studio-outline-canvas-part="slide-number">Slide {two(index + 1)} / {two(slides.length)}</span>
            <h3>{slide.title}</h3>
            <div data-studio-outline-canvas-part="wire-lines" aria-hidden="true"><i /><i /><i /></div>
            <div data-studio-outline-canvas-part="wire-blocks" aria-hidden="true"><i /><i /><i /></div>
            {purpose && <p data-studio-outline-canvas-part="purpose"><Sparkles size={14} aria-hidden="true" /><span>{purpose}</span></p>}
          </div>
          <ol data-studio-outline-canvas-part="list" aria-label="Outline slides">
            {slides.map((item, i) => (
              <li key={item.slide_id || i}>
                <button type="button" aria-pressed={i === index} onClick={() => setSelected(i)}>
                  <span>{two(i + 1)}</span>
                  <strong>{item.title}</strong>
                  {i === index && <Check size={12} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div data-studio-outline-canvas-part="footer">
          <span><FileText size={13} aria-hidden="true" />Approved structure → your selected theme.</span>
          <button type="button" data-studio-outline-canvas-part="approve" disabled={approving} aria-busy={approving || undefined} onClick={approve}>
            Approve &amp; build<ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
