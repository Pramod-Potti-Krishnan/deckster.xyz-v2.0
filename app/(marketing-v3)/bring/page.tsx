import type { Metadata } from "next"
import type { CSSProperties } from "react"
import { BuildCta } from "@/components/marketing/v3/BuildCta"
import { FooterV3 } from "@/components/marketing/v3/FooterV3"
import { SlideChip } from "@/components/marketing/v3/SlideChip"
import { StatusPill } from "@/components/marketing/v3/StatusPill"
import { v3Metadata } from "@/lib/marketing/v3-metadata"
import Link from "next/link"
import { V3_CONTENT, showcaseAlt } from "@/lib/marketing/v3-content"

const copy = V3_CONTENT.pages.bring
export const metadata: Metadata = v3Metadata({ path: "/bring", title: copy.title, description: copy.description })

const reveal = (delay: number) => ({ "--d": delay } as CSSProperties)
const slideImage = (name: string) => `/marketing/v3/slides/${name}.jpg`
const slotAlt = (name: string) => {
  const slot = /^deck-(\d+)$/.exec(name)
  return slot ? showcaseAlt(Number(slot[1])) : name.replaceAll("-", " ") + " theme slide"
}
const fileColors: Record<string, string> = {
  PPTX: "linear-gradient(160deg,#c2410c,#f97316)",
  PDF: "linear-gradient(160deg,#991b1b,#ef4444)",
  XLSX: "linear-gradient(160deg,#1e3a8a,#3b82f6)",
  DATA: "linear-gradient(160deg,#1e3a8a,#3b82f6)",
  WEB: "linear-gradient(160deg,#134e4a,#14b8a6)",
  LINK: "linear-gradient(160deg,#4c1d95,#8b5cf6)",
  VOICE: "linear-gradient(160deg,#7c2d12,#f4502f)",
}

function Role({ label, style }: { label: string; style: CSSProperties }) {
  return <i className="role" data-r={label} style={style} />
}

const heroRoles: CSSProperties[] = [
  { left: "3%", top: "3%", width: "10%", height: "5%" },
  { left: "3%", top: "8%", width: "62%", height: "8%" },
  { left: "3%", top: "19%", width: "26%", height: "68%" },
  { left: "32%", top: "19%", width: "36%", height: "68%" },
  { left: "71%", top: "19%", width: "26%", height: "68%" },
  { left: "3%", top: "89%", width: "94%", height: "5%" },
]
const templateRoles: CSSProperties[] = [
  { left: "3%", top: "8%", width: "62%", height: "8%" },
  { left: "3%", top: "19%", width: "26%", height: "68%" },
  { left: "32%", top: "19%", width: "36%", height: "68%" },
  { left: "71%", top: "19%", width: "26%", height: "68%" },
  { left: "3%", top: "89%", width: "94%", height: "5%" },
]
const libraryRoles: Record<number, CSSProperties[]> = {
  0: [{ left: "32%", top: "19%", width: "36%", height: "68%" }],
  1: [{ left: "3%", top: "16%", width: "94%", height: "16%" }, { left: "3%", top: "35%", width: "94%", height: "44%" }],
  2: [{ left: "4%", top: "28%", width: "42%", height: "40%" }, { left: "54%", top: "46%", width: "24%", height: "16%" }],
}

function BringHero() {
  const c = copy.hero
  return <section className="slide slide--night is-in" id="start" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="glow glow--coral" style={{ width: "56vw", height: "56vw", left: "-20vw", top: "-24vw", opacity: .32 }} />
    <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", right: "-18vw", bottom: "-20vw", opacity: .4 }} />
    <div className="dots" /><div className="grain" />
    <div className="slide__inner"><div className="cols">
      <div>
        <span className="eyebrow eyebrow--you" data-reveal>{c.eyebrow}</span>
        <h1 className="h1" data-reveal style={reveal(1)}>{c.title[0]}<span className="you">{c.title[1]}</span>{c.title[2]}</h1>
        <p className="lede" data-reveal style={reveal(2)}>{c.lede}</p>
        <div className="ctas" data-reveal style={reveal(3)}>
          <BuildCta className="btn btn--primary" location="v3_hero_build">{c.build} <svg className="arrow" aria-hidden="true"><use href="#arrow" /></svg></BuildCta>
          <a className="btn btn--ghost" href="#how" data-next>{c.see}</a>
        </div>
        <div className="trust" data-reveal style={reveal(4)}>{c.trust.map((item) => <span key={item}>{item}</span>)}</div>
      </div>
      <div data-reveal style={reveal(2)}>
        <div className="abs abs--dim">
          <img src={slideImage("deck-04")} alt={showcaseAlt(4)} width={1280} height={720} />
          {c.roles.map((role, i) => <Role key={i} label={role} style={heroRoles[i]} />)}
          <span className="cap">{c.caption}</span>
        </div>
        <div className="k-row">{c.process.map((step, i) => i === c.process.length - 1
          ? <span key={step} className="pill">{step} <StatusPill feature="templateNewTopic" small /></span>
          : <span key={step} className="pill">{step}</span>)}</div>
      </div>
    </div></div>
    <a className="cue" href="#how" data-next>{c.cue}<i /></a>
    <SlideChip number={1} total={6} label={c.label} />
  </section>
}

function Template() {
  const c = copy.template
  return <section className="slide slide--paper" id="how" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="grain" /><div className="slide__inner">
      <div className="center"><span className="eyebrow" data-reveal>{c.eyebrow} <StatusPill feature={c.feature} /></span><h2 className="h2 balance" data-reveal style={reveal(1)}>{c.title}</h2><p className="lede balance" data-reveal style={reveal(2)}>{c.lede}</p></div>
      <div className="steps">{c.steps.map((step, i) => <div className="step" data-reveal style={reveal(i + 3)} key={step.number}><span className="n">{step.number}</span><b>{step.title}{"feature" in step && <> <StatusPill feature={step.feature} small /></>}</b><p>{step.body}</p>{"quote" in step && <span className="you">{step.quote}</span>}</div>)}</div>
      <div className="arrows" data-reveal style={reveal(7)}>
        <div className="abs"><img src={slideImage("deck-04")} alt={showcaseAlt(4)} width={1280} height={720} /><span className="cap">{c.captions[0]}</span></div>
        <div className="ar">{c.arrows}</div>
        <div className="abs abs--dim"><img src={slideImage("deck-04")} alt={showcaseAlt(4)} width={1280} height={720} />{c.roles.map((role, i) => <Role key={i} label={role} style={templateRoles[i]} />)}<span className="cap">{c.captions[1]}</span></div>
        <div className="ar">{c.arrows}</div>
        <div className="abs"><img src={slideImage("deck-04")} alt={showcaseAlt(4)} width={1280} height={720} loading="lazy" decoding="async" /><span className="cap">{c.captions[2]}</span></div>
      </div>
    </div><SlideChip number={2} total={6} label={c.label} />
  </section>
}

function Library() {
  const c = copy.library
  return <section className="slide slide--paper" id="library" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="grain" /><div className="slide__inner">
      <div className="center"><span className="eyebrow" data-reveal>{c.eyebrow} <StatusPill feature={c.feature} /></span><h2 className="h2 balance" data-reveal style={reveal(1)}>{c.title}</h2><p className="lede balance" data-reveal style={reveal(2)}>{c.lede}</p></div>
      <div className="tgrid" data-reveal style={reveal(4)}>{c.cards.map((card, i) => <div className="tcard" key={card.title}><div className="th"><img src={slideImage(card.slide)} alt={slotAlt(card.slide)} width={1280} height={720} loading="lazy" decoding="async" />{"role" in card && <Role label={card.role} style={libraryRoles[i][0]} />}{"role2" in card && <Role label={card.role2} style={libraryRoles[i][1]} />}</div><div className="meta"><b>{card.title}</b><span>{card.detail}</span></div></div>)}</div>
    </div><SlideChip number={3} total={6} label={c.label} />
  </section>
}

function Knowledge() {
  const c = copy.knowledge
  return <section className="slide slide--night" id="knowledge" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", right: "-10vw", top: 0, opacity: .35 }} /><div className="grain" />
    <div className="slide__inner"><div className="cols">
      <div><span className="eyebrow" data-reveal>{c.eyebrow}</span><h2 className="h2 balance" data-reveal style={reveal(1)}>{c.title}</h2><p className="lede" data-reveal style={reveal(2)}>{c.lede}</p>
        <div className="checks" data-reveal style={reveal(3)}>{c.checks.map((item) => <span key={item}>{item}</span>)}</div>
      </div>
      <div data-reveal style={reveal(2)}>
        <div className="steps" style={{ gridTemplateColumns: "1fr", marginTop: 0 }}>{c.rows.map((row) => <div className="step" key={row.kicker}><span className="n">{row.kicker}</span><b>{row.title}</b><p>{row.body}</p><StatusPill feature={row.feature} /></div>)}</div>
      </div>
    </div></div><SlideChip number={4} total={6} label={c.label} />
  </section>
}

function InOut() {
  const c = copy.inout
  const renderList = (items: typeof c.inputs | typeof c.outputs) => <ul>{items.map((item) => <li key={item.name}><div className="file__ic" style={{ background: fileColors[item.kind] }}>{item.kind}</div>{item.name} <span>{item.detail}</span></li>)}</ul>
  return <section className="slide slide--paper" id="inout" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="grain" /><div className="slide__inner"><div className="center"><span className="eyebrow" data-reveal>{c.eyebrow}</span><h2 className="h2 balance" data-reveal style={reveal(1)}>{c.title}</h2><p className="lede balance" data-reveal style={reveal(2)}>{c.lede}</p></div>
      <div className="io" data-reveal style={reveal(3)}><div><h4>{c.in}</h4>{renderList(c.inputs)}</div><div><h4 style={{ color: "var(--mint)" }}>{c.out}</h4>{renderList(c.outputs)}</div></div>
    </div><SlideChip number={5} total={6} label={c.label} />
  </section>
}

function Close() {
  const c = copy.close
  return <section className="slide slide--night" id="close" data-snap="slide" data-label={c.label} data-slide-label={c.label}>
    <div className="glow glow--violet" style={{ width: "60vw", height: "60vw", left: "20vw", top: "-20vh", opacity: .4 }} /><div className="dots" /><div className="grain" />
    <div className="slide__inner center"><span className="eyebrow eyebrow--you" data-reveal>{c.eyebrow}</span><h2 className="h1 balance" data-reveal style={reveal(1)}>{c.title[0]}<span className="you">{c.title[1]}</span>{c.title[2]}</h2><p className="lede balance" data-reveal style={reveal(2)}>{c.lede}</p>
      <div className="ctas" style={{ justifyContent: "center", ...reveal(3) }} data-reveal><BuildCta className="btn btn--primary" location="v3_close_build">{c.build} <svg className="arrow" aria-hidden="true"><use href="#arrow" /></svg></BuildCta></div>
      <p className="truthline" data-reveal style={reveal(4)}><Link href="/auth/signin">{c.code}</Link></p>
    </div><FooterV3 /><SlideChip number={6} total={6} label={c.label} />
  </section>
}

export default function BringPage() { return <main><BringHero /><Template /><Library /><Knowledge /><InOut /><Close /></main> }
