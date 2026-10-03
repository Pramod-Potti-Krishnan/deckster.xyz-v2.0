import type { CSSProperties } from "react"
import Link from "next/link"
import { V3_CONTENT, showcaseAlt } from "@/lib/marketing/v3-content"
import { BuildCta } from "../BuildCta"
import { SlideChip } from "../SlideChip"

export function Start({ n, total }: { n: number; total: number }) {
  const copy = V3_CONTENT.start
  return (
    <section className="slide slide--night is-in" id="start" data-snap="slide" data-chapter="Start" data-slide-label={copy.label} data-label={copy.label}>
      <div className="glow glow--violet" style={{ width: "62vw", height: "62vw", left: "-22vw", top: "-30vw" }} />
      <div className="glow glow--coral" style={{ width: "44vw", height: "44vw", right: "-16vw", bottom: "-20vw", opacity: 0.32 }} />
      <div className="dots" /><div className="grain" />
      <div className="slide__inner">
        <div className="cols">
          <div>
            <span className="eyebrow" data-reveal>{copy.eyebrow}</span>
            <h1 className="h1" data-reveal style={{ "--d": 1 } as CSSProperties}>
              {copy.title[0]}<br />{copy.title[1]}<br /><span className="you">{copy.title[2]}</span>
            </h1>
            <p className="lede" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.lede}</p>
            <div className="ctas" data-reveal style={{ "--d": 3 } as CSSProperties}>
              <BuildCta className="btn btn--primary" location="v3_hero_build">
                {copy.build} <svg className="arrow" aria-hidden="true"><use href="#arrow" /></svg>
              </BuildCta>
              <a className="btn btn--ghost" href="#zoom" data-next>{copy.see}</a>
            </div>
            <p className="truthline" data-reveal style={{ "--d": 3 } as CSSProperties}>{copy.codeLead}<Link href="/auth/signin">{copy.codeLink}</Link>{copy.codeTail}</p>
            <div className="facts" data-reveal style={{ "--d": 4 } as CSSProperties}>
              {copy.facts.map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
          <div className="stack" data-reveal style={{ "--d": 2 } as CSSProperties}>
            {[9, 1, 4].map((slide, index) => (
              <div className="stack__card" key={slide}>
                <img src={`/marketing/v3/slides/deck-${String(slide).padStart(2, "0")}.jpg`} alt={showcaseAlt(slide, V3_CONTENT.zoom.tiles.find((tile) => tile.slide === slide)?.title ?? "")} width={1280} height={724} fetchPriority={index === 2 ? "high" : undefined} />
              </div>
            ))}
            <div className="stack__you">
              <svg className="cur" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3l7 17 2.5-6.5L20 11z" fill="currentColor" /></svg>
              <div><span className="k">{copy.cursor}</span><span className="you">{copy.request}</span></div>
            </div>
            <div className="stack__agent">{copy.agent}<b>{copy.agentBold}</b>{copy.agentSource}</div>
          </div>
        </div>
      </div>
      <a className="cue" href="#zoom" data-next>{copy.cue}<i /></a>
      <SlideChip number={n} total={total} label={copy.label} />
    </section>
  )
}
