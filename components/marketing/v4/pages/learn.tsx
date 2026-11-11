/* eslint-disable @next/next/no-img-element */
// Marketing v4 (Learn), rendered only with NEXT_PUBLIC_MARKETING_V4=true.
// Converted from the approved mock (Deckster/design-marketing-v4/learn.html, tools/port_to_next.py); maintained by hand from here.
// Status pills are plain markup: the wording rules are in components/marketing/v4/content.ts.
import type { CSSProperties } from "react"
import Link from "next/link"
import { BuildCta } from "@/components/marketing/v3-uat/BuildCta"

export function V4LearnPage() {
  return (
    <main data-page="learn">
      <section className="slide slide--paper is-in" id="start" data-snap="slide" data-slide-label="Learn" data-label="Learn">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"Learn"}
            </span>
            <h1 className="h1 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Learn at your "}
              <span className="you">
                {"altitude."}
              </span>
            </h1>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"Everything in Deckster happens at one of three levels, driven by click today, and soon by chat or by an agent. Pick the one you're working at."}
            </p>
          </div>
          <div className="grid3" style={{ marginTop: "34px" } as CSSProperties}>
            <div className="card" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
              <span className="big" style={{ color: "var(--violet)" } as CSSProperties}>
                {"Deck"}
              </span>
              <h3 className="h3">
                {"Talk to the Director"}
              </h3>
              <p>
                {"Briefs, plans, outlines, research options, themes, export. The whole-deck conversation."}
              </p>
              <span className="you" style={{ display: "block", marginTop: "12px" } as CSSProperties}>
                {"“Build a 16-slide review from my board pack.”"}
              </span>
              <div className="k-row">
                <span className="pill">
                  {"Quick start"}
                </span>
                <span className="pill">
                  {"Your first deck"}
                </span>
                <span className="pill">
                  {"Research options"}
                </span>
              </div>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
              <span className="big" style={{ color: "var(--violet)" } as CSSProperties}>
                {"Slide"}
              </span>
              <h3 className="h3">
                {"Compose one slide"}
              </h3>
              <p>
                {"Add or refine a single slide in any deck, with its neighbours as context. Layout, density, focus."}
              </p>
              <span className="you" style={{ display: "block", marginTop: "12px" } as CSSProperties}>
                {"“Add a slide after 4 comparing latency by team.”"}
              </span>
              <div className="k-row">
                <span className="pill">
                  {"Slide panel"}
                </span>
                <span className="pill">
                  {"Refine in place"}
                </span>
                <span className="pill">
                  {"Layouts"}
                </span>
              </div>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "5" } as CSSProperties}>
              <span className="big" style={{ color: "var(--violet)" } as CSSProperties}>
                {"Element"}
              </span>
              <h3 className="h3">
                {"Refine one piece"}
              </h3>
              <p>
                {"Charts, tables, metrics, diagrams, infographics, text — change one without touching the rest."}
              </p>
              <span className="you" style={{ display: "block", marginTop: "12px" } as CSSProperties}>
                {"“Make this chart a waterfall.”"}
              </span>
              <div className="k-row">
                <span className="pill">
                  {"Refine element"}
                </span>
                <span className="pill">
                  {"Chart types"}
                </span>
                <span className="pill">
                  {"Editing on canvas"}
                </span>
              </div>
            </div>
          </div>
          <p className="note4" data-reveal="true" style={{ "--d": "6", textAlign: "center" } as CSSProperties}>
            <b>
              {"Three ways to drive"}
            </b>
            {" click it, say it, or hand it over. "}
            <Link href="/build" style={{ color: "var(--accent)", fontWeight: "600" } as CSSProperties}>
              {"See Build →"}
            </Link>
          </p>
        </div>
        <a className="cue" href="#first" data-next="true">
          {"Your first deck"}
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
          {"Learn"}
        </div>
      </section>
      <section className="slide slide--paper" id="first" data-snap="slide" data-slide-label="First deck" data-label="First deck">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow eyebrow--you" data-reveal="true">
              {"Your first deck"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Five steps, one evening back."}
            </h2>
          </div>
          <div className="steps learn_fiveSteps__CQEd6">
            <div className="step" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              <span className="n">
                {"01 · BRING"}
              </span>
              <b>
                {"Attach what you have"}
              </b>
              <p>
                {"A report, a spreadsheet, last quarter's deck. Optional — but it makes everything after more yours."}
              </p>
            </div>
            <div className="step" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
              <span className="n">
                {"02 · BRIEF"}
              </span>
              <b>
                {"Tell the Director"}
              </b>
              <p>
                {"One sentence or a full brief. Choose web search, deep research or your knowledge graph."}
              </p>
            </div>
            <div className="step" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
              <span className="n">
                {"03 · APPROVE"}
              </span>
              <b>
                {"Say yes to the plan"}
              </b>
              <p>
                {"Sections and slide count, then the outline. Change anything in plain English."}
              </p>
            </div>
            <div className="step" data-reveal="true" style={{ "--d": "5" } as CSSProperties}>
              <span className="n">
                {"04 · REFINE"}
              </span>
              <b>
                {"Edit at any altitude"}
              </b>
              <p>
                {"Edit text on the canvas, or just ask: “make this chart a waterfall”. The rest stays intact."}
              </p>
            </div>
            <div className="step" data-reveal="true" style={{ "--d": "6" } as CSSProperties}>
              <span className="n">
                {"05 · SHIP"}
              </span>
              <b>
                {"Export or publish"}
              </b>
              <p>
                {"PowerPoint, PDF — or a link with a passcode and the downloads you allow."}
              </p>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"02"}
          </b>
          <span>
            {"/ 04"}
          </span>
          <i />
          {"First deck"}
        </div>
      </section>
      <section className="slide slide--night" id="guides" data-snap="slide" data-slide-label="Guides" data-label="Guides">
        <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", left: "-12vw", top: "10vh", opacity: "0.35" } as CSSProperties} />
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"Guides & help"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Stuck? Get unblocked."}
            </h2>
          </div>
          <div className="grid3" style={{ marginTop: "30px" } as CSSProperties}>
            <Link href="/docs/getting-started/quick-start-guide" className="card" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              <span className="pill">
                {"Getting started"}
              </span>
              <h3 className="h3">
                {"Quick start · Your first presentation"}
              </h3>
              <p>
                {"The two reads for a first session."}
              </p>
            </Link>
            <Link href="/docs/builder-guide/chat-interface" className="card" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
              <span className="pill">
                {"Builder guide"}
              </span>
              <h3 className="h3">
                {"Chat · Editing slides · Exports"}
              </h3>
              <p>
                {"Every panel in the builder."}
              </p>
            </Link>
            <Link href="/help" className="card" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
              <span className="pill">
                {"Help"}
              </span>
              <h3 className="h3">
                {"Help centre & FAQ"}
              </h3>
              <p>
                {"Answers, plus support@deckster.xyz."}
              </p>
            </Link>
            <div className="card is-soon" data-reveal="true" style={{ "--d": "5" } as CSSProperties}>
              <span className="pill">
                {"Guide coming"}
              </span>
              <h3 className="h3">
                {"Templates · Knowledge graph"}
              </h3>
              <p>
                {"For the beta features."}
              </p>
            </div>
            <div className="card is-soon" data-reveal="true" style={{ "--d": "6" } as CSSProperties}>
              <span className="pill">
                {"Guide coming"}
              </span>
              <h3 className="h3">
                {"Publishing · Questions · Narration"}
              </h3>
              <p>
                {"What a published deck can and can't say."}
              </p>
            </div>
            <div className="card is-soon" data-reveal="true" style={{ "--d": "7" } as CSSProperties}>
              <span className="pill">
                {"Guide coming"}
              </span>
              <h3 className="h3">
                {"Calling your agent · Your avatar · Agent mode"}
              </h3>
              <p>
                {"For what's coming next."}
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
          {"Guides"}
        </div>
      </section>
      <section className="slide slide--night" id="close" data-snap="slide" data-slide-label="Begin" data-label="Begin">
        <div className="glow glow--coral" style={{ width: "50vw", height: "50vw", left: "25vw", top: "-20vh", opacity: "0.3" } as CSSProperties} />
        <div className="dots" />
        <div className="grain" />
        <div className="slide__inner center">
          <span className="eyebrow eyebrow--you" data-reveal="true">
            {"Begin"}
          </span>
          <h2 className="h1 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
            {"Ship your first deck "}
            <span className="you">
              {"today."}
            </span>
          </h2>
          <div className="ctas" style={{ justifyContent: "center", "--d": "2" } as CSSProperties} data-reveal="true">
            <BuildCta className="btn btn--primary" location="v3_close_build">
              {"Request early access "}
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
