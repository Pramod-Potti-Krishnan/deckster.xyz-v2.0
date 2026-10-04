import type { CSSProperties } from "react"
import { showcaseAlt } from "@/lib/marketing/v3-content"
import { TrackedLink } from "../BuildCta"
import { SlideChip } from "../SlideChip"
import { StatusPill } from "../StatusPill"

export interface RealDeckCopy {
  label: string
  eyebrow: string
  title: string
  lede: string
  open: string
  url: string
  mosaic: readonly number[]
}

/** A real published deck (item M-22). Rendered only when copy.url is set. */
export function RealDeck({ copy, n, total }: { copy: RealDeckCopy; n: number; total: number }) {
  return (
    <section className="slide slide--night" id="realdeck" data-snap="slide" data-chapter="Present" data-slide-label={copy.label} data-label={copy.label}>
      <div className="glow glow--violet" style={{ width: "46vw", height: "46vw", right: "-10vw", top: "-12vh", opacity: 0.32 }} />
      <div className="grain" />
      <div className="slide__inner">
        <div className="realdeck">
          <div className="realdeck__mosaic" data-reveal>
            {copy.mosaic.map((slot) => (
              <img key={slot} src={`/marketing/v3/slides/deck-${String(slot).padStart(2, "0")}.jpg`} alt={showcaseAlt(slot)} width={1280} height={720} loading="lazy" decoding="async" />
            ))}
          </div>
          <div>
            <span className="eyebrow" data-reveal>{copy.eyebrow}</span>
            <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.title}</h2>
            <p className="lede" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.lede}</p>
            <div className="ctas" data-reveal style={{ "--d": 3 } as CSSProperties}>
              <TrackedLink className="btn btn--primary" href={copy.url} location="v3_realdeck_open">{copy.open} <svg className="arrow" aria-hidden="true"><use href="#arrow" /></svg></TrackedLink>
            </div>
            <p className="truthline" data-reveal style={{ "--d": 4 } as CSSProperties}>{copy.url.replace(/^https?:\/\//, "")} <StatusPill feature="publish" small /></p>
          </div>
        </div>
      </div>
      <SlideChip number={n} total={total} label={copy.label} />
    </section>
  )
}
