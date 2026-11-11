/* eslint-disable @next/next/no-img-element */
// Marketing v4 (Present), rendered only with NEXT_PUBLIC_MARKETING_V4=true.
// Converted from the approved mock (Deckster/design-marketing-v4/present.html, tools/port_to_next.py); maintained by hand from here.
// Status pills are plain markup: the wording rules are in components/marketing/v4/content.ts.
import type { CSSProperties } from "react"
import Link from "next/link"
import { BuildCta } from "@/components/marketing/v3-uat/BuildCta"
import { AudienceQA } from "@/components/marketing/v3-uat/AudienceQA"
import { statusOf } from "@/components/marketing/v3-uat/StatusPill"
import { V3_CONTENT } from "@/lib/marketing/v3-uat-view"

export function V4PresentPage() {
  const c = V3_CONTENT
  return (
    <main data-page="present">
      <section className="slide slide--night is-in" id="start" data-snap="slide" data-label="Present" data-slide-label="Present">
        <div className="glow glow--coral" style={{ width: "54vw", height: "54vw", right: "-16vw", top: "-20vw", opacity: "0.3" } as CSSProperties} />
        <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", left: "-18vw", bottom: "-20vw", opacity: "0.4" } as CSSProperties} />
        <div className="dots" />
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols">
            <div>
              <span className="eyebrow eyebrow--you" data-reveal="true">
                {"Present · publish, answer, narrate"}
              </span>
              <h1 className="h1" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"Publish once. "}
                <span className="you">
                  {"Keep presenting."}
                </span>
              </h1>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"Your deck gets a link you control today. It answers your audience's questions from your slides and documents, and can narrate itself in a stock voice you pick. Joining live meetings is planned. Next: your agent presents it aloud with you, and can wear a drawn avatar of you."}
              </p>
              <div className="ctas" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
                <BuildCta className="btn btn--primary" location="v3_hero_build">
                  {"Request early access "}
                  <svg className="arrow" aria-hidden="true">
                    <use href="#arrow" />
                  </svg>
                </BuildCta>
                <a className="btn btn--ghost" href="#four" data-next="true">
                  {"What publishing does"}
                </a>
              </div>
              <div className="facts" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
                <span>
                  {"Link or passcode"}
                </span>
                <span>
                  {"PDF / PowerPoint downloads you allow"}
                </span>
                <span>
                  {"View count and one-click republish"}
                </span>
                <span>
                  {"Unpublish any time"}
                </span>
              </div>
            </div>
            <AudienceQA copy={{ title: c.pages.present.hero.qaHeader, input: c.pages.present.hero.qaInput, sequence: c.pages.present.hero.sequence }} status={statusOf("questions")} keep={6} style={{ minHeight: 420 }} dataRevealDelay={2} />
          </div>
        </div>
        <a className="cue" href="#four" data-next="true">
          {"What publishing does"}
          <i />
        </a>
        <div className="slide__chip">
          <b>
            {"01"}
          </b>
          <span>
            {"/ 07"}
          </span>
          <i />
          {"Present"}
        </div>
      </section>
      <section className="slide slide--paper" id="four" data-snap="slide" data-label="One button" data-slide-label="One button">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"One button"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Publish does more than share."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"What a published deck can do today, and what comes next."}
            </p>
          </div>
          <div className="grid4 grid5" style={{ marginTop: "30px" } as CSSProperties}>
            <div className="card" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
              <span className="st st--live">
                {"Live"}
              </span>
              <h3 className="h3">
                {"Publish"}
              </h3>
              <p>
                {"A link at deckster.xyz/p/…, open to anyone with it, public, or behind a passcode. Allow or block PDF and PowerPoint downloads. See views; republish when the deck changes."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
              <span className="st st--live">
                {"Live"}
              </span>
              <h3 className="h3">
                {"Answer"}
              </h3>
              <p>
                {"Viewers ask in the deck. Answers come from your slides and the documents you allow, with the slide to open. What it can't answer goes to your inbox; promote good answers to an FAQ."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "5" } as CSSProperties}>
              <span className="st st--live">
                {"Live"}
              </span>
              <h3 className="h3">
                {"Narrate"}
              </h3>
              <p>
                {"A script per slide, written to your time budget and recorded in one of nine stock voices. You see the price before recording; edit any line by hand."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "6" } as CSSProperties}>
              <span className="st st--build">
                {"Coming"}
              </span>
              <h3 className="h3">
                {"Present with you"}
              </h3>
              <p>
                {"In the Studio, a companion speaks each slide's script, moves the deck along and takes questions out loud. Cut in whenever you like."}
              </p>
            </div>
            <div className="card" data-reveal="true" style={{ "--d": "7" } as CSSProperties}>
              <span className="st st--planned">
                {"Later"}
              </span>
              <h3 className="h3">
                {"Join meetings"}
              </h3>
              <p>
                {"The deck joins a Zoom, Meet or Teams call as the presenter and takes questions there. Not built yet."}
              </p>
            </div>
          </div>
          <p className="small center" style={{ marginTop: "16px", marginBottom: "14px" } as CSSProperties}>
            {"deckster.xyz/p/"}
            <b>
              {"k3Tq9xV2aB"}
            </b>
            {" · passcode · PDF download allowed · 128 views"}
          </p>
        </div>
        <div className="slide__chip">
          <b>
            {"02"}
          </b>
          <span>
            {"/ 07"}
          </span>
          <i />
          {"One button"}
        </div>
      </section>
      <section className="slide slide--night tight" id="partner" data-snap="slide" data-slide-label="Partner" data-label="Partner">
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols cols--tight">
            <div>
              <span className="eyebrow eyebrow--you" data-reveal="true">
                {"Present with an agent "}
                <span className="st st--build">
                  {"Coming"}
                </span>
              </span>
              <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"Present it with a partner."}
              </h2>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"Ask your agent to present your deck. With the face you chose, or your own avatar, it will speak each slide from the script you approved, move the deck along, and answer questions from your slides and documents. Say stop and it stops."}
              </p>
              <div className="rules" style={{ gridTemplateColumns: "1fr 1fr", "--d": "3" } as CSSProperties} data-reveal="true">
                <div className="rule">
                  <b>
                    {"Your script"}
                  </b>
                  {"It speaks what you approved, slide by slide. Edit any line first."}
                </div>
                <div className="rule">
                  <b>
                    {"Grounded"}
                  </b>
                  {"Answers come from your slides and the documents you allow. Anything else, it says so."}
                </div>
                <div className="rule">
                  <b>
                    {"Stock voices"}
                  </b>
                  {"A drawn companion and a voice you pick. No cloned voices, no video of you."}
                </div>
                <div className="rule">
                  <b>
                    {"In the Studio first"}
                  </b>
                  {"Presenting from a published link comes later."}
                </div>
              </div>
            </div>
            <div data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              <div className="call">
                <div className="call__top">
                  <span className="live" />
                  {"Presenting · slide 4 of 16 "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                  <span className="t">
                    {"04:12"}
                  </span>
                </div>
                <div className="call__stage">
                  <div className="face face--cast">
                    <span className="face__ring" />
                    <video className="castv" muted loop playsInline preload="none" poster="/marketing/v4/cast/lucia.webp" data-src="/marketing/v4/cast/lucia-pointing.webm" width="320" height="320" aria-label="Lucia, a Deckster companion, pointing" />
                  </div>
                  <div className="call__cap">
                    <div>
                      <span className="k4">
                        {"Companion"}
                      </span>
                      <span className="agent">
                        {"Six capabilities carry the model. We start with decision rights."}
                      </span>
                    </div>
                    <div>
                      <span className="k4">
                        {"You"}
                      </span>
                      <span className="you">
                        {"“How does the 48-hour rule handle vendor calls?”"}
                      </span>
                    </div>
                    <div>
                      <span className="k4">
                        {"Companion"}
                      </span>
                      <span className="agent">
                        {"Up to £250k they stay with domain leadership; anything larger escalates after 48 hours. · From slide 6"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="call__cards">
                  <div className="wcard">
                    <b>
                      {"✓"}
                    </b>
                    {"Answered from slide 6 · back to slide 4"}
                  </div>
                </div>
                <div className="call__ctl">
                  <span className="btn btn--ghost">
                    {"Pause"}
                  </span>
                  <span className="btn btn--ghost">
                    {"Next slide"}
                  </span>
                  <span className="btn btn--you">
                    {"Stop"}
                  </span>
                  <span className="small">
                    {"Nothing is recorded."}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"03"}
          </b>
          <span>
            {"/ 07"}
          </span>
          <i />
          {"Partner"}
        </div>
      </section>
      <section className="slide slide--paper tight" id="avatar" data-snap="slide" data-slide-label="Avatar" data-label="Avatar">
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols cols--tight">
            <div>
              <span className="eyebrow eyebrow--you" data-reveal="true">
                {"Spawn your own avatar "}
                <span className="st st--build">
                  {"Coming"}
                </span>
              </span>
              <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"Give your agent "}
                <span className="you you--big">
                  {"your face."}
                </span>
              </h2>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"Upload a photo and Deckster will draw a companion that looks like you, in its own illustrated style. Pick the one that feels right. From then on it can talk with you, build with you and present your deck."}
              </p>
              <div className="rules" style={{ gridTemplateColumns: "1fr 1fr" } as CSSProperties} data-reveal="true">
                <div className="rule">
                  <b>
                    {"Drawn, not photoreal"}
                  </b>
                  {"A warm illustrated likeness. Nobody will mistake it for a video of you."}
                </div>
                <div className="rule">
                  <b>
                    {"Your face, your say"}
                  </b>
                  {"Adults only, and your own face or one you have permission to use. Public figures are refused."}
                </div>
                <div className="rule">
                  <b>
                    {"The photo goes"}
                  </b>
                  {"Your photo is deleted as soon as you pick. Erase the avatar whenever you like."}
                </div>
                <div className="rule">
                  <b>
                    {"A voice you choose"}
                  </b>
                  {"Stock voices only. Your own voice is never cloned."}
                </div>
              </div>
              <p className="note4" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
                <b>
                  {"Plans"}
                </b>
                {" one avatar will be included on the higher plans. Everyone can use the ready-made companions."}
              </p>
            </div>
            <div data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              <div className="spawncard">
                <div className="spawncard__hd">
                  {"Your companion · pick one, or make yours "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </div>
                <div className="spawn spawn--lg">
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
                    <div className="ptile">
                      <img className="castp" src="/marketing/v4/cast/noor.webp" alt="Noor, a Deckster companion" width="320" height="320" loading="lazy" decoding="async" />
                      <span className="ptile__n">
                        {"Noor"}
                      </span>
                    </div>
                    <div className="ptile">
                      <img className="castp" src="/marketing/v4/cast/tao.webp" alt="Tao, a Deckster companion" width="320" height="320" loading="lazy" decoding="async" />
                      <span className="ptile__n">
                        {"Tao"}
                      </span>
                    </div>
                    <div className="ptile">
                      <img className="castp" src="/marketing/v4/cast/ziggy.webp" alt="Ziggy, a Deckster companion" width="320" height="320" loading="lazy" decoding="async" />
                      <span className="ptile__n">
                        {"Ziggy"}
                      </span>
                    </div>
                    <div className="ptile">
                      <img className="castp" src="/marketing/v4/cast/vera.webp" alt="Vera, a Deckster companion" width="320" height="320" loading="lazy" decoding="async" />
                      <span className="ptile__n">
                        {"Vera"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="spawncard__row">
                  <span className="btn btn--you">
                    {"That’s me"}
                  </span>
                  <span className="btn btn--ghost">
                    {"Try again"}
                  </span>
                  <span className="small">
                    {"Glasses and beards are kept."}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"04"}
          </b>
          <span>
            {"/ 07"}
          </span>
          <i />
          {"Avatar"}
        </div>
      </section>
      <section className="slide slide--night" id="grounded" data-snap="slide" data-label="Grounded" data-slide-label="Grounded">
        <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", left: "-12vw", top: "10vh", opacity: "0.35" } as CSSProperties} />
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols cols--rev">
            <div data-reveal="true">
              <div className="steps" style={{ gridTemplateColumns: "1fr", marginTop: "0" } as CSSProperties}>
                <div className="step">
                  <span className="n">
                    {"YOUR SLIDES"}
                  </span>
                  <b>
                    {"Named, with a link"}
                  </b>
                  <p>
                    {"“From slide 6” — the viewer can jump to it."}
                  </p>
                </div>
                <div className="step">
                  <span className="n" style={{ color: "var(--coral-d)" } as CSSProperties}>
                    {"YOUR DOCUMENTS"}
                  </span>
                  <b>
                    {"Used, never named"}
                  </b>
                  <p>
                    {"The audience hears the fact, not the file: “From the presenter's background material.” You choose which documents it may use."}
                  </p>
                </div>
                <div className="step">
                  <span className="n">
                    {"ANYTHING ELSE"}
                  </span>
                  <b>
                    {"Passed to you"}
                  </b>
                  <p>
                    {"“That isn't in this deck. I've passed it to the presenter.” The question waits in your inbox."}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <span className="eyebrow" data-reveal="true">
                {"Grounded, not improvised "}
                <span className="st st--live">
                  {"Live"}
                </span>
              </span>
              <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"It answers what you'd answer. It passes on the rest."}
              </h2>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"Pick an answer style — Professional, Friendly, Concise or Technical. Style never changes what it is willing to say: anything outside your deck and allowed documents goes to your inbox."}
              </p>
              <div className="checks" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
                <span>
                  {"Four answer styles"}
                </span>
                <span>
                  {"Owner inbox: answer, publish to FAQ, or block"}
                </span>
                <span>
                  {"Daily and monthly question caps"}
                </span>
                <span>
                  {"You choose the sources"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"05"}
          </b>
          <span>
            {"/ 07"}
          </span>
          <i />
          {"Grounded"}
        </div>
      </section>
      <section className="slide slide--paper" id="time" data-snap="slide" data-label="Time budget" data-slide-label="Time budget">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"Time is a budget "}
              <span className="st st--live">
                {"Live"}
              </span>
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Questions don't make the talk overrun."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"Narration is recorded in two cuts, sized to the session you set, with time held for questions. If the clock runs short, the rest of the deck switches to the short cut — and it tells the room."}
            </p>
          </div>
          <div className="tl" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
            <div className="tl__row">
              <span className="tl__k">
                {"Full cut"}
              </span>
              <div className="tl__bar">
                <i style={{ flex: "1" } as CSSProperties} />
                <i style={{ flex: "1.3" } as CSSProperties} />
                <i style={{ flex: "0.8" } as CSSProperties} />
                <i style={{ flex: "1.6" } as CSSProperties} />
                <i style={{ flex: "1" } as CSSProperties} />
                <i style={{ flex: "1.2" } as CSSProperties} />
                <i style={{ flex: "0.9" } as CSSProperties} />
                <i style={{ flex: "1.1" } as CSSProperties} />
                <i style={{ flex: "1.4" } as CSSProperties} />
                <i style={{ flex: "0.7" } as CSSProperties} />
                <i style={{ flex: "1" } as CSSProperties} />
                <i className="close" style={{ flex: "0.9" } as CSSProperties} />
              </div>
              <span className="tl__t">
                {"12:00"}
              </span>
            </div>
            <div className="tl__row">
              <span className="tl__k">
                {"Short cut"}
              </span>
              <div className="tl__bar">
                <i className="lo" style={{ flex: "0.5" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.65" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.4" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.8" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.5" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.6" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.45" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.55" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.7" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.35" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.5" } as CSSProperties} />
                <i className="close" style={{ flex: "0.9" } as CSSProperties} />
              </div>
              <span className="tl__t">
                {"06:30"}
              </span>
            </div>
            <div className="tl__row">
              <span className="tl__k">
                {"With questions"}
              </span>
              <div className="tl__bar">
                <i style={{ flex: "1" } as CSSProperties} />
                <i className="close" style={{ flex: "0.5", opacity: "0.5" } as CSSProperties} />
                <i style={{ flex: "1.3" } as CSSProperties} />
                <i style={{ flex: "0.8" } as CSSProperties} />
                <i className="close" style={{ flex: "0.6", opacity: "0.5" } as CSSProperties} />
                <i style={{ flex: "1.6" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.6" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.45" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.55" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.7" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.35" } as CSSProperties} />
                <i className="lo" style={{ flex: "0.5" } as CSSProperties} />
                <i className="close" style={{ flex: "0.9" } as CSSProperties} />
              </div>
              <span className="tl__t">
                {"12:00"}
              </span>
            </div>
          </div>
          <div className="checks" style={{ justifyContent: "center", "--d": "4" } as CSSProperties} data-reveal="true">
            <span>
              {"Session length + time held for questions"}
            </span>
            <span>
              {"Switches to the short cut when needed"}
            </span>
            <span>
              {"Closes on time"}
            </span>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"06"}
          </b>
          <span>
            {"/ 07"}
          </span>
          <i />
          {"Time budget"}
        </div>
      </section>
      <section className="slide slide--night" id="close" data-snap="slide" data-label="Begin" data-slide-label="Begin">
        <div className="glow glow--coral" style={{ width: "50vw", height: "50vw", left: "25vw", top: "-20vh", opacity: "0.3" } as CSSProperties} />
        <div className="dots" />
        <div className="grain" />
        <div className="slide__inner center">
          <span className="eyebrow eyebrow--you" data-reveal="true">
            {"Begin"}
          </span>
          <h2 className="h1 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
            {"Publish your "}
            <span className="you">
              {"first"}
            </span>
            {" deck."}
          </h2>
          <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
            {"Build it with the team, press one button, and share the link."}
          </p>
          <div className="ctas" style={{ justifyContent: "center", "--d": "3" } as CSSProperties} data-reveal="true">
            <BuildCta className="btn btn--primary" location="v3_close_build">
              {"Request early access "}
              <svg className="arrow" aria-hidden="true">
                <use href="#arrow" />
              </svg>
            </BuildCta>
            <Link href="/pricing" className="btn btn--ghost">
              {"See pricing"}
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
            {"07"}
          </b>
          <span>
            {"/ 07"}
          </span>
          <i />
          {"Begin"}
        </div>
      </section>
    </main>
  )
}
