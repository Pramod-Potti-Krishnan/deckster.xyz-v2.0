import { V3_CONTENT } from "@/lib/marketing/v3-content"
import type { Metadata } from "next"
import type { CSSProperties } from "react"
import { AudienceQA } from "@/components/marketing/v3/AudienceQA"
import { BuildCta } from "@/components/marketing/v3/BuildCta"
import { FooterV3 } from "@/components/marketing/v3/FooterV3"
import { SlideChip } from "@/components/marketing/v3/SlideChip"

const copy = V3_CONTENT.pages.present
export const metadata: Metadata = { title: { absolute: copy.title }, alternates: { canonical: "/present" } }
const reveal = (delay: number) => ({ "--d": delay } as CSSProperties)

function Status({ value }: { value: "Live" | "In build" | "Next" }) {
  return <span className={`pill pill--${value === "Live" ? "live" : value === "Next" ? "next" : "build"}`}>{value}</span>
}

function Hero() {
  const c = copy.hero
  return <section className="slide slide--night" id="start" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="glow glow--coral" style={{ width: "54vw", height: "54vw", right: "-16vw", top: "-20vw", opacity: .3 }} />
    <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", left: "-18vw", bottom: "-20vw", opacity: .4 }} />
    <div className="dots" /><div className="grain" />
    <div className="slide__inner"><div className="cols">
      <div><span className="eyebrow eyebrow--you" data-reveal>{c.eyebrow}</span><h1 className="h1" data-reveal style={reveal(1)}>{c.title[0]}<span className="you">{c.title[1]}</span></h1><p className="lede" data-reveal style={reveal(2)}>{c.lede}</p>
        <div className="ctas" data-reveal style={reveal(3)}><BuildCta className="btn btn--primary" location="v3_hero_build">{c.publish} <svg className="arrow" aria-hidden="true"><use href="#arrow" /></svg></BuildCta><a className="btn btn--ghost" href="#four" data-next>{c.see}</a></div>
        <div className="trust" data-reveal style={reveal(4)}>{c.trust.map((item) => <span key={item}>{item}</span>)}</div>
      </div>
      <AudienceQA copy={{ live: c.live, title: c.qaHeader, input: c.qaInput, sequence: c.sequence }} style={{ minHeight: 420 }} dataRevealDelay={2} />
    </div></div>
    <a className="cue" href="#four" data-next>{c.cue}<i /></a><SlideChip number={1} total={5} label={c.label} />
  </section>
}

function Four() {
  const c = copy.four
  return <section className="slide slide--paper" id="four" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="grain" /><div className="slide__inner"><div className="center"><span className="eyebrow" data-reveal>{c.eyebrow}</span><h2 className="h2 balance" data-reveal style={reveal(1)}>{c.title}</h2><p className="lede balance" data-reveal style={reveal(2)}>{c.lede}</p></div>
      <div className="grid4" style={{ marginTop: 30 }}>{c.cards.map((card, i) => <div className="card" key={card.title} data-reveal style={reveal(i + 3)}><Status value={card.status} /><h3 className="h3">{card.title}</h3><p>{card.body}</p></div>)}</div>
      <div className="rooms" data-reveal style={reveal(7)}>{c.rooms.map((room) => <div className="room" key={room.name}><i /><div><b>{room.name}</b><span>{room.detail}</span></div></div>)}</div>
      <p className="small center" style={{ marginTop: 14, marginBottom: 14 }}>{c.url}<b>{c.slug}</b>{c.roomNote}</p>
    </div><SlideChip number={2} total={5} label={c.label} />
  </section>
}

function Grounded() {
  const c = copy.grounded
  return <section className="slide slide--night" id="grounded" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", left: "-12vw", top: "10vh", opacity: .35 }} /><div className="grain" />
    <div className="slide__inner"><div className="cols cols--rev"><div data-reveal><div className="steps" style={{ gridTemplateColumns: "1fr", marginTop: 0 }}>{c.tiers.map((tier, i) => <div className="step" key={tier.name}><span className="n" style={i === 1 ? { color: "var(--coral-d)" } : undefined}>{tier.name}</span><b>{tier.title}</b><p>{tier.body}</p></div>)}</div></div>
      <div><span className="eyebrow" data-reveal>{c.eyebrow}</span><h2 className="h2 balance" data-reveal style={reveal(1)}>{c.title}</h2><p className="lede" data-reveal style={reveal(2)}>{c.lede}</p><div className="checks" data-reveal style={reveal(3)}>{c.checks.map((item) => <span key={item}>{item}</span>)}</div></div>
    </div></div><SlideChip number={3} total={5} label={c.label} />
  </section>
}

type Segment = { flex: number; kind?: "lo" | "close"; opacity?: number }
const timelines: Segment[][] = [
  [{ flex: 1 }, { flex: 1.3 }, { flex: .8 }, { flex: 1.6 }, { flex: 1 }, { flex: 1.2 }, { flex: .9 }, { flex: 1.1 }, { flex: 1.4 }, { flex: .7 }, { flex: 1 }, { flex: .9, kind: "close" }],
  [{ flex: 1 }, { flex: .6, kind: "lo" }, { flex: .8 }, { flex: 1.6 }, { flex: .4, kind: "lo" }, { flex: 1.2 }, { flex: .4, kind: "lo" }, { flex: .5, kind: "lo" }, { flex: 1.4 }, { flex: .3, kind: "lo" }, { flex: .4, kind: "lo" }, { flex: .9, kind: "close" }],
  [{ flex: 1 }, { flex: .5, kind: "close", opacity: .5 }, { flex: .6, kind: "lo" }, { flex: 1.6 }, { flex: .6, kind: "close", opacity: .5 }, { flex: 1.2 }, { flex: .4, kind: "close", opacity: .5 }, { flex: 1.4 }, { flex: .5, kind: "close", opacity: .5 }, { flex: .3, kind: "lo" }, { flex: .9, kind: "close" }],
]

function Time() {
  const c = copy.time
  return <section className="slide slide--paper" id="time" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="grain" /><div className="slide__inner"><div className="center"><span className="eyebrow" data-reveal>{c.eyebrow}</span><h2 className="h2 balance" data-reveal style={reveal(1)}>{c.title}</h2><p className="lede balance" data-reveal style={reveal(2)}>{c.lede}</p></div>
      <div className="tl" data-reveal style={reveal(3)}>{c.rows.map((row, i) => <div className="tl__row" key={row.label}><span className="tl__k">{row.label}</span><div className="tl__bar">{timelines[i].map((segment, j) => <i key={j} className={segment.kind} style={{ flex: segment.flex, opacity: segment.opacity }} />)}</div><span className="tl__t">{row.duration}</span></div>)}</div>
      <div className="checks" style={{ justifyContent: "center", ...reveal(4) }} data-reveal>{c.checks.map((item) => <span key={item}>{item}</span>)}</div>
    </div><SlideChip number={4} total={5} label={c.label} />
  </section>
}

function Close() {
  const c = copy.close
  return <section className="slide slide--night" id="close" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="glow glow--coral" style={{ width: "50vw", height: "50vw", left: "25vw", top: "-20vh", opacity: .3 }} /><div className="dots" /><div className="grain" />
    <div className="slide__inner center"><span className="eyebrow eyebrow--you" data-reveal>{c.eyebrow}</span><h2 className="h1 balance" data-reveal style={reveal(1)}>{c.title[0]}<span className="you">{c.title[1]}</span>{c.title[2]}</h2><p className="lede balance" data-reveal style={reveal(2)}>{c.lede}</p>
      <div className="ctas" style={{ justifyContent: "center", ...reveal(3) }} data-reveal><BuildCta className="btn btn--primary" location="v3_close_build">{c.build} <svg className="arrow" aria-hidden="true"><use href="#arrow" /></svg></BuildCta><a className="btn btn--ghost" href="/pricing">{c.pricing}</a></div>
    </div><FooterV3 /><SlideChip number={5} total={5} label={c.label} />
  </section>
}

export default function PresentPage() { return <main><Hero /><Four /><Grounded /><Time /><Close /></main> }
