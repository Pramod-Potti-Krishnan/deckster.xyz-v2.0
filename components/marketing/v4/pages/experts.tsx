/* eslint-disable @next/next/no-img-element */
// Marketing v4 (Experts), rendered only with NEXT_PUBLIC_MARKETING_V4=true.
// Converted from the approved mock (Deckster/design-marketing-v4/experts.html, tools/port_to_next.py); maintained by hand from here.
// Status pills are plain markup: the wording rules are in components/marketing/v4/content.ts.
import type { CSSProperties } from "react"
import Link from "next/link"
import { BuildCta } from "@/components/marketing/v3-uat/BuildCta"
import { ExpertsLoop } from "@/components/marketing/v3-uat/ExpertsLoop"
import { V4_LOOP } from "@/components/marketing/v4/content"
import { statusOf } from "@/components/marketing/v3-uat/StatusPill"
import { V3_CONTENT } from "@/lib/marketing/v3-uat-view"

export function V4ExpertsPage() {
  const c = V3_CONTENT
  return (
    <main data-page="experts">
      <section className="slide slide--night is-in" id="start" data-snap="slide" data-label="Experts" data-slide-label="Experts">
        <div className="glow glow--violet" style={{ width: "60vw", height: "60vw", left: "-22vw", top: "-30vw" } as CSSProperties} />
        <div className="glow glow--coral" style={{ width: "40vw", height: "40vw", right: "-14vw", bottom: "-18vw", opacity: "0.3" } as CSSProperties} />
        <div className="dots" />
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols cols--tight">
            <div>
              <span className="eyebrow eyebrow--you" data-reveal="true">
                {"Experts · human in the loop"}
              </span>
              <h1 className="h1" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"Direct a team of "}
                <span className="you">
                  {"experts."}
                </span>
              </h1>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"The Director plans the deck and hands each step to a specialist. You approve the plan and the outline, watch the build slide by slide, and edit anything yourself. Soon a reviewer will check every finished slide."}
              </p>
              <div className="ctas" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
                <BuildCta className="btn btn--primary" location="v3_hero_build">
                  {"Request early access "}
                  <svg className="arrow" aria-hidden="true">
                    <use href="#arrow" />
                  </svg>
                </BuildCta>
                <a className="btn btn--ghost" href="#loop" data-next="true">
                  {"See the loop"}
                </a>
              </div>
              <div className="trust" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
                <span>
                  {"Plan and outline wait for your yes"}
                </span>
                <span>
                  {"Every finished slide stays editable"}
                </span>
                <span>
                  {"Slide review before you see it (coming)"}
                </span>
              </div>
            </div>
            <ExpertsLoop copy={V4_LOOP} status={statusOf("buildControl")} />
          </div>
        </div>
        <a className="cue" href="#loop" data-next="true">
          {"How the loop works"}
          <i />
        </a>
        <div className="slide__chip">
          <b>
            {"01"}
          </b>
          <span>
            {"/ 06"}
          </span>
          <i />
          {"Experts"}
        </div>
      </section>
      <section className="slide slide--paper" id="loop" data-snap="slide" data-label="The loop" data-slide-label="The loop">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow eyebrow--you" data-reveal="true">
              {"The loop"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Nothing gets built until you say yes."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"Deckster is not a slot machine. It shows you the plan and the outline before it spends anything on slides — then every slide stays yours to change."}
            </p>
          </div>
          <div className="steps">
            <div className="step" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
              <span className="n">
                {"GATE 1 · THE PLAN "}
                <span className="st st--live st--sm">
                  {"Live"}
                </span>
              </span>
              <b>
                {"Approve the story first"}
              </b>
              <p>
                {"The Director proposes sections and slide count: “Does this structure work for you?” Change it in plain English before a single slide exists."}
              </p>
              <span className="you">
                {"“Cut it to eight slides. Lead with the 48-hour rule.”"}
              </span>
            </div>
            <div className="step" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
              <span className="n">
                {"GATE 2 · THE OUTLINE "}
                <span className="st st--live st--sm">
                  {"Live"}
                </span>
              </span>
              <b>
                {"See the shape, then commit"}
              </b>
              <p>
                {"An outline card for every slide — what it says and how it's laid out — before the full build. “Looks perfect!” or “Make some changes”."}
              </p>
              <span className="you">
                {"“Slide 5 should be a chart, not a table.”"}
              </span>
            </div>
            <div className="step" data-reveal="true" style={{ "--d": "5" } as CSSProperties}>
              <span className="n">
                {"THEN · EVERY SLIDE "}
                <span className="st st--live st--sm">
                  {"Live"}
                </span>
              </span>
              <b>
                {"Edit at any altitude"}
              </b>
              <p>
                {"Click any text to edit it, refine a single chart or diagram, or add a slide. The rest of the deck stays as it is."}
              </p>
              <span className="you">
                {"“Make this chart a waterfall.”"}
              </span>
            </div>
            <div className="step" data-reveal="true" style={{ "--d": "6" } as CSSProperties}>
              <span className="n">
                {"AND · EVERY SLIDE "}
                <span className="st st--build st--sm">
                  {"Coming"}
                </span>
              </span>
              <b>
                {"Checked before you see it"}
              </b>
              <p>
                {"A reviewer will look at each finished slide the way you would. Clipped or crowded text gets repaired, not shipped."}
              </p>
              <span className="agent" style={{ display: "block", marginTop: "10px" } as CSSProperties}>
                {"Slide 4 checked · clipped text repaired"}
              </span>
            </div>
          </div>
          <div className="checks" style={{ justifyContent: "center", marginTop: "22px", "--d": "7" } as CSSProperties} data-reveal="true">
            <span>
              {"Watch the build, slide by slide"}
            </span>
            <span>
              {"Pause or stop a build "}
              <span className="st st--beta st--sm">
                {"Beta"}
              </span>
            </span>
            <span>
              {"Finished slides are kept if you stop"}
            </span>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"02"}
          </b>
          <span>
            {"/ 06"}
          </span>
          <i />
          {"The loop"}
        </div>
      </section>
      <section className="slide slide--paper" id="team" data-snap="slide" data-label="The team" data-slide-label="The team">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"Meet the team"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Specialists, not a one-size-fits-all model."}
            </h2>
          </div>
          <div className="org" style={{ marginTop: "22px", "--d": "2" } as CSSProperties} data-reveal="true">
            <div className="org__you">
              <span className="av" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <circle cx="12" cy="8" r="4" fill="currentColor" />
                  <path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" fill="currentColor" />
                </svg>
              </span>
              <div>
                <b>
                  {"you"}
                </b>
                <br />
                <span>
                  {"executive producer"}
                </span>
              </div>
            </div>
            <div className="org__line" />
            <div className="org__dir">
              <i className="dot" />
              <div>
                <b>
                  {"Director"}
                </b>
                {" "}
                <span>
                  {"· plans the deck, picks the specialist for each step, keeps the through-line — and reports to you"}
                </span>
              </div>
            </div>
          </div>
          <div className="grid3 grid7" style={{ marginTop: "22px" } as CSSProperties}>
            <div className="card" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
              <i className="dot" style={{ display: "block", width: "12px", height: "12px", borderRadius: "3px", transform: "rotate(45deg)", background: "#60a5fa" } as CSSProperties} />
              <h3 className="h3">
                {"Researcher"}
              </h3>
              <p>
                <b>
                  {"The investigator."}
                </b>
                {" Your files and the open web. Cites what it uses; marks estimates as estimates."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
              <i className="dot" style={{ display: "block", width: "12px", height: "12px", borderRadius: "3px", transform: "rotate(45deg)", background: "#fb923c" } as CSSProperties} />
              <h3 className="h3">
                {"Content Generator"}
              </h3>
              <p>
                <b>
                  {"The storyteller."}
                </b>
                {" Headlines, body, bullet hierarchies and speaker notes, tuned to your audience."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "5" } as CSSProperties}>
              <i className="dot" style={{ display: "block", width: "12px", height: "12px", borderRadius: "3px", transform: "rotate(45deg)", background: "#f472b6" } as CSSProperties} />
              <h3 className="h3">
                {"Visualizer"}
              </h3>
              <p>
                <b>
                  {"The designer."}
                </b>
                {" Picks the chart, builds the diagram, lays out the infographic — on one colour system."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "6" } as CSSProperties}>
              <i className="dot" style={{ display: "block", width: "12px", height: "12px", borderRadius: "3px", transform: "rotate(45deg)", background: "#22d3ee" } as CSSProperties} />
              <h3 className="h3">
                {"Theme Builder"}
              </h3>
              <p>
                <b>
                  {"The stylist."}
                </b>
                {" Palette and type from a preset or your brand colour, applied to every slide."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "7" } as CSSProperties}>
              <i className="dot" style={{ display: "block", width: "12px", height: "12px", borderRadius: "3px", transform: "rotate(45deg)", background: "#facc15" } as CSSProperties} />
              <h3 className="h3">
                {"Slide Composer"}
              </h3>
              <p>
                <b>
                  {"The conductor."}
                </b>
                {" Builds each slide's layout and focus, and can compose one new slide into a deck with its neighbours in mind."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "8" } as CSSProperties}>
              <i className="dot" style={{ display: "block", width: "12px", height: "12px", borderRadius: "3px", transform: "rotate(45deg)", background: "#c084fc" } as CSSProperties} />
              <h3 className="h3">
                {"Element Generator"}
              </h3>
              <p>
                <b>
                  {"The builder."}
                </b>
                {" Text boxes, metrics, tables, icons, charts and diagrams — refined one at a time when you ask."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "9" } as CSSProperties}>
              <i className="dot" style={{ display: "block", width: "12px", height: "12px", borderRadius: "3px", transform: "rotate(45deg)", background: "#34d399" } as CSSProperties} />
              <h3 className="h3">
                {"Reviewer "}
                <span className="st st--build st--sm">
                  {"Coming"}
                </span>
              </h3>
              <p>
                <b>
                  {"The proofreader."}
                </b>
                {" Will look at every finished slide and repair clipped or crowded text before you see it."}
              </p>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"03"}
          </b>
          <span>
            {"/ 06"}
          </span>
          <i />
          {"The team"}
        </div>
      </section>
      <section className="slide slide--night tight" id="agent" data-snap="slide" data-slide-label="Agent mode" data-label="Agent mode">
        <div className="glow glow--violet" style={{ width: "54vw", height: "54vw", left: "23vw", top: "-26vw", opacity: "0.32" } as CSSProperties} />
        <div className="glow glow--coral" style={{ width: "36vw", height: "36vw", right: "-12vw", bottom: "-18vw", opacity: "0.22" } as CSSProperties} />
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow eyebrow--you" data-reveal="true">
              {"Agent mode "}
              <span className="st st--build">
                {"Coming"}
              </span>
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Or hand the whole build to one agent."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"The same specialists, run by one agent with judgment. It will design the deck, look at every slide, repair what is off, and report back. You still approve the outline first."}
            </p>
          </div>
          <div className="aloop" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
            <div className="anode anode--you">
              <span className="n">
                {"01 · YOU"}
              </span>
              <b>
                {"Approve the outline"}
              </b>
              <p>
                {"Nothing starts before your yes. You see the estimate and the cap."}
              </p>
            </div>
            <div className="anode">
              <span className="n">
                {"02"}
              </span>
              <b>
                {"Design"}
              </b>
              <p>
                {"Chooses layouts, templates and pictures for each slide."}
              </p>
            </div>
            <div className="anode anode--loop">
              <span className="n">
                {"03"}
              </span>
              <b>
                {"Check"}
              </b>
              <p>
                {"Looks at every finished slide: clipping, crowding, repetition."}
              </p>
            </div>
            <div className="anode anode--loop">
              <span className="n">
                {"04"}
              </span>
              <b>
                {"Repair"}
              </b>
              <p>
                {"Rebuilds what failed. A few tries at most."}
              </p>
            </div>
            <div className="anode">
              <span className="n">
                {"05"}
              </span>
              <b>
                {"Report"}
              </b>
              <p>
                {"Tells you what it did, what it fixed and what it spent."}
              </p>
            </div>
            <div className="aloop__back">
              {"repeats until the slide passes"}
            </div>
          </div>
          <div className="rules rules--3" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
            <div className="rule">
              <b>
                {"A cap, always"}
              </b>
              {"It stops at its credit cap and keeps the slides it finished."}
            </div>
            <div className="rule">
              <b>
                {"No silent fallback"}
              </b>
              {"If it cannot finish, it says so. It never quietly switches to something cheaper."}
            </div>
            <div className="rule">
              <b>
                {"Still editable"}
              </b>
              {"What it builds is a normal Deckster deck. Every slide is yours to change."}
            </div>
          </div>
          <p className="small center" style={{ marginTop: "14px" } as CSSProperties}>
            <Link href="/build" style={{ color: "var(--accent)", fontWeight: "600" } as CSSProperties}>
              {"Compare the three ways to build →"}
            </Link>
          </p>
        </div>
        <div className="slide__chip">
          <b>
            {"04"}
          </b>
          <span>
            {"/ 06"}
          </span>
          <i />
          {"Agent mode"}
        </div>
      </section>
      <section className="slide slide--night" id="never" data-snap="slide" data-label="Guardrails" data-slide-label="Guardrails">
        <div className="glow glow--coral" style={{ width: "50vw", height: "50vw", right: "-16vw", top: "-10vh", opacity: "0.25" } as CSSProperties} />
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow eyebrow--you" data-reveal="true">
              {"Guardrails"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Four things the team will never do."}
            </h2>
          </div>
          <div className="grid4" style={{ marginTop: "34px" } as CSSProperties}>
            <div className="card" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              <span className="big" style={{ color: "var(--coral-d)" } as CSSProperties}>
                {"01"}
              </span>
              <h3 className="h3">
                {"Build without your yes"}
              </h3>
              <p>
                {"No slide is built before you approve the plan. Every finished slide stays editable."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
              <span className="big" style={{ color: "var(--coral-d)" } as CSSProperties}>
                {"02"}
              </span>
              <h3 className="h3">
                {"Pass off a guess as a fact"}
              </h3>
              <p>
                {"Charts say where their numbers came from — a source, “User-provided data”, or “Illustrative” when no real data exists. Soon each number carries its own badge."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
              <span className="big" style={{ color: "var(--coral-d)" } as CSSProperties}>
                {"03"}
              </span>
              <h3 className="h3">
                {"Name your private files"}
              </h3>
              <p>
                {"A published deck may use your uploads to answer — it never tells the audience they exist."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "5" } as CSSProperties}>
              <span className="big" style={{ color: "var(--coral-d)" } as CSSProperties}>
                {"04"}
              </span>
              <h3 className="h3">
                {"Hide what it's doing"}
              </h3>
              <p>
                {"You see each step as it happens — planning, research, each slide — and can pause or stop a build in beta. Soon every AI change is named in the history and can be restored."}
              </p>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"05"}
          </b>
          <span>
            {"/ 06"}
          </span>
          <i />
          {"Guardrails"}
        </div>
      </section>
      <section className="slide slide--night" id="close" data-snap="slide" data-label="Begin" data-slide-label="Begin">
        <div className="glow glow--violet" style={{ width: "60vw", height: "60vw", left: "20vw", top: "-20vh", opacity: "0.4" } as CSSProperties} />
        <div className="dots" />
        <div className="grain" />
        <div className="slide__inner center">
          <span className="eyebrow eyebrow--you" data-reveal="true">
            {"Begin"}
          </span>
          <h2 className="h1 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
            {"Take the "}
            <span className="you">
              {"chair."}
            </span>
          </h2>
          <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
            {"One sentence to the Director is enough to start. Attach your documents and it starts further along."}
          </p>
          <div className="ctas" style={{ justifyContent: "center", "--d": "3" } as CSSProperties} data-reveal="true">
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
            {"06"}
          </b>
          <span>
            {"/ 06"}
          </span>
          <i />
          {"Begin"}
        </div>
      </section>
    </main>
  )
}
