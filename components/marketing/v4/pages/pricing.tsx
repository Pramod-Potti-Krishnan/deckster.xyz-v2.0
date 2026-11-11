/* eslint-disable @next/next/no-img-element */
// Marketing v4 (Pricing), rendered only with NEXT_PUBLIC_MARKETING_V4=true.
// Converted from the approved mock (Deckster/design-marketing-v4/pricing.html, tools/port_to_next.py); maintained by hand from here.
// Status pills are plain markup: the wording rules are in components/marketing/v4/content.ts.
import type { CSSProperties } from "react"
import Link from "next/link"
import { BuildCta } from "@/components/marketing/v3-uat/BuildCta"

export function V4PricingPage() {
  return (
    <main data-page="pricing">
      <section className="slide slide--paper is-in" id="start" data-snap="slide" data-slide-label="Pricing" data-label="Pricing">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"Pricing · early access"}
            </span>
            <h1 className="h1 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Priced for how you "}
              <span className="you">
                {"present."}
              </span>
            </h1>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"Deckster is in early access: sign in with Google and enter your access code, or ask for one. Plans differ by how many credits you get to build with each month."}
            </p>
          </div>
          <div className="tiers" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
            <div className="tier">
              <div className="tier__name">
                {"Starter"}
              </div>
              <div className="tier__price">
                <b>
                  {"$20"}
                </b>
                <span>
                  {"/ month"}
                </span>
              </div>
              <p className="tier__blurb">
                {"For a deck every week or two."}
              </p>
              <ul>
                <li>
                  {"The whole studio: research, your files, charts, diagrams, infographics"}
                </li>
                <li>
                  {"Edit any text, chart or diagram yourself"}
                </li>
                <li>
                  {"PowerPoint & PDF export, no watermark"}
                </li>
                <li>
                  {"Publish with a link or passcode"}
                </li>
                <li>
                  {"2,000 credits each month"}
                </li>
              </ul>
              <p className="tier__note">
                {"Launch pricing · during early access, plans come with your access code."}
              </p>
              <BuildCta className="btn btn--ghost" location="v3_pricing_starter">
                {"Request access"}
              </BuildCta>
            </div>
            <div className="tier tier--hi">
              <span className="pill pill--agent tier__tag">
                {"Most popular"}
              </span>
              <div className="tier__name">
                {"Pro"}
              </div>
              <div className="tier__price">
                <b>
                  {"$50"}
                </b>
                <span>
                  {"/ month"}
                </span>
              </div>
              <p className="tier__blurb">
                {"For people who present every week."}
              </p>
              <ul>
                <li className="plus">
                  {"Everything in Starter, plus:"}
                </li>
                <li>
                  {"5,000 credits each month"}
                </li>
                <li>
                  {"Room for research-heavy decks"}
                </li>
                <li>
                  {"Agent mode "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </li>
              </ul>
              <p className="tier__note">
                {"Launch pricing · during early access, plans come with your access code."}
              </p>
              <BuildCta className="btn btn--primary" location="v3_pricing_pro">
                {"Request access"}
              </BuildCta>
            </div>
            <div className="tier">
              <div className="tier__name">
                {"Max"}
              </div>
              <div className="tier__price">
                <b>
                  {"$100"}
                </b>
                <span>
                  {"/ month"}
                </span>
              </div>
              <p className="tier__blurb">
                {"For people who present as their core work."}
              </p>
              <ul>
                <li className="plus">
                  {"Everything in Pro, plus:"}
                </li>
                <li>
                  {"10,000 credits each month"}
                </li>
                <li>
                  {"Knowledge graph across your decks "}
                  <span className="st st--beta st--sm">
                    {"Beta"}
                  </span>
                </li>
                <li>
                  {"Author mode "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </li>
                <li>
                  {"Your own avatar, one included "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </li>
              </ul>
              <p className="tier__note">
                {"Launch pricing · during early access, plans come with your access code."}
              </p>
              <BuildCta className="btn btn--ghost" location="v3_pricing_max">
                {"Request access"}
              </BuildCta>
            </div>
          </div>
        </div>
        <a className="cue" href="#matrix" data-next="true">
          {"Compare the plans"}
          <i />
        </a>
        <div className="slide__chip">
          <b>
            {"01"}
          </b>
          <span>
            {"/ 04"}
          </span>
          <i />
          {"Pricing"}
        </div>
      </section>
      <section className="slide slide--paper" id="matrix" data-snap="slide" data-slide-label="Compare" data-label="Compare">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"Plan by plan"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"What each plan includes."}
            </h2>
          </div>
          <table className="matrix" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
            <thead>
              <tr>
                <th style={{ width: "44%" } as CSSProperties}>
                  {"Capability"}
                </th>
                <th>
                  {"Starter"}
                </th>
                <th>
                  {"Pro"}
                </th>
                <th>
                  {"Max"}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <b>
                    {"Build"}
                  </b>
                  {" — plan, outline and slides with your agent; every element type"}
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <b>
                    {"Edit by chat"}
                  </b>
                  {" "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <b>
                    {"Research"}
                  </b>
                  {" — web search, cited on the slide"}
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <b>
                    {"Your files"}
                  </b>
                  {" — PDFs, Word, spreadsheets and decks as sources"}
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <b>
                    {"Themes"}
                  </b>
                  {" — presets, your brand colour, a saved standard theme"}
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <b>
                    {"Export and publish"}
                  </b>
                  {" — PowerPoint & PDF, no watermark; link or passcode"}
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <b>
                    {"Credits each month"}
                  </b>
                  {" — top up any time"}
                </td>
                <td className="c">
                  {"2,000"}
                </td>
                <td className="c">
                  {"5,000"}
                </td>
                <td className="c">
                  {"10,000"}
                </td>
              </tr>
              <tr>
                <td>
                  <b>
                    {"Knowledge graph"}
                  </b>
                  {" "}
                  <span className="st st--beta st--sm">
                    {"Beta"}
                  </span>
                </td>
                <td className="m">
                  <span aria-hidden="true">
                    {"—"}
                  </span>
                  <span className="sr">
                    {"Not included"}
                  </span>
                </td>
                <td className="m">
                  <span aria-hidden="true">
                    {"—"}
                  </span>
                  <span className="sr">
                    {"Not included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <b>
                    {"Questions & narration"}
                  </b>
                  {" on published decks "}
                  <span className="st st--live st--sm">
                    {"Live"}
                  </span>
                </td>
                <td colSpan={3} className="m" style={{ fontSize: "12px" } as CSSProperties}>
                  {"Uses your monthly credits; included on every plan"}
                </td>
              </tr>
              <tr>
                <td>
                  <b>
                    {"Source badges and change history"}
                  </b>
                  {" "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <b>
                    {"Brand kit"}
                  </b>
                  {" "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <b>
                    {"Agent mode"}
                  </b>
                  {" "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </td>
                <td className="m">
                  <span aria-hidden="true">
                    {"—"}
                  </span>
                  <span className="sr">
                    {"Not included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <b>
                    {"Author mode"}
                  </b>
                  {" "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </td>
                <td className="m">
                  <span aria-hidden="true">
                    {"—"}
                  </span>
                  <span className="sr">
                    {"Not included"}
                  </span>
                </td>
                <td className="m">
                  <span aria-hidden="true">
                    {"—"}
                  </span>
                  <span className="sr">
                    {"Not included"}
                  </span>
                </td>
                <td className="c">
                  <span aria-hidden="true">
                    {"✓"}
                  </span>
                  <span className="sr">
                    {"Included"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <b>
                    {"Your own avatar"}
                  </b>
                  {" "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </td>
                <td className="m">
                  <span aria-hidden="true">
                    {"—"}
                  </span>
                  <span className="sr">
                    {"Not included"}
                  </span>
                </td>
                <td className="m">
                  <span aria-hidden="true">
                    {"—"}
                  </span>
                  <span className="sr">
                    {"Not included"}
                  </span>
                </td>
                <td className="c">
                  {"1 included"}
                </td>
              </tr>
              <tr>
                <td>
                  <b>
                    {"Call or video-call your agent"}
                  </b>
                  {" "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </td>
                <td colSpan={3} className="m">
                  {"To be announced"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="slide__chip">
          <b>
            {"02"}
          </b>
          <span>
            {"/ 04"}
          </span>
          <i />
          {"Compare"}
        </div>
      </section>
      <section className="slide slide--paper" id="faq" data-snap="slide" data-slide-label="Questions" data-label="Questions">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"Top-ups & questions"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Need more in a busy month?"}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"Top up $10, $25 or $50 on any plan. Top-ups never expire. A long, research-heavy deck uses more than a short update."}
            </p>
          </div>
          <div className="faq" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
            <div>
              <b>
                {"How do I get in?"}
              </b>
              <p>
                {"Sign in with Google. With an access code you can start right away; without one, you join the early-access queue."}
              </p>
            </div>
            <div>
              <b>
                {"What is a credit?"}
              </b>
              <p>
                {"One credit is one cent of building. Planning, writing, slide building, narration and audience answers all draw on your credits. Plan credits reset each month; top-up credits never expire and are used after them."}
              </p>
            </div>
            <div>
              <b>
                {"Where do my files go?"}
              </b>
              <p>
                {"They are stored in your account and read by the AI models that build your deck (Google and OpenRouter-hosted models). They are never shown to your audience by name. You can delete your knowledge graph with one button; deleting a file removes it from your list."}
              </p>
            </div>
            <div>
              <b>
                {"Is there a watermark?"}
              </b>
              <p>
                {"No. PowerPoint and PDF exports are clean on every plan. In PowerPoint, text and tables stay editable; charts and diagrams arrive as images."}
              </p>
            </div>
            <div>
              <b>
                {"What will agent mode cost?"}
              </b>
              <p>
                {"More than a standard build, because a stronger model does more of the work. You will see an estimate and a cap before it starts, and it stops at the cap. "}
                <span className="st st--build st--sm">
                  {"Coming"}
                </span>
              </p>
            </div>
            <div>
              <b>
                {"What's in beta, and what's coming?"}
              </b>
              <p>
                {"Beta: the knowledge graph and templates from your own decks. Coming: editing by chat, calling your agent, your own avatar, agent mode, author mode, a look chosen for your topic, brand kits and source badges. Beta features may change."}
              </p>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"03"}
          </b>
          <span>
            {"/ 04"}
          </span>
          <i />
          {"Questions"}
        </div>
      </section>
      <section className="slide slide--night" id="close" data-snap="slide" data-slide-label="Begin" data-label="Begin">
        <div className="glow glow--violet" style={{ width: "60vw", height: "60vw", left: "20vw", top: "-20vh", opacity: "0.4" } as CSSProperties} />
        <div className="dots" />
        <div className="grain" />
        <div className="slide__inner center">
          <span className="eyebrow eyebrow--you" data-reveal="true">
            {"Begin"}
          </span>
          <h2 className="h1 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
            {"Start with what you "}
            <span className="you">
              {"have."}
            </span>
          </h2>
          <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
            {"A report you already wrote is a fine first brief. So is a single sentence."}
          </p>
          <div className="ctas" style={{ justifyContent: "center", "--d": "3" } as CSSProperties} data-reveal="true">
            <BuildCta className="btn btn--primary" location="v3_close_build">
              {"Request access "}
              <svg className="arrow" aria-hidden="true">
                <use href="#arrow" />
              </svg>
            </BuildCta>
            <Link href="/bring" className="btn btn--ghost">
              {"Bring your material"}
            </Link>
          </div>
        </div>
        <footer className="ftr">
          <div className="ftr__in">
            <span>
              {"© 2026 deckster · Your knowledge. Your decks. Your voice."}
            </span>
            <nav aria-label="Footer navigation">
              <Link href="/build">
                {"Build"}
              </Link>
              <Link href="/bring">
                {"Bring"}
              </Link>
              <Link href="/present">
                {"Present"}
              </Link>
              <Link href="/experts">
                {"Experts"}
              </Link>
              <Link href="/pricing">
                {"Pricing"}
              </Link>
              <Link href="/learn">
                {"Learn"}
              </Link>
              <Link href="/about">
                {"About"}
              </Link>
              <Link href="/help">
                {"Help"}
              </Link>
              <Link href="/docs">
                {"Docs"}
              </Link>
              <Link href="/legal/privacy">
                {"Privacy"}
              </Link>
              <Link href="/legal/terms">
                {"Terms"}
              </Link>
              <Link href="/legal/security">
                {"Security"}
              </Link>
              <Link href="/legal/cookies">
                {"Cookies"}
              </Link>
            </nav>
          </div>
        </footer>
        <div className="slide__chip">
          <b>
            {"04"}
          </b>
          <span>
            {"/ 04"}
          </span>
          <i />
          {"Begin"}
        </div>
      </section>
    </main>
  )
}
