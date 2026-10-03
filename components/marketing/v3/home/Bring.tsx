import type { CSSProperties } from "react"
import { BringFlow, type BringFlowCopy } from "../BringFlow"
import { SlideChip } from "../SlideChip"
import { StatusPill, statusOf } from "../StatusPill"
import type { V3Feature } from "@/lib/marketing/v3-content"

export type BringCopy = BringFlowCopy & {
  label: string
  eyebrow: string
  title: string
  lede: string
  notes: readonly { title: string; body: string; feature: V3Feature }[]
}

const NOTE_COLORS = ["var(--coral)", "var(--violet)", "var(--mint)"] as const

export function Bring({ copy, n, total }: { copy: BringCopy; n: number; total: number }) {
  const statuses = { template: statusOf("templates"), sources: statusOf("sources"), theme: statusOf("themes") }
  return (
    <section className="slide slide--paper" id="bring" data-snap="slide" data-chapter="Bring" data-slide-label={copy.label} data-label={copy.label}>
      <div className="grain" />
      <div className="slide__inner">
        <div className="center">
          <span className="eyebrow eyebrow--you" data-reveal>{copy.eyebrow}</span>
          <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.title}</h2>
          <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.lede}</p>
        </div>
        <BringFlow copy={copy} statuses={statuses} />
        <div className="bring__notes">
          {copy.notes.map((note, index) => (
            <div key={note.title} data-reveal style={{ "--d": index + 4 } as CSSProperties}>
              <b><i style={{ background: NOTE_COLORS[index] }} />{note.title} <StatusPill feature={note.feature} small /></b>
              <p>{note.body}</p>
            </div>
          ))}
        </div>
      </div>
      <SlideChip number={n} total={total} label={copy.label} />
    </section>
  )
}
