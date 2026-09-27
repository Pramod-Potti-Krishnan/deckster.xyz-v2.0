import type { CSSProperties } from "react"
import Link from "next/link"
import { BuildCta, TrackedLink } from "../BuildCta"
import { FooterV3 } from "../FooterV3"
import { SlideChip } from "../SlideChip"

export interface BeginCopy {
  label: string
  eyebrow: string
  titleLead: string
  titleAccent: string
  titleTail: string
  lede: string
  drop: { iconTop: string; iconBottom: string; title: string; description: string }
  build: string
  experts: string
}

export function Begin({ copy }: { copy: BeginCopy }) {
  return (
    <section className="slide slide--night" id="close" data-snap="slide" data-slide-label={copy.label} data-label={copy.label}>
      <div className="glow glow--violet" style={{ width: "60vw", height: "60vw", left: "20vw", top: "-20vh", opacity: 0.4 }} />
      <div className="glow glow--coral" style={{ width: "36vw", height: "36vw", right: "-8vw", bottom: 0, opacity: 0.3 }} />
      <div className="dots" /><div className="grain" />
      <div className="slide__inner center">
        <span className="eyebrow eyebrow--you" data-reveal>{copy.eyebrow}</span>
        <h2 className="h1 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.titleLead}<span className="you">{copy.titleAccent}</span>{copy.titleTail}</h2>
        <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.lede}</p>
        <TrackedLink className="drop" href="/bring" location="v3_close_drop" revealDelay={3}>
          <div className="drop__ic">{copy.drop.iconTop}<br />{copy.drop.iconBottom}</div>
          <div><b>{copy.drop.title}</b><span>{copy.drop.description}</span></div>
        </TrackedLink>
        <div className="ctas" style={{ justifyContent: "center", "--d": 4 } as CSSProperties} data-reveal>
          <BuildCta className="btn btn--primary" location="v3_close_build">{copy.build} <svg className="arrow" aria-hidden="true"><use href="#arrow" /></svg></BuildCta>
          <Link className="btn btn--ghost" href="/experts">{copy.experts}</Link>
        </div>
      </div>
      <SlideChip number={10} label={copy.label} />
      <FooterV3 />
    </section>
  )
}
