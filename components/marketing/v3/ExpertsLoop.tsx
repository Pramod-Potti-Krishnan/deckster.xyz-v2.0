"use client"

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react"
import { trackCta } from "@/lib/analytics"

export interface ExpertsLoopContent {
  bar: string
  live: string
  paused: string
  pause: string
  resume: string
  steer: string
  placeholder: string
  inputLabel: string
  pauseLine: { who: string; text: string }
  resumeLine: { who: string; text: string }
  steerReplies: readonly { who: string; text: string }[]
  script: readonly { kind: "k" | "a"; who: string; text: string }[]
}

interface LogLine {
  id: number
  kind: "a" | "d" | "h"
  who: string
  text: string
}

export function ExpertsLoop({ copy }: { copy: ExpertsLoopContent }) {
  const [lines, setLines] = useState<LogLine[]>([])
  const [paused, setPaused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const tickerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const replyTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const indexRef = useRef(0)
  const idRef = useRef(0)
  const pausedRef = useRef(false)

  const append = (kind: LogLine["kind"], who: string, text: string) => {
    const line = { id: idRef.current++, kind, who, text }
    setLines((current) => [...current, line].slice(-8))
  }

  const clearTicker = () => {
    if (tickerRef.current !== null) clearTimeout(tickerRef.current)
    tickerRef.current = null
  }

  const tick = () => {
    if (pausedRef.current || copy.script.length === 0) return
    const entry = copy.script[indexRef.current % copy.script.length]
    append(entry.kind === "k" ? "d" : "a", entry.who, entry.text)
    indexRef.current += 1
    tickerRef.current = setTimeout(tick, 1700 + Math.random() * 900)
  }

  useEffect(() => {
    indexRef.current = 0
    idRef.current = 0
    pausedRef.current = false
    setPaused(false)
    setLines([])
    tick()
    return () => {
      clearTicker()
      replyTimersRef.current.forEach(clearTimeout)
      replyTimersRef.current = []
    }
    // The locked script is supplied once for this slide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copy])

  const pause = () => {
    trackCta("v3_experts_pause")
    pausedRef.current = true
    setPaused(true)
    clearTicker()
    append("h", copy.pauseLine.who, copy.pauseLine.text)
  }

  const resume = () => {
    pausedRef.current = false
    setPaused(false)
    append("d", copy.resumeLine.who, copy.resumeLine.text)
    clearTicker()
    tickerRef.current = setTimeout(tick, 1700 + Math.random() * 900)
  }

  const steer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = inputRef.current
    if (!input) return
    const value = (input.value || copy.placeholder).trim()
    if (!value) return
    trackCta("v3_experts_steer")
    append("h", copy.pauseLine.who, value)
    input.value = ""
    copy.steerReplies.forEach((reply, index) => {
      const delay = index === 0 ? 700 : 1600
      replyTimersRef.current.push(setTimeout(() => {
        append(index === 0 ? "d" : "a", reply.who, reply.text)
      }, delay))
    })
  }

  return (
    <div className="loop" data-reveal style={{ "--d": 2 } as CSSProperties}>
      <div className="loop__bar">
        {copy.bar}
        <span className={`pill ${paused ? "pill--you" : "pill--live"}`} data-loop-state>
          {paused ? copy.paused : copy.live}
        </span>
      </div>
      <div className="loop__log" data-ticker>
        {lines.map((line) => (
          <div className={line.kind} key={line.id}><span className="k">{line.who} · </span>{line.text}</div>
        ))}
      </div>
      <form className="loop__ctl" data-steer onSubmit={steer}>
        <button type="button" className="btn btn--ghost" data-pause onClick={pause}>{copy.pause}</button>
        <button type="button" className="btn btn--ghost" data-resume onClick={resume}>{copy.resume}</button>
        <input ref={inputRef} type="text" placeholder={copy.placeholder} aria-label={copy.inputLabel} />
        <button type="submit" className="btn btn--you">{copy.steer}</button>
      </form>
    </div>
  )
}
