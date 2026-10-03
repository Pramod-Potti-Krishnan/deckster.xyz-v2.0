"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { trackCta } from "@/lib/analytics"

export interface ExpertsLoopContent {
  bar: string
  pause: string
  resume: string
  stop: string
  pausedLine: string
  resumeLine: string
  stoppedLine: string
  note: string
  noteStrong: string
  prefill: number
  script: readonly string[]
}

interface LogLine {
  id: number
  kind: "a" | "h"
  text: string
}

type State = "running" | "paused" | "stopped"

/**
 * The build log, in the product's own words. It starts filled so the panel is complete at rest,
 * only ticks while on screen, and stays still for reduced-motion visitors.
 */
export function ExpertsLoop({ copy, status }: { copy: ExpertsLoopContent; status: { status: string; word: string } }) {
  const initial = copy.script.slice(0, copy.prefill).map((text, id) => ({ id, kind: "a" as const, text }))
  const [lines, setLines] = useState<LogLine[]>(initial)
  const [state, setState] = useState<State>("running")
  const rootRef = useRef<HTMLDivElement>(null)
  const indexRef = useRef(copy.prefill)
  const idRef = useRef(copy.prefill)
  const stateRef = useRef<State>("running")
  const visibleRef = useRef(false)

  const append = (kind: LogLine["kind"], text: string) => {
    const line = { id: idRef.current++, kind, text }
    setLines((current) => [...current, line].slice(-7))
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root || copy.script.length === 0) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const io = new IntersectionObserver(([entry]) => { visibleRef.current = entry.isIntersecting })
    io.observe(root)
    const timer = setInterval(() => {
      if (!visibleRef.current || stateRef.current !== "running") return
      append("a", copy.script[indexRef.current % copy.script.length])
      indexRef.current += 1
    }, 2100)
    return () => {
      clearInterval(timer)
      io.disconnect()
    }
    // The script is supplied once for this slide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copy])

  const set = (next: State, line: string) => {
    stateRef.current = next
    setState(next)
    append(next === "running" ? "a" : "h", line)
  }

  return (
    <div className="loop" data-reveal style={{ "--d": 2 } as CSSProperties} ref={rootRef}>
      <div className="loop__bar">
        {copy.bar}
        <span className={`st st--${status.status}`}>{status.word}</span>
      </div>
      <div className="loop__log" style={{ padding: "14px 16px" }} aria-hidden="true">
        {lines.map((line, index) => (
          <span key={line.id} className={`ln${line.kind === "h" ? " h" : ""}${index === lines.length - 1 && state === "running" ? " is-now" : ""}`}>
            <b>{index === lines.length - 1 && state === "running" ? "›" : "✓"}</b>{line.text}
          </span>
        ))}
      </div>
      <div className="loop__ctl">
        {state === "running" ? (
          <button type="button" className="btn btn--ghost" onClick={() => { trackCta("v3_experts_pause"); set("paused", copy.pausedLine) }}>{copy.pause}</button>
        ) : (
          <button type="button" className="btn btn--ghost" onClick={() => set("running", copy.resumeLine)}>{copy.resume}</button>
        )}
        <button type="button" className="btn btn--ghost" disabled={state === "stopped"} onClick={() => { trackCta("v3_experts_pause", { action: "stop" }); set("stopped", copy.stoppedLine) }}>{copy.stop}</button>
        <span className="small">{copy.note}<b>{copy.noteStrong}</b></span>
      </div>
    </div>
  )
}
