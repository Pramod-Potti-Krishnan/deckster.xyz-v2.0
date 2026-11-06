import type { CSSProperties } from "react"
import { CountUp } from "../CountUp"
import { Marquee, type MarqueeChip } from "../Marquee"
import { SlideChip } from "../SlideChip"

export interface GalleryCopy {
  label: string
  eyebrow: string
  title: string
  lede: string
  counts: readonly { value: number | string; label: string }[]
  rows: readonly (readonly MarqueeChip[])[]
}

export function Gallery({ copy }: { copy: GalleryCopy }) {
  return (
    <section className="slide slide--paper" id="gallery" data-snap="slide" data-slide-label={copy.label} data-label={copy.label}>
      <div className="grain" />
      <div className="slide__inner">
        <div className="center">
          <span className="eyebrow" data-reveal>{copy.eyebrow}</span>
          <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.title}</h2>
          <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.lede}</p>
        </div>
        <div className="counts" data-reveal style={{ "--d": 3 } as CSSProperties}>
          {copy.counts.map(({ value, label }) => (
            <div key={label}>{typeof value === "number" ? <CountUp end={value} /> : <b>{value}</b>}<span>{label}</span></div>
          ))}
        </div>
        <Marquee rows={copy.rows} />
      </div>
      <SlideChip number={8} label={copy.label} />
    </section>
  )
}
