"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { Waveform } from "./Waveform"

export interface QAEntry {
  who: "viewer" | "deck"
  kicker: string
  text: string
  source?: string
}

export interface AudienceQACopy {
  live: string
  title: string
  input: string
  sequence: readonly QAEntry[]
}

export function AudienceQA({ copy, style, dataRevealDelay }: { copy: AudienceQACopy; style?: CSSProperties; dataRevealDelay?: number }) {
  const [messages, setMessages] = useState<{ index: number; entry: QAEntry }[]>([])

  useEffect(() => {
    if (!copy.sequence.length) return
    let count = 0
    let timer: ReturnType<typeof setTimeout>
    const push = () => {
      const entry = copy.sequence[count % copy.sequence.length]
      setMessages((previous) => [...previous, { index: count, entry }].slice(-3))
      count += 1
      timer = setTimeout(push, entry.who === "viewer" ? 1600 : 4200)
    }
    timer = setTimeout(push, 600)
    return () => clearTimeout(timer)
  }, [copy.sequence])

  return (
    <div className="qa" style={dataRevealDelay === undefined ? style : { ...style, "--d": dataRevealDelay } as CSSProperties} data-reveal={dataRevealDelay === undefined ? undefined : ""}>
      <div className="qa__hd"><span className="pill pill--live">{copy.live}</span>{copy.title}</div>
      <div className="qa__log" data-qa aria-live="polite" aria-label={copy.title}>
        {messages.map(({ index, entry }) => (
          <div className={`msg msg--${entry.who}`} key={index}>
            <span className="k">{entry.kicker}</span>{entry.text}
            {entry.who === "deck" && <><Waveform count={22} /><span className="src">{entry.source}</span></>}
          </div>
        ))}
      </div>
      <div className="qa__in"><span>{copy.input}</span></div>
    </div>
  )
}
