import type { CSSProperties } from "react"
import { showcaseAlt } from "@/lib/marketing/v3-content"
import { SlideChip } from "../SlideChip"

export interface GalleryCopy {
  label: string
  eyebrow: string
  title: string
  lede: string
  counts: readonly { value: string; label: string }[]
  wall: readonly { slot: number; title: string; shape: string }[]
  caption: string
}

export function Gallery({ copy, n, total }: { copy: GalleryCopy; n: number; total: number }) {
  return (
    <section className="slide slide--paper" id="gallery" data-snap="slide" data-chapter="Build" data-slide-label={copy.label} data-label={copy.label}>
      <div className="grain" />
      <div className="slide__inner">
        <div className="center">
          <span className="eyebrow" data-reveal>{copy.eyebrow}</span>
          <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.title}</h2>
          <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.lede}</p>
        </div>
        <div className="counts" data-reveal style={{ "--d": 3 } as CSSProperties}>
          {copy.counts.map(({ value, label }) => <div key={label}><b>{value}</b><span>{label}</span></div>)}
        </div>
        <div className="wall" data-reveal style={{ "--d": 4 } as CSSProperties}>
          {copy.wall.map((item) => (
            <figure key={item.slot}>
              <img src={`/marketing/v3/slides/deck-${String(item.slot).padStart(2, "0")}.jpg`} alt={showcaseAlt(item.slot)} width={1280} height={720} loading="lazy" decoding="async" />
              <figcaption><b>{item.title}</b><span>{item.shape}</span></figcaption>
            </figure>
          ))}
        </div>
        <p className="small center" style={{ marginTop: 12 }}>{copy.caption}</p>
      </div>
      <SlideChip number={n} total={total} label={copy.label} />
    </section>
  )
}
