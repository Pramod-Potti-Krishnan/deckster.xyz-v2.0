import type { CSSProperties } from "react"
import { V3_CONTENT, V3_STATUS_WORDS, showcaseAlt } from "@/lib/marketing/v3-content"
import type { Metadata } from "next"
import { FooterV3 } from "@/components/marketing/v3/FooterV3"
import { SlideChip } from "@/components/marketing/v3/SlideChip"
import { v3Metadata } from "@/lib/marketing/v3-metadata"
import { BuildCta } from "@/components/marketing/v3/BuildCta"

const copy = V3_CONTENT.pages.about

export const metadata: Metadata = v3Metadata({ path: "/about", title: copy.metadata.title, description: copy.metadata.description })

const PRINCIPLE_COLORS = ["var(--coral)", "var(--violet)", "var(--mint)"] as const

export default function AboutV3Page() {
  return (
    <main>
      <section className="slide slide--night is-in" id="start" data-snap="slide" data-slide-label={copy.start.label} data-label={copy.start.label}>
        <div className="glow glow--coral" style={{ width: "56vw", height: "56vw", left: "-20vw", top: "-24vw", opacity: .3 }} />
        <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", right: "-18vw", bottom: "-20vw", opacity: .4 }} />
        <div className="dots" /><div className="grain" />
        <div className="slide__inner">
          <div className="cols">
            <div>
              <span className="eyebrow eyebrow--you" data-reveal>{copy.start.eyebrow}</span>
              <h1 className="h1" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.start.title}<span className="you">{copy.start.titleAccent}</span></h1>
              <p className="lede" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.start.lede}</p>
              <div className="trust" data-reveal style={{ "--d": 3 } as CSSProperties}>{copy.start.trust.map((item) => <span key={item}>{item}</span>)}</div>
            </div>
            <div className="stack" data-reveal style={{ "--d": 2 } as CSSProperties}>
              {copy.start.images.map((slot) => <div className="stack__card" key={slot}><img src={`/marketing/v3/slides/deck-${String(slot).padStart(2, "0")}.jpg`} alt={showcaseAlt(slot)} width={1280} height={720} /></div>)}
            </div>
          </div>
        </div>
        <a className="cue" href="#principles" data-next>{copy.start.cue}<i /></a>
        <SlideChip number={1} total={4} label={copy.start.label} />
      </section>

      <section className="slide slide--paper" id="principles" data-snap="slide" data-slide-label={copy.principles.label} data-label={copy.principles.label}>
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal>{copy.principles.eyebrow}</span>
            <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.principles.title}</h2>
          </div>
          <div className="grid3" style={{ marginTop: 34 }}>
            {copy.principles.cards.map((item, index) => <div className="card" key={item.number} data-reveal style={{ "--d": index + 2 } as CSSProperties}>
              <span className="big" style={{ color: PRINCIPLE_COLORS[index] }}>{item.number}</span>
              <h3 className="h3">{item.title}</h3>
              <p>{item.body}</p>
            </div>)}
          </div>
        </div>
        <SlideChip number={2} total={4} label={copy.principles.label} />
      </section>

      <section className="slide slide--paper" id="story" data-snap="slide" data-slide-label={copy.story.label} data-label={copy.story.label}>
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal>{copy.story.eyebrow}</span>
            <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.story.title}</h2>
            <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.story.lede}</p>
          </div>
          <div className="ladder4">
            {copy.story.columns.map((column, index) => <div className="col" key={column.status} data-reveal style={{ "--d": index + 3 } as CSSProperties}>
              <span className={`st st--${column.status}`}>{V3_STATUS_WORDS[column.status]}</span>
              <ul>{column.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>)}
          </div>
        </div>
        <SlideChip number={3} total={4} label={copy.story.label} />
      </section>

      <section className="slide slide--night" id="close" data-snap="slide" data-slide-label={copy.close.label} data-label={copy.close.label}>
        <div className="glow glow--violet" style={{ width: "60vw", height: "60vw", left: "20vw", top: "-20vh", opacity: .4 }} />
        <div className="dots" /><div className="grain" />
        <div className="slide__inner center">
          <span className="eyebrow eyebrow--you" data-reveal>{copy.close.eyebrow}</span>
          <h2 className="h1 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.close.title}<span className="you">{copy.close.titleAccent}</span>{copy.close.titleTail}</h2>
          <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.close.lede}</p>
          <div className="ctas" style={{ justifyContent: "center", "--d": 3 } as CSSProperties} data-reveal>
            <BuildCta className="btn btn--primary" location="v3_close_build">{copy.close.build} <svg className="arrow" aria-hidden="true"><use href="#arrow" /></svg></BuildCta>
            <a className="btn btn--ghost" href={`mailto:${copy.close.email}`}>{copy.close.email}</a>
          </div>
        </div>
        <FooterV3 />
        <SlideChip number={4} total={4} label={copy.close.label} />
      </section>
    </main>
  )
}
