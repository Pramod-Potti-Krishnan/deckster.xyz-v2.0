/* eslint-disable @next/next/no-img-element */
// Marketing v4 (About), rendered only with NEXT_PUBLIC_MARKETING_V4=true.
// Converted from the approved mock (Deckster/design-marketing-v4/about.html, tools/port_to_next.py); maintained by hand from here.
// Status pills are plain markup: the wording rules are in components/marketing/v4/content.ts.
import type { CSSProperties } from "react"
import Link from "next/link"
import { BuildCta } from "@/components/marketing/v3-uat/BuildCta"

export function V4AboutPage() {
  return (
    <main data-page="about">
      <section className="slide slide--night is-in" id="start" data-snap="slide" data-slide-label="About" data-label="About">
        <div className="glow glow--coral" style={{ width: "56vw", height: "56vw", left: "-20vw", top: "-24vw", opacity: "0.3" } as CSSProperties} />
        <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", right: "-18vw", bottom: "-20vw", opacity: "0.4" } as CSSProperties} />
        <div className="dots" />
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols">
            <div>
              <span className="eyebrow eyebrow--you" data-reveal="true">
                {"Our story"}
              </span>
              <h1 className="h1" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"We're keeping the human in the "}
                <span className="you">
                  {"loop."}
                </span>
              </h1>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"Deckster started from a simple conviction: a deck should come from a conversation, not a blank slide and a lost evening. It grew into a second one — that the best decks come from a team that shows its work and asks before it commits. Next: a team you can simply talk to, and that checks its own work."}
              </p>
              <div className="trust" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
                <span>
                  {"Your yes before anything is built"}
                </span>
                <span>
                  {"A public list of what works today"}
                </span>
              </div>
            </div>
            <div className="stack" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              <div className="stack__card">
                <img src="/marketing/v3-uat/slides/deck-09.jpg" alt="Slide 16 of the showcase deck: Next Wave Lowers Later Costs" width="1280" height="720" />
              </div>
              <div className="stack__card">
                <img src="/marketing/v3-uat/slides/deck-01.jpg" alt="Slide 1 of the showcase deck: A new operating model moves" width="1280" height="720" />
              </div>
              <div className="stack__card">
                <img src="/marketing/v3-uat/slides/deck-04.jpg" alt="Slide 11 of the showcase deck: Strengthening the Six Capabilities of Modern Delivery" width="1280" height="720" />
              </div>
            </div>
          </div>
        </div>
        <a className="cue" href="#principles" data-next="true">
          {"What we believe"}
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
          {"About"}
        </div>
      </section>
      <section className="slide slide--paper" id="principles" data-snap="slide" data-slide-label="Principles" data-label="Principles">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"What we believe"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Three principles, every release."}
            </h2>
          </div>
          <div className="grid3" style={{ marginTop: "34px" } as CSSProperties}>
            <div className="card" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              <span className="big" style={{ color: "var(--coral)" } as CSSProperties}>
                {"01"}
              </span>
              <h3 className="h3">
                {"Your yes, every time"}
              </h3>
              <p>
                {"Automation that asks is not slower — it is trustworthy. The plan and the outline wait for you, and every slide stays yours to edit."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
              <span className="big" style={{ color: "var(--violet)" } as CSSProperties}>
                {"02"}
              </span>
              <h3 className="h3">
                {"Your sources, shown"}
              </h3>
              <p>
                {"Charts say where their numbers came from. Estimates are labelled as estimates. Your files are never named to your audience. Soon every number carries its own badge."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
              <span className="big" style={{ color: "var(--mint)" } as CSSProperties}>
                {"03"}
              </span>
              <h3 className="h3">
                {"Nothing is a black box"}
              </h3>
              <p>
                {"You see each step of the build as it happens, and you can take the wheel on the canvas at any time. Soon every AI change is named in the history and can be restored."}
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
          {"Principles"}
        </div>
      </section>
      <section className="slide slide--paper" id="story" data-snap="slide" data-slide-label="Status" data-label="Status">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"Where Deckster is today"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"What's live, what's in beta, what's coming."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"We'd rather tell you exactly what works. This list changes as features ship."}
            </p>
          </div>
          <div className="ladder4 ladder4--4">
            <div className="col" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
              <span className="st st--live">
                {"Live"}
              </span>
              <ul>
                <li>
                  {"Plan and outline approval before the build"}
                </li>
                <li>
                  {"Edit any text; refine any chart, diagram or infographic"}
                </li>
                <li>
                  {"Research from the web and your files, with sources on charts"}
                </li>
                <li>
                  {"Theme presets, your brand colour, a saved standard theme"}
                </li>
                <li>
                  {"PowerPoint & PDF export, no watermark"}
                </li>
                <li>
                  {"Publish with a link or passcode, downloads you allow"}
                </li>
                <li>
                  {"Audience questions on published decks, with your inbox"}
                </li>
                <li>
                  {"Narration in one of nine stock voices, fitted to your time"}
                </li>
              </ul>
            </div>
            <div className="col" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
              <span className="st st--beta">
                {"Beta"}
              </span>
              <ul>
                <li>
                  {"Knowledge graph across your decks"}
                </li>
                <li>
                  {"Template library from your own PowerPoints"}
                </li>
                <li>
                  {"Watch, pause or stop a build"}
                </li>
              </ul>
            </div>
            <div className="col" data-reveal="true" style={{ "--d": "5" } as CSSProperties}>
              <span className="st st--build">
                {"Coming"}
              </span>
              <ul>
                <li>
                  {"Edit by chat"}
                </li>
                <li>
                  {"Every slide checked and repaired before you see it"}
                </li>
                <li>
                  {"A look chosen to fit your topic"}
                </li>
                <li>
                  {"Call or video-call your agent"}
                </li>
                <li>
                  {"Your own drawn avatar, from a photo"}
                </li>
                <li>
                  {"Agent mode: designs, checks and repairs its own slides"}
                </li>
                <li>
                  {"Author mode: a frontier model writes each slide"}
                </li>
                <li>
                  {"Brand kit from your logo"}
                </li>
                <li>
                  {"A source badge on every number; named AI changes"}
                </li>
                <li>
                  {"Composer picks and mixes your templates"}
                </li>
                <li>
                  {"Outside designs read into editable decks"}
                </li>
                <li>
                  {"Your agent presents with you"}
                </li>
                <li>
                  {"Google Drive as a source"}
                </li>
              </ul>
            </div>
            <div className="col" data-reveal="true" style={{ "--d": "6" } as CSSProperties}>
              <span className="st st--planned">
                {"Later"}
              </span>
              <ul>
                <li>
                  {"Switch a finished deck to a new theme"}
                </li>
                <li>
                  {"Templates from PDFs"}
                </li>
                <li>
                  {"The deck joins Zoom, Meet or Teams"}
                </li>
                <li>
                  {"Team workspaces and shared templates"}
                </li>
              </ul>
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
          {"Status"}
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
            {"Come build "}
            <span className="you">
              {"with"}
            </span>
            {" us."}
          </h2>
          <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
            {"Try it on a deck you need this month. Tell us what the team got wrong — that is how it gets better."}
          </p>
          <div className="ctas" style={{ justifyContent: "center", "--d": "3" } as CSSProperties} data-reveal="true">
            <BuildCta className="btn btn--primary" location="v3_close_build">
              {"Request early access "}
              <svg className="arrow" aria-hidden="true">
                <use href="#arrow" />
              </svg>
            </BuildCta>
            <a className="btn btn--ghost" href="mailto:hello@deckster.xyz">
              {"hello@deckster.xyz"}
            </a>
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
