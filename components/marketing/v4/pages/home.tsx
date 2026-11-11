/* eslint-disable @next/next/no-img-element */
// Marketing v4 (Home), rendered only with NEXT_PUBLIC_MARKETING_V4=true.
// Converted from the approved mock (Deckster/design-marketing-v4/index.html, tools/port_to_next.py); maintained by hand from here.
// Status pills are plain markup: the wording rules are in components/marketing/v4/content.ts.
import type { CSSProperties } from "react"
import Link from "next/link"
import { BuildCta } from "@/components/marketing/v3-uat/BuildCta"
import { ZoomBuild } from "@/components/marketing/v3-uat/ZoomBuild"
import { KnowledgeGraphCanvas } from "@/components/marketing/v3-uat/KnowledgeGraphCanvas"
import { ExpertsLoop } from "@/components/marketing/v3-uat/ExpertsLoop"
import { V4_LOOP, V4_ZOOM } from "@/components/marketing/v4/content"
import { AudienceQA } from "@/components/marketing/v3-uat/AudienceQA"
import { CycleWord } from "@/components/marketing/v3-uat/CycleWord"
import { Waveform } from "@/components/marketing/v3-uat/Waveform"
import { statusOf } from "@/components/marketing/v3-uat/StatusPill"
import { V3_CONTENT, showcaseAlt } from "@/lib/marketing/v3-uat-view"

export function V4HomePage() {
  const c = V3_CONTENT
  return (
    <main data-page="home">
      <section className="slide slide--night is-in" id="start" data-snap="slide" data-chapter="Start" data-slide-label="Start" data-label="Start">
        <div className="glow glow--violet" style={{ width: "62vw", height: "62vw", left: "-22vw", top: "-30vw" } as CSSProperties} />
        <div className="glow glow--coral" style={{ width: "44vw", height: "44vw", right: "-16vw", bottom: "-20vw", opacity: "0.32" } as CSSProperties} />
        <div className="dots" />
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols">
            <div>
              <span className="eyebrow eyebrow--you" data-reveal="true">
                {"Your presentation agent · early access"}
              </span>
              <h1 className="h1" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"Talk to it."}
                <br />
                {"Build with it."}
                <br />
                <span className="you">
                  {"Present with it."}
                </span>
              </h1>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"Deckster is an agent you work with. Tell it what you need by chat, and soon on a call or face to face on video. It plans with you and builds the deck in front of you. Soon it will check its own work and present at your side."}
              </p>
              <div className="ctas" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
                <BuildCta className="btn btn--primary" location="v3_hero_build">
                  {"Request early access "}
                  <svg className="arrow" aria-hidden="true">
                    <use href="#arrow" />
                  </svg>
                </BuildCta>
                <a className="btn btn--ghost" href="#agent" data-next="true">
                  {"Meet your agent"}
                </a>
              </div>
              <p className="truthline" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
                {"Have an access code? "}
                <Link href="/auth/signin">
                  {"Sign in with Google"}
                </Link>
                {" and start today."}
              </p>
              <div className="facts" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
                <span>
                  {"Plan approval before any slide is built"}
                </span>
                <span>
                  {"Chart sources shown"}
                </span>
                <span>
                  {"Edit any slide yourself"}
                </span>
                <span>
                  {"PowerPoint & PDF, no watermark"}
                </span>
              </div>
            </div>
            <div data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              <div className="astage astage--withphone">
                <div className="astage__top">
                  <span className="live" />
                  {"Video call · your agent "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                  <span className="t">
                    {"02:14"}
                  </span>
                </div>
                <div className="astage__body">
                  <div className="astage__canvas">
                    <img src="/marketing/v4/decks/a2-06.jpg" alt="The deck, on screen during the call" width="1280" height="718" />
                    <i className="astage__sel" data-l="You pointed here" style={{ left: "27.6%", top: "33%", width: "13.6%", height: "45%" } as CSSProperties} />
                    <svg className="astage__cur" style={{ left: "39%", top: "74%" } as CSSProperties} viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 3l7 17 2.5-6.5L20 11z" fill="currentColor" />
                    </svg>
                    <div className="astage__pip">
                      <div className="vtile vtile--agent">
                        <video className="castv" muted loop playsInline preload="none" poster="/marketing/v4/cast/lucia.webp" data-src="/marketing/v4/cast/lucia-talking.webm" width="320" height="320" aria-label="Lucia, a Deckster companion, talking" />
                        <span className="vtile__n">
                          {"Your agent"}
                        </span>
                      </div>
                      <div className="vtile vtile--you">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="12" cy="8" r="4" fill="currentColor" />
                          <path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" fill="currentColor" />
                        </svg>
                        <span className="vtile__n">
                          {"You"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="astage__cap">
                  <span className="you">
                    {"“Why is August so far ahead? Add a note.”"}
                  </span>
                  <span className="agent">
                    {"Your agent · adding it: the heat wave on 14 August pushed prices to $386 per MWh."}
                  </span>
                </div>
                <div className="astage__modes">
                  <span className="amode">
                    {"Chat "}
                    <span className="st st--live st--sm">
                      {"Live"}
                    </span>
                  </span>
                  <span className="amode">
                    {"Call "}
                    <span className="st st--build st--sm">
                      {"Coming"}
                    </span>
                  </span>
                  <span className="amode is-on">
                    {"Video "}
                    <span className="st st--build st--sm">
                      {"Coming"}
                    </span>
                  </span>
                  <span className="amode">
                    {"Point at it "}
                    <span className="st st--build st--sm">
                      {"Coming"}
                    </span>
                  </span>
                </div>
                <div className="phone" aria-hidden="true">
                  <div className="phone__scr">
                    <span className="phone__k">
                      {"Your agent · on a call"}
                    </span>
                    <span className="phone__face">
                      <img className="castp" src="/marketing/v4/cast/lucia.webp" alt="Lucia, a Deckster companion" width="320" height="320" loading="lazy" decoding="async" />
                    </span>
                    <span className="phone__slide">
                      <img src="/marketing/v4/decks/a2-01.jpg" alt="" width="1280" height="718" />
                    </span>
                    <span className="phone__cap">
                      {"“Open with the 12% beat.”"}
                    </span>
                    <span className="phone__ag">
                      {"Done. It leads the title now."}
                    </span>
                    <span className="phone__btn" />
                    <span className="phone__hint">
                      {"Hold to talk"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="only-phone" style={{ marginTop: "18px" } as CSSProperties}>
                <div className="phone phone--lg phone--solo" aria-hidden="true">
                  <div className="phone__scr">
                    <span className="phone__k">
                      {"Your agent · on a call"}
                    </span>
                    <span className="phone__face">
                      <video className="castv" muted loop playsInline preload="none" poster="/marketing/v4/cast/lucia.webp" data-src="/marketing/v4/cast/lucia-talking.webm" width="320" height="320" aria-label="Lucia, a Deckster companion, talking" />
                    </span>
                    <span className="phone__slide">
                      <img src="/marketing/v4/decks/a2-01.jpg" alt="" width="1280" height="718" />
                    </span>
                    <span className="phone__cap">
                      {"“Open with the 12% beat.”"}
                    </span>
                    <span className="phone__ag">
                      {"Done. It leads the title now."}
                    </span>
                    <span className="phone__btn" />
                    <span className="phone__hint">
                      {"Hold to talk"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <a className="cue" href="#agent" data-next="true">
          {"Meet your agent"}
          <i />
        </a>
        <div className="slide__chip">
          <b>
            {"01"}
          </b>
          <span>
            {"/ 12"}
          </span>
          <i />
          {"Start"}
        </div>
      </section>
      <section className="slide slide--paper tight" id="agent" data-snap="slide" data-chapter="Build" data-slide-label="Your agent" data-label="Your agent">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow eyebrow--you" data-reveal="true">
              {"Your agent"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"It works with you. It presents with you. "}
              <span className="you you--big">
                {"It can even look like you."}
              </span>
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"One agent, start to finish. It plans your deck and runs a team of specialists, and you talk to it the way you would to a colleague."}
            </p>
          </div>
          <div className="caps3" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
            <div className="cap">
              <span className="cap__hd">
                <span className="k4">
                  {"Build"}
                </span>
                <span className="st st--live st--sm">
                  {"Live"}
                </span>
              </span>
              <span className="cap__t">
                {"Works with you."}
              </span>
              <p>
                {"Tell it what you need. It plans with you, waits for your yes, builds while you watch, and gets the deck done."}
              </p>
              <span className="cap__demo">
                <span className="you">
                  {"“Build a 12-slide review from my Q3 board pack.”"}
                </span>
                <span className="agent">
                  {"Your agent · here’s the plan: 3 sections, 12 slides. Does this structure work for you?"}
                </span>
                <span className="vstrip">
                  <span className="mic" />
                  <span className="vwave">
                    <i style={{ "--a": "30" } as CSSProperties} />
                    <i style={{ "--a": "62" } as CSSProperties} />
                    <i style={{ "--a": "84" } as CSSProperties} />
                    <i style={{ "--a": "46" } as CSSProperties} />
                    <i style={{ "--a": "70" } as CSSProperties} />
                    <i style={{ "--a": "38" } as CSSProperties} />
                    <i style={{ "--a": "90" } as CSSProperties} />
                    <i style={{ "--a": "58" } as CSSProperties} />
                    <i style={{ "--a": "34" } as CSSProperties} />
                    <i style={{ "--a": "76" } as CSSProperties} />
                    <i style={{ "--a": "50" } as CSSProperties} />
                    <i style={{ "--a": "28" } as CSSProperties} />
                    <i style={{ "--a": "66" } as CSSProperties} />
                    <i style={{ "--a": "82" } as CSSProperties} />
                  </span>
                  {"Call or video call "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </span>
              </span>
              <span className="cap__foot">
                {"Chat today · calls, video and self-checking coming"}
              </span>
            </div>
            <div className="cap">
              <span className="cap__hd">
                <span className="k4">
                  {"Present"}
                </span>
                <span className="st st--build st--sm">
                  {"Coming"}
                </span>
              </span>
              <span className="cap__t">
                {"Presents with you."}
              </span>
              <p>
                {"On the day it speaks the script you approved, moves the deck along, and answers questions from your slides and documents."}
              </p>
              <span className="cap__demo cap__demo--present">
                <img src="/marketing/v4/decks/a2-04.jpg" alt="" width="1280" height="718" />
                <span className="presenter">
                  <video className="castv" muted loop playsInline preload="none" poster="/marketing/v4/cast/ollie.webp" data-src="/marketing/v4/cast/ollie-pointing.webm" width="320" height="320" aria-label="Ollie, a Deckster companion, pointing" />
                </span>
                <span className="companion companion--left">
                  <span>
                    <span className="k4">
                      {"Presenting · slide 4"}
                    </span>
                    {"“Wider spreads and two new sites drove the result.”"}
                  </span>
                </span>
              </span>
              <span className="cap__foot">
                {"Narration and audience questions are live today"}
              </span>
            </div>
            <div className="cap cap--you">
              <span className="cap__hd">
                <span className="k4">
                  {"Avatar"}
                </span>
                <span className="st st--build st--sm">
                  {"Coming"}
                </span>
              </span>
              <span className="cap__t">
                <span className="you">
                  {"Looks like you."}
                </span>
              </span>
              <p>
                {"Upload a photo and get your own drawn avatar. It talks, builds and presents like any other companion."}
              </p>
              <span className="cap__demo">
                <div className="spawn">
                  <div className="spawn__you">
                    <div className="ptile ptile--photo">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="8" r="4" fill="currentColor" />
                        <path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" fill="currentColor" />
                      </svg>
                      <span className="ptile__n">
                        {"Your photo"}
                      </span>
                    </div>
                    <span className="spawn__arrow">
                      {"→"}
                    </span>
                    <div className="ptile is-pick">
                      <img className="castp" src="/marketing/v4/cast/gabe.webp" alt="Gabe, a Deckster companion" width="320" height="320" loading="lazy" decoding="async" />
                      <span className="ptile__n">
                        {"Your avatar · example"}
                      </span>
                    </div>
                    <span className="spawn__note">
                      {"Drawn in the same style as the cast."}
                    </span>
                  </div>
                  <div className="spawn__cast">
                    <div className="ptile">
                      <img className="castp" src="/marketing/v4/cast/lucia.webp" alt="Lucia, a Deckster companion" width="320" height="320" loading="lazy" decoding="async" />
                      <span className="ptile__n">
                        {"Lucia"}
                      </span>
                    </div>
                    <div className="ptile">
                      <img className="castp" src="/marketing/v4/cast/ollie.webp" alt="Ollie, a Deckster companion" width="320" height="320" loading="lazy" decoding="async" />
                      <span className="ptile__n">
                        {"Ollie"}
                      </span>
                    </div>
                    <div className="ptile">
                      <img className="castp" src="/marketing/v4/cast/arjun.webp" alt="Arjun, a Deckster companion" width="320" height="320" loading="lazy" decoding="async" />
                      <span className="ptile__n">
                        {"Arjun"}
                      </span>
                    </div>
                    <div className="ptile">
                      <img className="castp" src="/marketing/v4/cast/clover.webp" alt="Clover, a Deckster companion" width="320" height="320" loading="lazy" decoding="async" />
                      <span className="ptile__n">
                        {"Clover"}
                      </span>
                    </div>
                  </div>
                </div>
              </span>
              <span className="cap__foot">
                {"Pick one of ours, or have yours drawn · never photoreal"}
              </span>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"02"}
          </b>
          <span>
            {"/ 12"}
          </span>
          <i />
          {"Your agent"}
        </div>
      </section>
      <ZoomBuild copy={V4_ZOOM} n={3} total={12} tileAlts={V4_ZOOM.tiles.map((tile) => showcaseAlt(tile.slide, tile.title))} slideStatus={statusOf("slidePanel")} />
      <section className="slide slide--paper" id="experts" data-snap="slide" data-chapter="Build" data-slide-label="Experts" data-label="Experts">
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols cols--tight">
            <div>
              <span className="eyebrow eyebrow--you" data-reveal="true">
                {"Human in the loop"}
              </span>
              <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"You direct. Specialists build."}
              </h2>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"Your agent plans the deck and hands the work to specialists for research, writing, charts and design. You approve the plan, watch the build, and edit anything yourself. Soon a reviewer will look at every finished slide and repair what is off."}
              </p>
              <div className="org" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
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
                      {"executive producer · the human in the loop"}
                    </span>
                  </div>
                </div>
                <div className="org__line" />
                <div className="org__dir" data-agent="director">
                  <i className="dot" />
                  <div>
                    <b>
                      {"Your agent"}
                    </b>
                    {" "}
                    <span>
                      {"· plans the deck, picks the specialist for each step — reports to you"}
                    </span>
                  </div>
                </div>
                <div className="org__row org__row--7">
                  <div data-agent="researcher">
                    <i className="dot" style={{ background: "#60a5fa" } as CSSProperties} />
                    <b>
                      {"Researcher"}
                    </b>
                    <span>
                      {"your files and the web"}
                    </span>
                  </div>
                  <div data-agent="content_generator">
                    <i className="dot" style={{ background: "#fb923c" } as CSSProperties} />
                    <b>
                      {"Content"}
                    </b>
                    <span>
                      {"headlines, body, notes"}
                    </span>
                  </div>
                  <div data-agent="visualizer">
                    <i className="dot" style={{ background: "#f472b6" } as CSSProperties} />
                    <b>
                      {"Visualizer"}
                    </b>
                    <span>
                      {"charts, diagrams, infographics"}
                    </span>
                  </div>
                  <div data-agent="theme_builder">
                    <i className="dot" style={{ background: "#22d3ee" } as CSSProperties} />
                    <b>
                      {"Theme Builder"}
                    </b>
                    <span>
                      {"palette and type"}
                    </span>
                  </div>
                  <div data-agent="slide_composer">
                    <i className="dot" style={{ background: "#facc15" } as CSSProperties} />
                    <b>
                      {"Slide Composer"}
                    </b>
                    <span>
                      {"one slide into any deck"}
                    </span>
                  </div>
                  <div data-agent="element_generator">
                    <i className="dot" style={{ background: "#c084fc" } as CSSProperties} />
                    <b>
                      {"Element Generator"}
                    </b>
                    <span>
                      {"one element at a time"}
                    </span>
                  </div>
                  <div data-agent="reviewer">
                    <i className="dot" style={{ background: "#34d399" } as CSSProperties} />
                    <b>
                      {"Reviewer"}
                    </b>
                    <span>
                      {"checks every slide · coming"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="gates" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
                <div className="gate">
                  <i>
                    {"1"}
                  </i>
                  <b>
                    {"Plan"}
                  </b>
                  {" → your yes"}
                </div>
                <div className="gate">
                  <i>
                    {"2"}
                  </i>
                  <b>
                    {"Outline"}
                  </b>
                  {" → your yes"}
                </div>
                <div className="gate">
                  <i>
                    {"3"}
                  </i>
                  <b>
                    {"Any slide"}
                  </b>
                  {" → your edit"}
                </div>
                <div className="gate">
                  <i>
                    {"✓"}
                  </i>
                  <b>
                    {"Every slide"}
                  </b>
                  {" → checked for you "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </div>
              </div>
            </div>
            <ExpertsLoop copy={V4_LOOP} status={statusOf("buildControl")} />
          </div>
          <p className="note4" data-reveal="true" style={{ "--d": "5" } as CSSProperties}>
            <b>
              {"Agent mode"}
            </b>
            {" "}
            <span className="st st--build st--sm">
              {"Coming"}
            </span>
            {" hands the whole build to one agent that designs, checks and repairs. "}
            <Link href="/build#agent" style={{ color: "var(--accent)", fontWeight: "600" } as CSSProperties}>
              {"How it will work →"}
            </Link>
          </p>
        </div>
        <div className="slide__chip">
          <b>
            {"04"}
          </b>
          <span>
            {"/ 12"}
          </span>
          <i />
          {"Experts"}
        </div>
      </section>
      <section className="slide slide--paper" id="gallery" data-snap="slide" data-chapter="Build" data-slide-label="Gallery" data-label="Gallery">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"What they build"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Every shape your idea fits into."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"Charts, diagrams, infographics and tables, in the deck's theme. Refine any one of them later without touching the rest of the slide."}
            </p>
          </div>
          <div className="counts" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
            <div>
              <b>
                {"9"}
              </b>
              <span>
                {"element types"}
              </span>
            </div>
            <div>
              <b>
                {"14"}
              </b>
              <span>
                {"chart types"}
              </span>
            </div>
            <div>
              <b>
                {"8"}
              </b>
              <span>
                {"diagram types"}
              </span>
            </div>
            <div>
              <b>
                {"Any"}
              </b>
              <span>
                {"infographic you describe"}
              </span>
            </div>
          </div>
          <div className="wall" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
            <figure style={{ "--i": "0", "--r": "-7deg" } as CSSProperties}>
              <img src="/marketing/v3-uat/slides/deck-02.jpg" alt="Slide 2 of the showcase deck: Driving Business Agility through a Five-Step Model" width="1280" height="720" loading="lazy" decoding="async" />
              <figcaption>
                <b>
                  {"Five-step model"}
                </b>
                <span>
                  {"chevrons"}
                </span>
              </figcaption>
            </figure>
            <figure style={{ "--i": "1", "--r": "5deg" } as CSSProperties}>
              <img src="/marketing/v3-uat/slides/deck-04.jpg" alt="Slide 11 of the showcase deck: Strengthening the Six Capabilities of Modern Delivery" width="1280" height="720" loading="lazy" decoding="async" />
              <figcaption>
                <b>
                  {"Six capabilities"}
                </b>
                <span>
                  {"honeycomb"}
                </span>
              </figcaption>
            </figure>
            <figure style={{ "--i": "2", "--r": "-4deg" } as CSSProperties}>
              <img src="/marketing/v3-uat/slides/deck-06.jpg" alt="Slide 6 of the showcase deck: Optimizing Decision Forums and Governance Cadence" width="1280" height="720" loading="lazy" decoding="async" />
              <figcaption>
                <b>
                  {"Decision forums"}
                </b>
                <span>
                  {"pyramid"}
                </span>
              </figcaption>
            </figure>
            <figure style={{ "--i": "3", "--r": "8deg" } as CSSProperties}>
              <img src="/marketing/v3-uat/slides/deck-07.jpg" alt="Slide 7 of the showcase deck: Teams Climb Five Levels of Delivery Maturity" width="1280" height="720" loading="lazy" decoding="async" />
              <figcaption>
                <b>
                  {"Delivery maturity"}
                </b>
                <span>
                  {"staircase"}
                </span>
              </figcaption>
            </figure>
            <figure style={{ "--i": "4", "--r": "-6deg" } as CSSProperties}>
              <img src="/marketing/v3-uat/slides/deck-08.jpg" alt="Slide 9 of the showcase deck: Where each decision should live" width="1280" height="720" loading="lazy" decoding="async" />
              <figcaption>
                <b>
                  {"Where decisions live"}
                </b>
                <span>
                  {"2×2 matrix"}
                </span>
              </figcaption>
            </figure>
            <figure style={{ "--i": "5", "--r": "4deg" } as CSSProperties}>
              <img src="/marketing/v3-uat/slides/deck-10.jpg" alt="Slide 10 of the showcase deck: Four Core Pillars of the Operating Model" width="1280" height="720" loading="lazy" decoding="async" />
              <figcaption>
                <b>
                  {"Four pillars"}
                </b>
                <span>
                  {"cards"}
                </span>
              </figcaption>
            </figure>
            <figure style={{ "--i": "6", "--r": "-8deg" } as CSSProperties}>
              <img src="/marketing/v3-uat/slides/deck-11.jpg" alt="Slide 12 of the showcase deck: The rollout runs from June 2026 to June 2027" width="1280" height="720" loading="lazy" decoding="async" />
              <figcaption>
                <b>
                  {"Rollout"}
                </b>
                <span>
                  {"timeline"}
                </span>
              </figcaption>
            </figure>
            <figure style={{ "--i": "7", "--r": "6deg" } as CSSProperties}>
              <img src="/marketing/v3-uat/slides/deck-12.jpg" alt="Slide 14 of the showcase deck: Hiring Worked: Eleven Engineers Joined Last Quarter" width="1280" height="720" loading="lazy" decoding="async" />
              <figcaption>
                <b>
                  {"Hiring"}
                </b>
                <span>
                  {"funnel"}
                </span>
              </figcaption>
            </figure>
          </div>
          <p className="small center" style={{ marginTop: "12px" } as CSSProperties}>
            {"All eight from one deck Deckster built. Colours, pictures and title slides will be chosen to fit each topic "}
            <span className="st st--build st--sm">
              {"Coming"}
            </span>
          </p>
        </div>
        <div className="slide__chip">
          <b>
            {"05"}
          </b>
          <span>
            {"/ 12"}
          </span>
          <i />
          {"Gallery"}
        </div>
      </section>
      <section className="slide slide--paper tight" id="bring" data-snap="slide" data-chapter="Bring" data-slide-label="Bring" data-label="Bring">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow eyebrow--you" data-reveal="true">
              {"Bring what you have"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Start from what you already have."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"Documents, data and your brand go in from the first brief. Old decks, and soon designs made anywhere else, become yours to reuse."}
            </p>
          </div>
          <div className="flow" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
            <svg className="flow__svg" aria-hidden="true" />
            <div className="flow__col">
              <div className="file">
                <div className="file__ic" style={{ background: "linear-gradient(160deg,#c2410c,#f97316)" } as CSSProperties}>
                  {"PPTX"}
                </div>
                <div>
                  <b>
                    {"Q3 board pack.pptx"}
                  </b>
                  <span>
                    {"16 slides · presented in June"}
                  </span>
                </div>
              </div>
              <div className="file">
                <div className="file__ic" style={{ background: "linear-gradient(160deg,#166534,#22c55e)" } as CSSProperties}>
                  {"XLSX"}
                </div>
                <div>
                  <b>
                    {"Throughput by team.xlsx"}
                  </b>
                  <span>
                    {"6 sheets · the numbers behind the charts"}
                  </span>
                </div>
              </div>
              <div className="file">
                <div className="file__ic" style={{ background: "linear-gradient(160deg,#16203a,#385b9d)" } as CSSProperties}>
                  {"HEX"}
                </div>
                <div>
                  <b>
                    {"Brand colour #16203A"}
                  </b>
                  <span>
                    {"navy, with a gold accent"}
                  </span>
                </div>
              </div>
              <div className="file">
                <div className="file__ic" style={{ background: "linear-gradient(160deg,#4c1d95,#8b5cf6)" } as CSSProperties}>
                  {"ANY"}
                </div>
                <div>
                  <b>
                    {"A slide made elsewhere"}
                  </b>
                  <span>
                    {"an image, a PDF page or a web page"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flow__core">
              <div className="core">
                <svg width="86" height="86" aria-hidden="true">
                  <use href="#logo" />
                </svg>
              </div>
            </div>
            <div className="flow__col">
              <div className="asset">
                <div className="asset__thumb">
                  <img src="/marketing/v3-uat/slides/deck-04.jpg" alt="Slide 11 of the showcase deck: Strengthening the Six Capabilities of Modern Delivery" width="96" height="54" loading="lazy" decoding="async" />
                  <i className="role" style={{ left: "3%", top: "8%", width: "60%", height: "12%" } as CSSProperties} />
                  <i className="role" style={{ left: "3%", top: "26%", width: "94%", height: "30%" } as CSSProperties} />
                  <i className="role" style={{ left: "3%", top: "60%", width: "94%", height: "28%" } as CSSProperties} />
                </div>
                <div>
                  <b>
                    {"Template · Board pack"}
                  </b>
                  <span>
                    {"reuse it as it was, or with a new topic"}
                  </span>
                  <span className="st st--beta">
                    {"Beta · .pptx"}
                  </span>
                </div>
              </div>
              <div className="asset">
                <svg className="mini-graph" viewBox="0 0 96 54" aria-hidden="true">
                  <g stroke="#5B4DFF" strokeOpacity=".45" strokeWidth="1">
                    <path d="M12 40L30 22L52 30L70 12L84 26M30 22L52 8M52 30L70 42" />
                  </g>
                  <g fill="#5B4DFF">
                    <circle cx="12" cy="40" r="3" />
                    <circle cx="52" cy="30" r="3" />
                    <circle cx="70" cy="12" r="3" />
                    <circle cx="84" cy="26" r="3" />
                    <circle cx="52" cy="8" r="2.5" />
                    <circle cx="70" cy="42" r="2.5" />
                  </g>
                  <circle cx="30" cy="22" r="4" fill="#F4502F" />
                </svg>
                <div>
                  <b>
                    {"Sources · your files"}
                  </b>
                  <span>
                    {"charts and figures say where their numbers came from"}
                  </span>
                  <span className="st st--live">
                    {"Live"}
                  </span>
                </div>
              </div>
              <div className="asset">
                <div className="swatches">
                  <i style={{ background: "#16203a" } as CSSProperties} />
                  <i style={{ background: "#385b9d" } as CSSProperties} />
                  <i style={{ background: "#e8a013" } as CSSProperties} />
                  <i style={{ background: "#F1F4F9" } as CSSProperties} />
                  <i style={{ background: "#8791A3" } as CSSProperties} />
                </div>
                <div>
                  <b>
                    {"Theme · navy & gold"}
                  </b>
                  <span>
                    {"preset or brand colour, set before the build"}
                  </span>
                  <span className="st st--live">
                    {"Live"}
                  </span>
                </div>
              </div>
              <div className="asset">
                <div className="asset__thumb">
                  <img src="/marketing/v3-uat/slides/deck-07.jpg" alt="" width="96" height="54" loading="lazy" decoding="async" />
                  <i className="role" style={{ left: "3%", top: "8%", width: "70%", height: "12%" } as CSSProperties} />
                  <i className="role" style={{ left: "3%", top: "26%", width: "44%", height: "60%" } as CSSProperties} />
                  <i className="role" style={{ left: "52%", top: "26%", width: "45%", height: "60%" } as CSSProperties} />
                </div>
                <div>
                  <b>
                    {"Editable deck · Deckster format"}
                  </b>
                  <span>
                    {"text, charts and pictures you can change"}
                  </span>
                  <span className="st st--build">
                    {"Coming"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="bring__notes bring__notes--4">
            <div data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
              <b>
                <i style={{ background: "var(--coral)" } as CSSProperties} />
                {"Decks become templates "}
                <span className="st st--beta st--sm">
                  {"Beta"}
                </span>
              </b>
              <p>
                {"Add a PowerPoint to your template library and reuse it as it was. Next, Composer picks the layout that fits each new slide by itself."}
              </p>
            </div>
            <div data-reveal="true" style={{ "--d": "5" } as CSSProperties}>
              <b>
                <i style={{ background: "var(--violet)" } as CSSProperties} />
                {"Documents become sources "}
                <span className="st st--live st--sm">
                  {"Live"}
                </span>
              </b>
              <p>
                {"PDFs, Word files and spreadsheets are read for facts and figures. Charts built from them say where their numbers came from."}
              </p>
            </div>
            <div data-reveal="true" style={{ "--d": "6" } as CSSProperties}>
              <b>
                <i style={{ background: "var(--mint)" } as CSSProperties} />
                {"Brands become themes "}
                <span className="st st--live st--sm">
                  {"Live"}
                </span>
              </b>
              <p>
                {"Start from a preset or your brand colour and save it as your standard. A full brand kit, with logo, fonts and footer, is coming."}
              </p>
            </div>
            <div data-reveal="true" style={{ "--d": "7" } as CSSProperties}>
              <b>
                <i style={{ background: "var(--violet-d)" } as CSSProperties} />
                {"Outside designs become editable "}
                <span className="st st--build st--sm">
                  {"Coming"}
                </span>
              </b>
              <p>
                {"A slide made in another tool, or by another AI, is read into text boxes, charts and pictures you can change."}
              </p>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"06"}
          </b>
          <span>
            {"/ 12"}
          </span>
          <i />
          {"Bring"}
        </div>
      </section>
      <section className="slide slide--night" id="knowledge" data-snap="slide" data-chapter="Bring" data-slide-label="Knowledge" data-label="Knowledge">
        <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", left: "-10vw", top: "10vh", opacity: "0.35" } as CSSProperties} />
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols cols--rev">
            <KnowledgeGraphCanvas copy={c.knowledge} />
            <div>
              <span className="eyebrow" data-reveal="true">
                {"Knowledge graph "}
                <span className="st st--beta">
                  {"Beta"}
                </span>
              </span>
              <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"Every deck you make can teach the next one."}
              </h2>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"Switch it on, and the research and documents behind each deck join a graph that is yours. Later decks on related topics draw on it, and say so."}
              </p>
              <div className="cite" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
                <div className="cite__row">
                  <div className="cite__cell">
                    <span className="k">
                      {"From the web"}
                    </span>
                    <div className="v">
                      {"Median approval latency in mid-size banks: 6.2 days"}
                    </div>
                    <span className="s">
                      {"Estimated · industry survey, 2025"}
                    </span>
                  </div>
                  <div className="cite__cell">
                    <span className="k" style={{ color: "var(--coral-d)" } as CSSProperties}>
                      {"Your knowledge"}
                    </span>
                    <div className="v">
                      {"Median approval latency at Northbank: 11 days"}
                    </div>
                    <span className="s">
                      {"Source: "}
                      <b>
                        {"Q3 board pack, slide 7"}
                      </b>
                    </span>
                  </div>
                </div>
              </div>
              <div className="checks" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
                <span>
                  {"On or off per deck"}
                </span>
                <span>
                  {"Browse it on your Knowledge page"}
                </span>
                <span>
                  {"Delete it any time"}
                </span>
                <span>
                  {"Never shown to your audience"}
                </span>
              </div>
              <p className="note4" data-reveal="true" style={{ "--d": "5" } as CSSProperties}>
                <span className="st st--build st--sm">
                  {"Coming"}
                </span>
                {" Connect Google Drive, so the documents you already keep there feed the same graph."}
              </p>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"07"}
          </b>
          <span>
            {"/ 12"}
          </span>
          <i />
          {"Knowledge"}
        </div>
      </section>
      <section className="slide slide--paper tight" id="proof" data-snap="slide" data-chapter="Bring" data-slide-label="Proof" data-label="Proof">
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols cols--rev">
            <div data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              <div className="pslide">
                <div className="pslide__eb">
                  {"ANALYSIS"}
                </div>
                <h3 className="pslide__t">
                  {"Decision latency by "}
                  <em>
                    {"team"}
                  </em>
                </h3>
                <div className="pslide__m">
                  <div className="pm is-open">
                    <b>
                      {"11 days"}
                    </b>
                    <span className="l">
                      {"Median decision"}
                    </span>
                    <span className="pb pb--file">
                      {"File"}
                    </span>
                  </div>
                  <div className="pm">
                    <b>
                      {"6.2 days"}
                    </b>
                    <span className="l">
                      {"Industry median"}
                    </span>
                    <span className="pb pb--web">
                      {"Web"}
                    </span>
                  </div>
                  <div className="pm">
                    <b>
                      {"−23%"}
                    </b>
                    <span className="l">
                      {"Throughput gap"}
                    </span>
                    <span className="pb pb--est">
                      {"Estimate"}
                    </span>
                  </div>
                </div>
                <div style={{ flex: "1" } as CSSProperties} />
                <div className="pslide__foot">
                  <span>
                    {"Fixing delivery without adding headcount"}
                  </span>
                  <span>
                    {"5 / 16"}
                  </span>
                </div>
                <div className="ppop">
                  <span className="k4">
                    {"From your file"}
                  </span>
                  <b>
                    {"Q3 board pack.pptx · slide 7"}
                  </b>
                  <q>
                    {"Median time from request to decision: 11 days."}
                  </q>
                  <span className="ppop__link">
                    {"Open the source →"}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <span className="eyebrow" data-reveal="true">
                {"Proof "}
                <span className="st st--build">
                  {"Coming"}
                </span>
              </span>
              <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"Every number says where it came from."}
              </h2>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"A small badge sits on each figure: from your file, from the web, or an estimate. Click it to open the source. What nobody can vouch for is labelled an estimate, never dressed up as a fact."}
              </p>
              <div className="pkey" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
                <span>
                  <span className="pb pb--file">
                    {"File"}
                  </span>
                  {"your documents"}
                </span>
                <span>
                  <span className="pb pb--web">
                    {"Web"}
                  </span>
                  {"cited research"}
                </span>
                <span>
                  <span className="pb pb--est">
                    {"Estimate"}
                  </span>
                  {"said plainly"}
                </span>
              </div>
              <div className="hist" style={{ marginTop: "18px" } as CSSProperties} data-reveal="true">
                <div className="hist__hd">
                  {"History · every AI change, named "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </div>
                <div className="hist__row">
                  <i />
                  <div>
                    <span className="who">
                      {"Your agent"}
                    </span>
                    {"Chart on slide 5 recreated as a waterfall"}
                  </div>
                  <span className="undo">
                    {"Restore"}
                  </span>
                </div>
                <div className="hist__row">
                  <i />
                  <div>
                    <span className="who">
                      {"Reviewer"}
                    </span>
                    {"Clipped text repaired on slide 4"}
                  </div>
                  <span className="undo">
                    {"Restore"}
                  </span>
                </div>
                <div className="hist__row is-you">
                  <i />
                  <div>
                    <span className="who">
                      {"You"}
                    </span>
                    {"Title edited on slide 2"}
                  </div>
                  <span className="undo">
                    {"Restore"}
                  </span>
                </div>
              </div>
              <div className="checks" data-reveal="true" style={{ "--d": "5" } as CSSProperties}>
                <span>
                  {"Change a number and its badge drops off"}
                </span>
                <span>
                  {"Private files are never named to an audience"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"08"}
          </b>
          <span>
            {"/ 12"}
          </span>
          <i />
          {"Proof"}
        </div>
      </section>
      <section className="slide slide--paper tight" id="brand" data-snap="slide" data-chapter="Bring" data-slide-label="Brand" data-label="Brand">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"Brand & themes"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Your brand, set once."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"Pick a preset or start from your brand colour. Soon Deckster will choose a look that fits the topic, and a brand kit from your logo will dress every new deck."}
            </p>
          </div>
          <div className="themes" style={{ marginTop: "22px" } as CSSProperties} data-reveal="true">
            <div className="themes__left">
              <div className="themes__stage themes__stage--2">
                <div className="shot shot--wide">
                  <img data-theme="dark" className="is-on" src="/marketing/v3-uat/slides/theme-hero-dark-slide-01.jpg" alt="Dark look, slide 1" aria-hidden="false" width="1280" height="720" />
                  <img data-theme="vibrant" src="/marketing/v3-uat/slides/theme-hero-vibrant-slide-01.jpg" alt="Vibrant look, slide 1" aria-hidden="true" width="1280" height="720" loading="lazy" />
                  <img data-theme="abstract" src="/marketing/v3-uat/slides/theme-abstract-slide-01.jpg" alt="Abstract look, slide 1" aria-hidden="true" width="1280" height="720" loading="lazy" />
                  <img data-theme="industrial" src="/marketing/v3-uat/slides/theme-industrial-slide-01.jpg" alt="Industrial look, slide 1" aria-hidden="true" width="1280" height="720" loading="lazy" />
                </div>
                <div className="shot">
                  <img data-theme="dark" className="is-on" src="/marketing/v3-uat/slides/theme-hero-dark-slide-02.jpg" alt="Dark look, slide 2" aria-hidden="false" width="1280" height="720" />
                  <img data-theme="vibrant" src="/marketing/v3-uat/slides/theme-hero-vibrant-slide-02.jpg" alt="Vibrant look, slide 2" aria-hidden="true" width="1280" height="720" loading="lazy" />
                  <img data-theme="abstract" src="/marketing/v3-uat/slides/theme-abstract-slide-02.jpg" alt="Abstract look, slide 2" aria-hidden="true" width="1280" height="720" loading="lazy" />
                  <img data-theme="industrial" src="/marketing/v3-uat/slides/theme-industrial-slide-02.jpg" alt="Industrial look, slide 2" aria-hidden="true" width="1280" height="720" loading="lazy" />
                </div>
              </div>
              <ul className="studio__list studio__list--wide">
                <li>
                  <span>
                    {"Presets, your brand colour, a saved standard theme"}
                  </span>
                  <span className="st st--sm st--live">
                    {"Live"}
                  </span>
                </li>
                <li>
                  <span>
                    {"A look chosen to fit the topic"}
                  </span>
                  <span className="st st--sm st--build">
                    {"Coming"}
                  </span>
                </li>
                <li>
                  <span>
                    {"A kit read from your logo; your hex values kept exactly"}
                  </span>
                  <span className="st st--sm st--build">
                    {"Coming"}
                  </span>
                </li>
                <li>
                  <span>
                    {"Switch a finished deck to a new theme"}
                  </span>
                  <span className="st st--sm st--planned">
                    {"Later"}
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <div className="tswitch" data-theme-switch="true">
                <button type="button" data-theme="dark" className="is-on" aria-pressed="true">
                  <span className="sw" aria-hidden="true">
                    <i style={{ background: "#0f2027" } as CSSProperties} />
                    <i style={{ background: "#1e6f79" } as CSSProperties} />
                    <i style={{ background: "#d3eef2" } as CSSProperties} />
                  </span>
                  <div>
                    <b>
                      {"Dark"}
                    </b>
                    <span>
                      {"same title, a different look"}
                    </span>
                  </div>
                </button>
                <button type="button" data-theme="vibrant" aria-pressed="false">
                  <span className="sw" aria-hidden="true">
                    <i style={{ background: "#2a2158" } as CSSProperties} />
                    <i style={{ background: "#b58c4a" } as CSSProperties} />
                    <i style={{ background: "#e9d8ff" } as CSSProperties} />
                  </span>
                  <div>
                    <b>
                      {"Vibrant"}
                    </b>
                    <span>
                      {"warm metallics on ink"}
                    </span>
                  </div>
                </button>
                <button type="button" data-theme="abstract" aria-pressed="false">
                  <span className="sw" aria-hidden="true">
                    <i style={{ background: "#5f7f8a" } as CSSProperties} />
                    <i style={{ background: "#c9a227" } as CSSProperties} />
                    <i style={{ background: "#8b2252" } as CSSProperties} />
                  </span>
                  <div>
                    <b>
                      {"Abstract"}
                    </b>
                    <span>
                      {"painterly title slides"}
                    </span>
                  </div>
                </button>
                <button type="button" data-theme="industrial" aria-pressed="false">
                  <span className="sw" aria-hidden="true">
                    <i style={{ background: "#1b1b1b" } as CSSProperties} />
                    <i style={{ background: "#6b7280" } as CSSProperties} />
                    <i style={{ background: "#f59e0b" } as CSSProperties} />
                  </span>
                  <div>
                    <b>
                      {"Industrial"}
                    </b>
                    <span>
                      {"steel and signal orange"}
                    </span>
                  </div>
                </button>
              </div>
              <div className="kit">
                <div className="kit__hd">
                  <b>
                    {"Brand kit"}
                  </b>
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </div>
                <div className="kit__row">
                  <span className="k4">
                    {"Logo"}
                  </span>
                  <span>
                    <span className="kit__logo">
                      <i />
                      {"Northbank"}
                    </span>
                  </span>
                </div>
                <div className="kit__row">
                  <span className="k4">
                    {"Colours"}
                  </span>
                  <span className="kit__sw">
                    <i style={{ background: "#16203A" } as CSSProperties}>
                      {"#16203A"}
                    </i>
                    <i style={{ background: "#385B9D" } as CSSProperties}>
                      {"#385B9D"}
                    </i>
                    <i style={{ background: "#E8A013" } as CSSProperties}>
                      {"#E8A013"}
                    </i>
                    <i className="l" style={{ background: "#F1F4F9" } as CSSProperties}>
                      {"#F1F4F9"}
                    </i>
                  </span>
                </div>
                <div className="kit__row">
                  <span className="k4">
                    {"Type"}
                  </span>
                  <span className="kit__type">
                    <b>
                      {"Inter Tight"}
                    </b>
                    {" headings · Inter body"}
                  </span>
                </div>
                <div className="kit__row">
                  <span className="k4">
                    {"Footer"}
                  </span>
                  <span className="kit__foot">
                    <span>
                      {"Northbank · Confidential"}
                    </span>
                    <span>
                      {"5 / 16"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"09"}
          </b>
          <span>
            {"/ 12"}
          </span>
          <i />
          {"Brand"}
        </div>
      </section>
      <section className="slide slide--night compact" id="present" data-snap="slide" data-chapter="Present" data-slide-label="Present" data-label="Present">
        <div className="glow glow--coral" style={{ width: "50vw", height: "50vw", right: "-14vw", top: "-10vh", opacity: "0.28" } as CSSProperties} />
        <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", left: "-16vw", bottom: "-20vh", opacity: "0.35" } as CSSProperties} />
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow eyebrow--you" data-reveal="true">
              {"Present"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Publish it. Then let it present with you."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"One button gives your deck a link, a passcode and the downloads you allow. It answers viewers from your slides and documents, and narrates itself. Next, a companion presents it aloud with you."}
            </p>
          </div>
          <div className="pub pub--sm" style={{ marginTop: "24px" } as CSSProperties} data-reveal="true">
            <div className="player">
              <div className="player__url">
                <span className="dots-3" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                {"deckster.xyz/p/"}
                <b>
                  {"k3Tq9xV2aB"}
                </b>
                <span className="lock">
                  {"● passcode · 128 views"}
                </span>
              </div>
              <div className="player__slide">
                <img className="is-on" src="/marketing/v3-uat/slides/deck-04.jpg" alt="Slide 11 of the showcase deck: Strengthening the Six Capabilities of Modern Delivery" width="1280" height="720" decoding="async" />
                <img src="/marketing/v3-uat/slides/deck-02.jpg" alt="" width="1280" height="720" loading="lazy" decoding="async" />
                <img src="/marketing/v3-uat/slides/deck-06.jpg" alt="" width="1280" height="720" loading="lazy" decoding="async" />
                <img src="/marketing/v3-uat/slides/deck-07.jpg" alt="" width="1280" height="720" loading="lazy" decoding="async" />
                <img src="/marketing/v3-uat/slides/deck-11.jpg" alt="" width="1280" height="720" loading="lazy" decoding="async" />
                <img src="/marketing/v3-uat/slides/deck-12.jpg" alt="" width="1280" height="720" loading="lazy" decoding="async" />
                <span className="player__cap">
                  {"Slide 11 of 16"}
                </span>
                <span className="companion">
                  <span className="face face--sm face--cast">
                    <img className="castp" src="/marketing/v4/cast/ollie.webp" alt="" width="320" height="320" loading="lazy" />
                  </span>
                  <span>
                    <span className="k4">
                      {"Companion · coming"}
                    </span>
                    {"“Six capabilities carry the model. Start with decision rights.”"}
                  </span>
                </span>
              </div>
              <div className="player__bar">
                <span className="play" aria-hidden="true">
                  <svg width="12" height="14" viewBox="0 0 12 14">
                    <path d="M0 0l12 7-12 7z" fill="currentColor" />
                  </svg>
                </span>
                <Waveform count={40} />
                <span className="player__t">
                  {"narrated · 12 min"}
                </span>
                <span className="player__voice player__voice--live">
                  {"Narration"}
                </span>
              </div>
            </div>
            <AudienceQA copy={c.present.qa} status={statusOf(c.present.qa.feature)} />
          </div>
          <div className="ladder ladder--5 pub--sm" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
            <div>
              <span className="st st--live">
                {"Live"}
              </span>
              {"Publish · link or passcode, the downloads you allow, view count"}
            </div>
            <div>
              <span className="st st--live">
                {"Live"}
              </span>
              {"Questions · answered from your slides and documents"}
            </div>
            <div>
              <span className="st st--live">
                {"Live"}
              </span>
              {"Narration · nine stock voices, fitted to your time"}
            </div>
            <div>
              <span className="st st--build">
                {"Coming"}
              </span>
              {"Present with an agent · a companion speaks each slide and takes questions"}
            </div>
            <div>
              <span className="st st--planned">
                {"Later"}
              </span>
              {"Live meetings · joins Zoom, Meet or Teams"}
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"10"}
          </b>
          <span>
            {"/ 12"}
          </span>
          <i />
          {"Present"}
        </div>
      </section>
      <section className="slide slide--paper" id="pricing" data-snap="slide" data-chapter="Plans" data-slide-label="Pricing" data-label="Pricing">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"Pricing · early access"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Priced for how often you present."}
            </h2>
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
          <p className="small center" style={{ marginTop: "16px", "--d": "4" } as CSSProperties} data-reveal="true">
            {"One credit is one cent of building; a long, researched deck uses more than a short update. Top-ups of $10, $25 or $50 never expire. "}
            <Link href="/pricing" className="">
              <span style={{ color: "var(--accent)", fontWeight: "600" } as CSSProperties}>
                {"Full pricing page →"}
              </span>
            </Link>
          </p>
        </div>
        <div className="slide__chip">
          <b>
            {"11"}
          </b>
          <span>
            {"/ 12"}
          </span>
          <i />
          {"Pricing"}
        </div>
      </section>
      <section className="slide slide--night" id="close" data-snap="slide" data-chapter="Plans" data-slide-label="Begin" data-label="Begin">
        <div className="glow glow--violet" style={{ width: "60vw", height: "60vw", left: "20vw", top: "-20vh", opacity: "0.4" } as CSSProperties} />
        <div className="glow glow--coral" style={{ width: "36vw", height: "36vw", right: "-8vw", bottom: "0", opacity: "0.3" } as CSSProperties} />
        <div className="dots" />
        <div className="grain" />
        <div className="slide__inner center">
          <span className="eyebrow eyebrow--you" data-reveal="true">
            {"Begin"}
          </span>
          <h2 className="h1 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
            {"Bring your "}
            <CycleWord className="you" words={["next", "board", "sales", "launch"]} />
            {" deck."}
          </h2>
          <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
            {"Give your agent one sentence, or attach the report, spreadsheet or old deck it should start from. You approve the plan before a single slide is built."}
          </p>
          <div className="ctas" style={{ justifyContent: "center", "--d": "3" } as CSSProperties} data-reveal="true">
            <BuildCta className="btn btn--primary" location="v3_close_build">
              {"Request early access "}
              <svg className="arrow" aria-hidden="true">
                <use href="#arrow" />
              </svg>
            </BuildCta>
            <Link href="/build" className="btn btn--ghost">
              {"Meet your agent"}
            </Link>
          </div>
          <p className="truthline" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
            <Link href="/auth/signin">
              {"Have an access code? Sign in with Google and enter it."}
            </Link>
          </p>
        </div>
        <div className="slide__chip">
          <b>
            {"12"}
          </b>
          <span>
            {"/ 12"}
          </span>
          <i />
          {"Begin"}
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
      </section>
    </main>
  )
}
