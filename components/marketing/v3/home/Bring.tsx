import type { CSSProperties } from "react"
import { BringFlow, type BringFlowCopy } from "../BringFlow"
import { SlideChip } from "../SlideChip"

export type BringCopy = BringFlowCopy & {
  label: string
  eyebrow: string
  title: string
  lede: string
  notes: readonly { title: string; body: string }[]
}

const NOTE_COLORS = ["var(--coral)", "var(--violet)", "var(--mint)"] as const

export function Bring({ copy }: { copy: BringCopy }) {
  return (
    <section className="slide slide--paper" id="bring" data-snap="slide" data-slide-label={copy.label} data-label={copy.label}>
      <div className="grain" />
      <div className="slide__inner">
        <div className="center">
          <span className="eyebrow eyebrow--you" data-reveal>{copy.eyebrow}</span>
          <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.title}</h2>
          <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.lede}</p>
        </div>
        <BringFlow copy={copy} />
        <div className="bring__notes">
          {copy.notes.map((note, index) => (
            <div key={note.title} data-reveal style={{ "--d": index + 4 } as CSSProperties}>
              <b><i style={{ background: NOTE_COLORS[index] }} />{note.title}</b>
              <p>{note.body}</p>
            </div>
          ))}
        </div>
      </div>
      <SlideChip number={3} label={copy.label} />
    </section>
  )
}
