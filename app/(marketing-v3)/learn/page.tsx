import type { CSSProperties } from "react"
import Link from "next/link"
import { V3_CONTENT } from "@/lib/marketing/v3-content"
import { v3Metadata } from "@/lib/marketing/v3-metadata"
import styles from "./learn.module.css"
import type { Metadata } from "next"
import { FooterV3 } from "@/components/marketing/v3/FooterV3"
import { SlideChip } from "@/components/marketing/v3/SlideChip"
import { BuildCta } from "@/components/marketing/v3/BuildCta"

const copy = V3_CONTENT.pages.learn

export const metadata: Metadata = v3Metadata({ path: "/learn", title: copy.metadata.title, description: copy.metadata.description })

export default function LearnV3Page() {
  return (
    <main>
      <section className="slide slide--paper is-in" id="start" data-snap="slide" data-slide-label={copy.start.label} data-label={copy.start.label}>
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal>{copy.start.eyebrow}</span>
            <h1 className="h1 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.start.title}<span className="you">{copy.start.titleAccent}</span></h1>
            <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.start.lede}</p>
          </div>
          <div className="grid3" style={{ marginTop: 34 }}>
            {copy.start.cards.map((item, index) => <div className="card" key={item.name} data-reveal style={{ "--d": index + 3 } as CSSProperties}>
              <span className="big" style={{ color: "var(--violet)" }}>{item.name}</span>
              <h3 className="h3">{item.title}</h3>
              <p>{item.body}</p>
              <span className="you" style={{ display: "block", marginTop: 12 }}>{item.example}</span>
              <div className="k-row">{item.tags.map((tag) => <span className="pill" key={tag}>{tag}</span>)}</div>
            </div>)}
          </div>
        </div>
        <a className="cue" href="#first" data-next>{copy.start.cue}<i /></a>
        <SlideChip number={1} total={4} label={copy.start.label} />
      </section>

      <section className="slide slide--paper" id="first" data-snap="slide" data-slide-label={copy.first.label} data-label={copy.first.label}>
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow eyebrow--you" data-reveal>{copy.first.eyebrow}</span>
            <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.first.title}</h2>
          </div>
          <div className={`steps ${styles.fiveSteps}`}>
            {copy.first.steps.map((item, index) => <div className="step" key={item.number} data-reveal style={{ "--d": index + 2 } as CSSProperties}>
              <span className="n">{item.number}</span><b>{item.title}</b><p>{item.body}</p>
            </div>)}
          </div>
        </div>
        <SlideChip number={2} total={4} label={copy.first.label} />
      </section>

      <section className="slide slide--night" id="guides" data-snap="slide" data-slide-label={copy.guides.label} data-label={copy.guides.label}>
        <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", left: "-12vw", top: "10vh", opacity: .35 }} />
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal>{copy.guides.eyebrow}</span>
            <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.guides.title}</h2>
          </div>
          <div className="grid3" style={{ marginTop: 30 }}>
            {copy.guides.cards.map((item, index) => "href" in item
              ? <Link className="card" href={item.href} key={item.title} data-reveal style={{ "--d": index + 2 } as CSSProperties}>
                <span className="pill">{item.tag}</span>
                <h3 className="h3">{item.title}</h3>
                <p>{item.body}</p>
              </Link>
              : <div className="card is-soon" key={item.title} data-reveal style={{ "--d": index + 2 } as CSSProperties}>
                <span className="pill">{item.tag}</span>
                <h3 className="h3">{item.title}</h3>
                <p>{item.body}</p>
              </div>)}
          </div>
        </div>
        <SlideChip number={3} total={4} label={copy.guides.label} />
      </section>

      <section className="slide slide--night" id="close" data-snap="slide" data-slide-label={copy.close.label} data-label={copy.close.label}>
        <div className="glow glow--coral" style={{ width: "50vw", height: "50vw", left: "25vw", top: "-20vh", opacity: .3 }} />
        <div className="dots" /><div className="grain" />
        <div className="slide__inner center">
          <span className="eyebrow eyebrow--you" data-reveal>{copy.close.eyebrow}</span>
          <h2 className="h1 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.close.title}<span className="you">{copy.close.titleAccent}</span></h2>
          <div className="ctas" style={{ justifyContent: "center", "--d": 2 } as CSSProperties} data-reveal>
            <BuildCta className="btn btn--primary" location="v3_close_build">{copy.close.build} <svg className="arrow" aria-hidden="true"><use href="#arrow" /></svg></BuildCta>
            <a className="btn btn--ghost" href="/bring">{copy.close.bring}</a>
          </div>
        </div>
        <FooterV3 />
        <SlideChip number={4} total={4} label={copy.close.label} />
      </section>
    </main>
  )
}
