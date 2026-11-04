// FRONTEND-1 (W5 P4-17): the Studio Pricing page v2.2, drawn only with NEXT_PUBLIC_STUDIO_PRICING_V22 exactly "true" (app/(marketing-v3)/pricing/page.tsx). Server component: no state, no fetch, no Stripe.
// Words and numbers from lib/studio-pricing-v22.ts; the existing marketing classes (tier, matrix, faq), no new colour tokens.
import { FooterV3 } from "@/components/marketing/v3/FooterV3"
import Link from "next/link"
import { PRICING_V22_COPY as copy, PRICING_V22_MATRIX, PRICING_V22_TIERS } from "@/lib/studio-pricing-v22"

export function PricingV22Page() {
  return (
    <main data-pricing-version="v2.2">
      <section className="slide slide--paper" id="start" data-label="Plans">
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow">{copy.eyebrow}</span>
            <h1 className="h1 balance">{copy.title}</h1>
            <p className="lede balance">{copy.lede}</p>
          </div>
          <div className="tiers">
            {PRICING_V22_TIERS.map((tier) => (
              <div key={tier.id} className={`tier${tier.highlighted ? " tier--hi" : ""}`} data-tier={tier.id}>
                <div className="tier__name">{tier.name}</div>
                <div className="tier__price"><b>{tier.price}</b><span>{tier.suffix}</span></div>
                <p className="tier__blurb"><b>{tier.credits}</b><br />{tier.decks}</p>
                <p className="tier__blurb">{tier.blurb}</p>
                <ul>{tier.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                <Link className={`btn btn--${tier.highlighted ? "primary" : "ghost"}`} href={tier.ctaHref}>{tier.ctaLabel}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="slide slide--paper" id="matrix" data-label="Compare">
        <div className="slide__inner">
          <div className="center"><h2 className="h2 balance">{copy.matrixTitle}</h2></div>
          <div style={{ overflowX: "auto", maxWidth: "100%" }}>
            <table className="matrix">
              <thead><tr>{copy.headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
              <tbody>
                {PRICING_V22_MATRIX.map((row) => <tr key={row.name}><td><b>{row.name}</b></td>{row.values.map((value, index) => <td key={index}>{value}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="slide slide--paper" id="credits" data-label="Credits">
        <div className="slide__inner">
          <div className="center"><h2 className="h2 balance">{copy.creditsTitle}</h2></div>
          <div className="faq">
            {copy.credits.map((line) => <div key={line}><p>{line}</p></div>)}
          </div>
          <div className="center"><h2 className="h2 balance">{copy.topUpsTitle}</h2></div>
          <div className="faq">
            {copy.topUps.map((pack) => <div key={pack.price}><b>{pack.price}</b><p>{pack.credits}</p></div>)}
          </div>
        </div>
        <FooterV3 />
      </section>
    </main>
  )
}
