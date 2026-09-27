import type { Metadata } from "next"
import type { CSSProperties } from "react"
import { BuildCta } from "@/components/marketing/v3/BuildCta"
import { ExpertsLoop } from "@/components/marketing/v3/ExpertsLoop"
import { FooterV3 } from "@/components/marketing/v3/FooterV3"
import { SlideChip } from "@/components/marketing/v3/SlideChip"
import { V3_CONTENT } from "@/lib/marketing/v3-content"

const copy = V3_CONTENT.pages.experts
export const metadata: Metadata = { title: { absolute: copy.title }, alternates: { canonical: "/experts" } }
const reveal = (delay: number) => ({ "--d": delay } as CSSProperties)

function Hero() {
  const c = copy.hero
  return <section className="slide slide--night" id="start" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="glow glow--violet" style={{ width: "60vw", height: "60vw", left: "-22vw", top: "-30vw" }} />
    <div className="glow glow--coral" style={{ width: "40vw", height: "40vw", right: "-14vw", bottom: "-18vw", opacity: .3 }} />
    <div className="dots" /><div className="grain" />
    <div className="slide__inner"><div className="cols cols--tight">
      <div><span className="eyebrow eyebrow--you" data-reveal>{c.eyebrow}</span><h1 className="h1" data-reveal style={reveal(1)}>{c.title[0]}<span className="you">{c.title[1]}</span></h1><p className="lede" data-reveal style={reveal(2)}>{c.lede}</p>
        <div className="ctas" data-reveal style={reveal(3)}><BuildCta className="btn btn--primary" location="v3_hero_build">{c.build} <svg className="arrow" aria-hidden="true"><use href="#arrow" /></svg></BuildCta><a className="btn btn--ghost" href="#loop" data-next>{c.see}</a></div>
        <div className="trust" data-reveal style={reveal(4)}>{c.trust.map((item) => <span key={item}>{item}</span>)}</div>
      </div>
      <ExpertsLoop copy={V3_CONTENT.experts.loop} />
    </div></div>
    <a className="cue" href="#loop" data-next>{c.cue}<i /></a><SlideChip number={1} total={5} label={c.label} />
  </section>
}

function Loop() {
  const c = copy.loop
  return <section className="slide slide--paper" id="loop" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="grain" /><div className="slide__inner"><div className="center"><span className="eyebrow eyebrow--you" data-reveal>{c.eyebrow}</span><h2 className="h2 balance" data-reveal style={reveal(1)}>{c.title}</h2><p className="lede balance" data-reveal style={reveal(2)}>{c.lede}</p></div>
      <div className="steps" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>{c.gates.map((gate, i) => <div className="step" key={gate.number} data-reveal style={reveal(i + 3)}><span className="n">{gate.number}</span><b>{gate.title}</b><p>{gate.body}</p><span className="you">{gate.quote}</span></div>)}</div>
      <div className="gates" style={{ justifyContent: "center", marginTop: 28, ...reveal(6) }} data-reveal>{c.actions.map((action) => <div className="gate" key={action.name}><i>{action.icon}</i><b>{action.name}</b>{action.detail}</div>)}</div>
    </div><SlideChip number={2} total={5} label={c.label} />
  </section>
}

function GenericPersonIcon() {
  return <span className="av" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="8" r="4" fill="currentColor" /><path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" fill="currentColor" /></svg></span>
}

function Team() {
  const c = copy.team
  return <section className="slide slide--paper" id="team" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="grain" /><div className="slide__inner"><div className="center"><span className="eyebrow" data-reveal>{c.eyebrow}</span><h2 className="h2 balance" data-reveal style={reveal(1)}>{c.title}</h2></div>
      <div className="org" style={{ marginTop: 22, ...reveal(2) }} data-reveal>
        <div className="org__you"><GenericPersonIcon /><div><b>{c.you}</b><br /><span>{c.producer}</span></div></div>
        <div className="org__line" />
        <div className="org__dir"><i className="dot" /><div><b>{c.director}</b> <span>{c.directorRole}</span></div></div>
      </div>
      <div className="grid4" style={{ marginTop: 22 }}>{c.agents.map((agent, i) => <div className="card" key={agent.name} data-reveal style={reveal(i + 3)}><i className="dot" style={{ display: "block", width: 12, height: 12, borderRadius: 3, transform: "rotate(45deg)", background: agent.color }} /><h3 className="h3">{agent.name}</h3><p><b>{agent.bold}</b>{agent.body}{"status" in agent && <> <span className="pill pill--build" style={{ marginTop: 6 }}>{agent.status}</span></>}</p></div>)}</div>
    </div><SlideChip number={3} total={5} label={c.label} />
  </section>
}

function Guardrails() {
  const c = copy.guardrails
  return <section className="slide slide--night" id="never" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="glow glow--coral" style={{ width: "50vw", height: "50vw", right: "-16vw", top: "-10vh", opacity: .25 }} /><div className="grain" />
    <div className="slide__inner"><div className="center"><span className="eyebrow eyebrow--you" data-reveal>{c.eyebrow}</span><h2 className="h2 balance" data-reveal style={reveal(1)}>{c.title}</h2></div><div className="grid4" style={{ marginTop: 34 }}>{c.cards.map((card, i) => <div className="card" key={card.number} data-reveal style={reveal(i + 2)}><span className="big" style={{ color: "var(--coral-d)" }}>{card.number}</span><h3 className="h3">{card.title}</h3><p>{card.body}</p></div>)}</div></div>
    <SlideChip number={4} total={5} label={c.label} />
  </section>
}

function Close() {
  const c = copy.close
  return <section className="slide slide--night" id="close" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="glow glow--violet" style={{ width: "60vw", height: "60vw", left: "20vw", top: "-20vh", opacity: .4 }} /><div className="dots" /><div className="grain" />
    <div className="slide__inner center"><span className="eyebrow eyebrow--you" data-reveal>{c.eyebrow}</span><h2 className="h1 balance" data-reveal style={reveal(1)}>{c.title[0]}<span className="you">{c.title[1]}</span></h2><p className="lede balance" data-reveal style={reveal(2)}>{c.lede}</p>
      <div className="ctas" style={{ justifyContent: "center", ...reveal(3) }} data-reveal><BuildCta className="btn btn--primary" location="v3_close_build">{c.build} <svg className="arrow" aria-hidden="true"><use href="#arrow" /></svg></BuildCta><a className="btn btn--ghost" href="/bring">{c.bring}</a></div>
    </div><FooterV3 /><SlideChip number={5} total={5} label={c.label} />
  </section>
}

export default function ExpertsPage() {
  return <>
    <style>{`@media (max-width:900px){.mv3 #loop .steps{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      @media (max-width:560px){.mv3 #loop .steps{grid-template-columns:1fr!important}}`}</style>
    <main><Hero /><Loop /><Team /><Guardrails /><Close /></main>
  </>
}
