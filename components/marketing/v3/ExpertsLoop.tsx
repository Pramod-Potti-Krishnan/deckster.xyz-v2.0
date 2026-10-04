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
  script: readonly { who: string; text: string }[]
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
  const initial = copy.script.slice(0, copy.prefill).map((line, id) => ({ id, kind: "a" as const, text: line.text }))
  const [lines, setLines] = useState<LogLine[]>(initial)
  const [state, setState] = useState<State>("running")
  const [step, setStep] = useState(copy.prefill)
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
    // The specialist doing the work lights up in the org chart beside the log.
    const agents = root.closest("section")?.querySelectorAll<HTMLElement>("[data-agent]") ?? []
    const light = (who: string) => agents.forEach((el) => el.classList.toggle("is-active", el.dataset.agent === who))
    light(copy.script[(copy.prefill - 1) % copy.script.length]?.who ?? "director")
    const timer = setInterval(() => {
      if (!visibleRef.current || stateRef.current !== "running") return
      const line = copy.script[indexRef.current % copy.script.length]
      append("a", line.text)
      light(line.who)
      indexRef.current += 1
      setStep(indexRef.current)
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
        <i className="loop__progress" aria-hidden="true" style={{ transform: `scaleX(${((step % copy.script.length) + 1) / copy.script.length})` }} />
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
