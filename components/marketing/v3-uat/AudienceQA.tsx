"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"

export interface QAEntry {
  who: "viewer" | "deck"
  kicker: string
  text: string
  source?: string
}

export interface AudienceQACopy {
  title: string
  input: string
  sequence: readonly QAEntry[]
}

/** Scripted demo of text answers (the beta Q&A). Starts filled, cycles only while on screen. */
export function AudienceQA({ copy, status, style, dataRevealDelay, keep = 3 }: {
  copy: AudienceQACopy
  status: { status: string; word: string }
  style?: CSSProperties
  dataRevealDelay?: number
  keep?: number
}) {
  const [messages, setMessages] = useState(() => copy.sequence.slice(0, keep).map((entry, index) => ({ index, entry })))
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root || copy.sequence.length <= keep) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let visible = false
    let count = keep
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    io.observe(root)
    const timer = setInterval(() => {
      if (!visible) return
      const entry = copy.sequence[count % copy.sequence.length]
      const item = { index: count, entry }
      setMessages((previous) => [...previous, item].slice(-keep))
      count += 1
    }, 2600)
    return () => {
      clearInterval(timer)
      io.disconnect()
    }
  }, [copy.sequence, keep])

  return (
    <div ref={rootRef} className="qa" style={dataRevealDelay === undefined ? style : { ...style, "--d": dataRevealDelay } as CSSProperties} data-reveal={dataRevealDelay === undefined ? undefined : ""}>
      <div className="qa__hd"><span className={`st st--${status.status}`}>{status.word}</span>{copy.title}</div>
      <div className="qa__log" aria-hidden="true">
        {messages.map(({ index, entry }) => (
          <div className={`msg msg--${entry.who}`} key={index}>
            <span className="k">{entry.kicker}</span>{entry.text}
            {entry.who === "deck" && entry.source && <span className="src">{entry.source}</span>}
          </div>
        ))}
      </div>
      <div className="qa__in"><span>{copy.input}</span></div>
    </div>
  )
}
