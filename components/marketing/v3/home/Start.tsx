import type { CSSProperties } from "react"
import Link from "next/link"
import { V3_CONTENT, V3_STATUS_WORDS, showcaseAlt } from "@/lib/marketing/v3-content"
import { HeroFilm } from "../HeroFilm"
import { TargetSlide } from "../ZoomBuild"
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
          <HeroFilm
            copy={copy.film}
            tiles={copy.film.tiles.map((slot) => ({ src: `/marketing/v3/slides/deck-${String(slot).padStart(2, "0")}.jpg`, alt: showcaseAlt(slot) }))}
            target={<TargetSlide copy={V3_CONTENT.zoom.slide} />}
            youLabel={copy.cursor}
            statusWord={V3_STATUS_WORDS.live}
          />
        </div>
      </div>
      <a className="cue" href="#zoom" data-next>{copy.cue}<i /></a>
      <SlideChip number={n} total={total} label={copy.label} />
    </section>
  )
}
