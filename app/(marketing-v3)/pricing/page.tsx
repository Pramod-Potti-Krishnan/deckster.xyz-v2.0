import type { CSSProperties } from "react"
import { V3_CONTENT } from "@/lib/marketing/v3-content"
import type { Metadata } from "next"
import { FooterV3 } from "@/components/marketing/v3/FooterV3"
import { SlideChip } from "@/components/marketing/v3/SlideChip"
import { TrackedLink } from "@/components/marketing/v3/BuildCta"
import { PRICING_TIERS } from "@/lib/marketing/homepage-v2-pricing"

const copy = V3_CONTENT.pages.pricing

export const metadata: Metadata = {
  title: { absolute: copy.metadata.title },
  alternates: { canonical: "/pricing" },
}

const tierEvent = {
  starter: "v3_pricing_starter",
  pro: "v3_pricing_pro",
  premium: "v3_pricing_max",
} as const

export default function PricingV3Page() {
  return (
    <main>
      <section className="slide slide--paper" id="start" data-snap="slide" data-slide-label={copy.start.label} data-label={copy.start.label}>
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal>{copy.start.eyebrow}</span>
            <h1 className="h1 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.start.title}<span className="you">{copy.start.titleAccent}</span></h1>
            <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.start.lede}</p>
          </div>
          <div className="tiers" data-reveal style={{ "--d": 3 } as CSSProperties}>
            {copy.start.tiers.map((tier) => {
              const existing = PRICING_TIERS.find((item) => item.id === tier.id)!
              return (
                <div key={tier.id} className={`tier${tier.id === "pro" ? " tier--hi" : ""}`}>
                  {"tag" in tier && <span className="pill pill--agent tier__tag">{tier.tag}</span>}
                  <div className="tier__name">{tier.name}</div>
                  <div className="tier__price"><b>{tier.price}</b><span>{tier.suffix}</span></div>
                  <p className="tier__blurb">{tier.blurb}</p>
                  <ul>{tier.features.map((feature, index) => <li key={feature} className={index === 0 && tier.id !== "starter" ? "plus" : undefined}>{feature}</li>)}</ul>
                  <p className="tier__note">{tier.note}</p>
                  <TrackedLink className={`btn btn--${tier.id === "pro" ? "primary" : "ghost"}`} href={existing.ctaHref} location={tierEvent[tier.id]}>{tier.action}</TrackedLink>
                </div>
              )
            })}
          </div>
        </div>
        <a className="cue" href="#matrix" data-next>{copy.start.cue}<i /></a>
        <SlideChip number={1} total={4} label={copy.start.label} />
      </section>

      <section className="slide slide--paper" id="matrix" data-snap="slide" data-slide-label={copy.matrix.label} data-label={copy.matrix.label}>
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal>{copy.matrix.eyebrow}</span>
            <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.matrix.title}</h2>
          </div>
          <table className="matrix" data-reveal style={{ "--d": 2 } as CSSProperties}>
            <thead><tr>{copy.matrix.headings.map((heading, index) => <th key={heading} style={index === 0 ? { width: "44%" } : undefined}>{heading}</th>)}</tr></thead>
            <tbody>
              {copy.matrix.rows.map((row) => <tr key={row.name}>
                <td><b>{row.name}</b>{row.detail}{"tag" in row && <span className="pill pill--build" style={{ marginLeft: 6 }}>{row.tag}</span>}</td>
                {row.values.map((value, index) => <td key={index} className={value === true ? "c" : "m"}>{value === true ? "✓" : value === false ? "—" : "·"}</td>)}
              </tr>)}
            </tbody>
          </table>
        </div>
        <SlideChip number={2} total={4} label={copy.matrix.label} />
      </section>

      <section className="slide slide--paper" id="faq" data-snap="slide" data-slide-label={copy.faq.label} data-label={copy.faq.label}>
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal>{copy.faq.eyebrow}</span>
            <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.faq.title}</h2>
            <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.faq.lede}</p>
          </div>
          <div className="faq" data-reveal style={{ "--d": 3 } as CSSProperties}>
            {copy.faq.questions.map((item) => <div key={item.question}><b>{item.question}</b><p>{item.answer}</p></div>)}
          </div>
        </div>
        <SlideChip number={3} total={4} label={copy.faq.label} />
      </section>

      <section className="slide slide--night" id="close" data-snap="slide" data-slide-label={copy.close.label} data-label={copy.close.label}>
        <div className="glow glow--violet" style={{ width: "60vw", height: "60vw", left: "20vw", top: "-20vh", opacity: .4 }} />
        <div className="dots" /><div className="grain" />
        <div className="slide__inner center">
          <span className="eyebrow eyebrow--you" data-reveal>{copy.close.eyebrow}</span>
          <h2 className="h1 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.close.title}<span className="you">{copy.close.titleAccent}</span></h2>
          <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.close.lede}</p>
          <div className="ctas" style={{ justifyContent: "center", "--d": 3 } as CSSProperties} data-reveal>
            <TrackedLink className="btn btn--primary" href={PRICING_TIERS[0].ctaHref} location="v3_pricing_full_page">{copy.close.build} <svg className="arrow" aria-hidden="true"><use href="#arrow" /></svg></TrackedLink>
            <a className="btn btn--ghost" href="/bring">{copy.close.bring}</a>
          </div>
        </div>
        <FooterV3 />
        <SlideChip number={4} total={4} label={copy.close.label} />
      </section>
    </main>
  )
}
