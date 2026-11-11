/* eslint-disable @next/next/no-img-element */
// Marketing v4 (Build), rendered only with NEXT_PUBLIC_MARKETING_V4=true.
// Converted from the approved mock (Deckster/design-marketing-v4/build.html, tools/port_to_next.py); maintained by hand from here.
// Status pills are plain markup: the wording rules are in components/marketing/v4/content.ts.
import type { CSSProperties } from "react"
import Link from "next/link"
import { BuildCta } from "@/components/marketing/v3-uat/BuildCta"

export function V4BuildPage() {
  return (
    <main data-page="build">
      <section className="slide slide--night" id="start" data-snap="slide" data-slide-label="Build" data-label="Build">
        <div className="glow glow--violet" style={{ width: "58vw", height: "58vw", left: "-22vw", top: "-28vw", opacity: ".42" } as CSSProperties} />
        <div className="glow glow--coral" style={{ width: "44vw", height: "44vw", right: "-16vw", bottom: "-22vw", opacity: ".3" } as CSSProperties} />
        <div className="dots" />
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols">
            <div>
              <span className="eyebrow eyebrow--you" data-reveal="true">
                {"Build · with your agent"}
              </span>
              <h1 className="h1" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"Talk to it."}
                <br />
                <span className="you">
                  {"Point at it."}
                </span>
                <br />
                {"Hand it over."}
              </h1>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"Your agent builds the deck with you, three ways. Brief it by chat today, and soon on a call. Point at a slide and say what should change. Or hand it the whole build and let it check its own work. Take the wheel back whenever you like."}
              </p>
              <div className="ctas" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
                <BuildCta className="btn btn--primary" location="v3_hero_build">
                  {"Request early access "}
                  <svg className="arrow" aria-hidden="true">
                    <use href="#arrow" />
                  </svg>
                </BuildCta>
                <a className="btn btn--ghost" href="#talk" data-next="true">
                  {"See it work"}
                </a>
              </div>
              <div className="trust" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
                <span>
                  {"Your yes before anything is built"}
                </span>
                <span>
                  {"Every slide stays editable"}
                </span>
                <span>
                  {"Costs shown before you spend"}
                </span>
              </div>
            </div>
            <div data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              <div className="ways">
                <div className="way is-on">
                  <div className="way__k">
                    <span className="k4">
                      {"Talk"}
                    </span>
                    <b>
                      <span className="you" style={{ fontSize: "1.15em" } as CSSProperties}>
                        {"Say it."}
                      </span>
                    </b>
                    <span className="st st--live st--sm">
                      {"Live"}
                    </span>
                  </div>
                  <div className="way__d">
                    <span className="you">
                      {"“Build a 12-slide review from my Q3 board pack.”"}
                    </span>
                    <span className="agent">
                      {"Your agent · here’s the plan: 3 sections, 12 slides"}
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
                        <i style={{ "--a": "44" } as CSSProperties} />
                        <i style={{ "--a": "60" } as CSSProperties} />
                      </span>
                      {"Edits by chat, calls and video "}
                      <span className="st st--build st--sm">
                        {"Coming"}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="way">
                  <div className="way__k">
                    <span className="k4">
                      {"Point"}
                    </span>
                    <b>
                      {"Show it."}
                    </b>
                    <span className="st st--build st--sm">
                      {"Coming"}
                    </span>
                  </div>
                  <div className="way__d">
                    <span className="mini">
                      <img src="/marketing/v4/decks/a2-06.jpg" alt="" width="1280" height="718" />
                      <i className="mini__sel" data-l="This one" style={{ left: "27.6%", top: "33%", width: "13.6%", height: "45%" } as CSSProperties} />
                    </span>
                    <span className="agent">
                      {"Pick any part of a slide, then say what should change"}
                    </span>
                  </div>
                </div>
                <div className="way">
                  <div className="way__k">
                    <span className="k4">
                      {"By hand"}
                    </span>
                    <b>
                      {"Click it."}
                    </b>
                    <span className="st st--live st--sm">
                      {"Live"}
                    </span>
                  </div>
                  <div className="way__d">
                    <span className="agent">
                      {"Any text, chart, diagram or layout is yours to edit on the canvas"}
                    </span>
                  </div>
                </div>
                <div className="way">
                  <div className="way__k">
                    <span className="k4">
                      {"By agent"}
                    </span>
                    <b>
                      {"Hand it over."}
                    </b>
                    <span className="st st--build st--sm">
                      {"Coming"}
                    </span>
                  </div>
                  <div className="way__d">
                    <span className="run">
                      <span>
                        <b>
                          {"✓"}
                        </b>
                        {"Designed 12 slides"}
                      </span>
                      <span>
                        <b>
                          {"✓"}
                        </b>
                        {"Checked 12 · repaired 2"}
                      </span>
                    </span>
                    <span className="meter">
                      {"Credits"}
                      <i style={{ "--v": "64" } as CSSProperties} />
                      {"inside its cap"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <a className="cue" href="#talk" data-next="true">
          {"Talk to it"}
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
          {"Build"}
        </div>
      </section>
      <section className="slide slide--night tight" id="talk" data-snap="slide" data-slide-label="Talk" data-label="Talk">
        <div className="glow glow--violet" style={{ width: "52vw", height: "52vw", left: "-16vw", top: "-10vh", opacity: ".4" } as CSSProperties} />
        <div className="glow glow--coral" style={{ width: "40vw", height: "40vw", right: "-14vw", bottom: "-18vh", opacity: ".26" } as CSSProperties} />
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow eyebrow--you" data-reveal="true">
              {"Talk to your agent "}
              <span className="st st--build">
                {"Coming"}
              </span>
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Call it. See it. Point at the slide."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"Start a call from your laptop or your phone. Your agent will keep working while you talk, show the deck changing as it goes, and drop a card in the chat for each thing it finishes."}
            </p>
          </div>
          <div className="talkrow" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
            <div className="astage">
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
                      <video className="castv" muted loop playsInline preload="none" poster="/marketing/v4/cast/gabe.webp" data-src="/marketing/v4/cast/gabe-talking.webm" width="320" height="320" aria-label="Gabe, a Deckster companion, talking" />
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
            </div>
            <div className="phone phone--lg" aria-hidden="true">
              <div className="phone__scr">
                <span className="phone__k">
                  {"Your agent · on a call"}
                </span>
                <span className="phone__face">
                  <video className="castv" muted loop playsInline preload="none" poster="/marketing/v4/cast/tao.webp" data-src="/marketing/v4/cast/tao-talking.webm" width="320" height="320" aria-label="Tao, a Deckster companion, talking" />
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
            <div className="rules">
              <div className="rule">
                <b>
                  {"A face and a voice"}
                </b>
                {"A drawn companion you pick, or soon your own avatar, with a stock voice. Captions run underneath."}
              </div>
              <div className="rule">
                <b>
                  {"It shows its work"}
                </b>
                {"The slide you are talking about is on screen. Point at a part and say what you want."}
              </div>
              <div className="rule">
                <b>
                  {"Hold to talk first"}
                </b>
                {"Push to talk at the start, hands-free after. Replies begin after a second or two."}
              </div>
              <div className="rule">
                <b>
                  {"Nothing kept"}
                </b>
                {"Your speech becomes text for the agent. The audio is not stored."}
              </div>
            </div>
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
          {"Talk"}
        </div>
      </section>
      <section className="slide slide--paper tight" id="say" data-snap="slide" data-slide-label="Chat" data-label="Chat">
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols cols--top">
            <div>
              <span className="eyebrow eyebrow--you" data-reveal="true">
                {"Conversational mode "}
                <span className="st st--build">
                  {"Coming"}
                </span>
              </span>
              <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"Anything you can click, you can say."}
              </h2>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"Add a slide, change a chart, restyle the deck, rewrite the notes, export. Soon you will ask your agent in plain words and watch it happen in the deck. Today these are clicks in the studio."}
              </p>
              <div className="says" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
                <div className="say">
                  <span className="you">
                    {"“Add a slide after 4 comparing latency by team.”"}
                  </span>
                  <span className="agent">
                    {"Your agent · slide 5 added in your theme"}
                  </span>
                  <span className="wcard" style={{ padding: "0", border: "0", background: "none" } as CSSProperties}>
                    <span className="undo">
                      {"Undo"}
                    </span>
                  </span>
                </div>
                <div className="say">
                  <span className="you">
                    {"“Make this chart a waterfall.”"}
                  </span>
                  <span className="agent">
                    {"Refine element · data, labels and source kept"}
                  </span>
                  <span className="wcard" style={{ padding: "0", border: "0", background: "none" } as CSSProperties}>
                    <span className="undo">
                      {"Undo"}
                    </span>
                  </span>
                </div>
                <div className="say">
                  <span className="you">
                    {"“Trim the notes on slide 7 to one minute.”"}
                  </span>
                  <span className="agent">
                    {"Speaker notes rewritten · 142 words"}
                  </span>
                  <span className="wcard" style={{ padding: "0", border: "0", background: "none" } as CSSProperties}>
                    <span className="undo">
                      {"Undo"}
                    </span>
                  </span>
                </div>
                <div className="say">
                  <span className="you">
                    {"“Put the whole deck in our navy and gold.”"}
                  </span>
                  <span className="agent">
                    {"Theme applied · 16 slides"}
                  </span>
                  <span className="wcard" style={{ padding: "0", border: "0", background: "none" } as CSSProperties}>
                    <span className="undo">
                      {"Undo"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
            <div data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
              <div className="confirm">
                <span className="k4" style={{ color: "var(--you)" } as CSSProperties}>
                  {"Always asks first"}
                </span>
                <b style={{ marginTop: "8px" } as CSSProperties}>
                  {"Publish “Operating-model review” to a link?"}
                </b>
                <p>
                  {"Anything that cannot be undone, like publishing or deleting a deck, never happens from a sentence alone. You confirm it on a card."}
                </p>
                <span className="btn btn--you">
                  {"Publish"}
                </span>
                <span className="btn btn--ghost">
                  {"Not now"}
                </span>
              </div>
              <div className="rules rules--2">
                <div className="rule">
                  <b>
                    {"One conversation"}
                  </b>
                  {"Typed or spoken, it is the same agent and the same deck. The slide you are talking about comes into view."}
                </div>
                <div className="rule">
                  <b>
                    {"Undo, always"}
                  </b>
                  {"Every change made by chat can be undone from the chat."}
                </div>
              </div>
              <div className="keep">
                <b>
                  {"Stays as clicks, on purpose"}
                </b>
                {"Billing and plans, your account, signing out. Your agent tells you where they are; it never does them for you."}
              </div>
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
          {"Chat"}
        </div>
      </section>
      <section className="slide slide--paper tight" id="agent" data-snap="slide" data-slide-label="Agent mode" data-label="Agent mode">
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols cols--top">
            <div>
              <span className="eyebrow" data-reveal="true">
                {"Agent mode "}
                <span className="st st--build">
                  {"Coming"}
                </span>
              </span>
              <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"Hand it over. It checks its own work."}
              </h2>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"Approve the outline, then let your agent run the build. It will choose layouts and templates, look at every finished slide the way you would, rebuild the ones that fall short, and tell you what it did."}
              </p>
              <div className="rules rules--2" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
                <div className="rule">
                  <b>
                    {"A cap, always"}
                  </b>
                  {"You see an estimate and a cap before it starts. It stops at the cap and keeps the slides it finished."}
                </div>
                <div className="rule">
                  <b>
                    {"No silent fallback"}
                  </b>
                  {"If it cannot finish, it says so. It never quietly switches to something cheaper."}
                </div>
                <div className="rule" style={{ gridColumn: "1/-1" } as CSSProperties}>
                  <b>
                    {"Still editable"}
                  </b>
                  {"What comes back is a normal Deckster deck. Every slide is yours to change."}
                </div>
              </div>
              <p className="note4" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
                {"The loop, step by step: "}
                <Link href="/experts#agent" style={{ color: "var(--accent)", fontWeight: "600" } as CSSProperties}>
                  {"design → check → repair → report"}
                </Link>
              </p>
            </div>
            <div data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              <div className="runcard">
                <div className="runcard__bar">
                  {"Agent build · 12 slides "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </div>
                <div className="runcard__body">
                  <div className="run">
                    <span>
                      <b>
                        {"✓"}
                      </b>
                      {"Outline approved by you "}
                      <em>
                        {"· estimate 420 credits · cap 600"}
                      </em>
                    </span>
                    <span>
                      <b>
                        {"✓"}
                      </b>
                      {"Designed 12 slides "}
                      <em>
                        {"· 3 from your templates"}
                      </em>
                    </span>
                    <span>
                      <b>
                        {"✓"}
                      </b>
                      {"Checked 12 "}
                      <em>
                        {"· 2 fell short: a clipped title, a repeated layout"}
                      </em>
                    </span>
                    <span>
                      <b>
                        {"✓"}
                      </b>
                      {"Repaired slide 6 and slide 9 "}
                      <em>
                        {"· checked again, both pass"}
                      </em>
                    </span>
                    <span className="is-now">
                      <b>
                        {"›"}
                      </b>
                      {"Report · 12 slides, 2 repairs, 431 credits"}
                    </span>
                  </div>
                  <div className="meter" style={{ marginTop: "14px" } as CSSProperties}>
                    {"431 / 600"}
                    <i style={{ "--v": "72" } as CSSProperties} />
                    {"inside its cap"}
                  </div>
                </div>
                <div className="runcard__ctl">
                  <span className="btn btn--ghost">
                    {"Pause"}
                  </span>
                  <span className="btn btn--ghost">
                    {"Stop"}
                  </span>
                  <span className="small">
                    {"Stop any time. "}
                    <b>
                      {"Finished slides stay."}
                    </b>
                  </span>
                </div>
              </div>
              <p className="small" style={{ marginTop: "10px" } as CSSProperties}>
                {"Numbers shown are an example."}
              </p>
            </div>
          </div>
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
      <section className="slide slide--paper tight" id="modes" data-snap="slide" data-slide-label="Modes" data-label="Modes">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"Three build modes"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Pick who does the designing."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"Every deck starts the same way: you brief your agent and approve the plan. Then choose how the slides get made."}
            </p>
          </div>
          <div className="tscroll" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
            <table className="matrix matrix--modes">
              <thead>
                <tr>
                  <th />
                  <th>
                    {"Standard "}
                    <span className="st st--live st--sm">
                      {"Live"}
                    </span>
                  </th>
                  <th>
                    {"Author mode "}
                    <span className="st st--build st--sm">
                      {"Coming"}
                    </span>
                  </th>
                  <th>
                    {"Agent mode "}
                    <span className="st st--build st--sm">
                      {"Coming"}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    {"Who builds"}
                  </td>
                  <td>
                    <b>
                      {"A team of specialists."}
                    </b>
                    {" Your agent hands each slide to research, writing, charts and design."}
                  </td>
                  <td>
                    <b>
                      {"One frontier model."}
                    </b>
                    {" It writes each slide as a single designed page."}
                  </td>
                  <td>
                    <b>
                      {"Your agent, with judgment."}
                    </b>
                    {" It picks layouts and templates, then checks and repairs every slide."}
                  </td>
                </tr>
                <tr>
                  <td>
                    {"You can edit"}
                  </td>
                  <td>
                    {"Everything: text, charts, diagrams, layout."}
                  </td>
                  <td>
                    {"The outline and the text at first. Only the slides you change are rebuilt."}
                  </td>
                  <td>
                    {"Everything. It builds normal Deckster slides."}
                  </td>
                </tr>
                <tr>
                  <td>
                    {"Good for"}
                  </td>
                  <td>
                    {"Most decks."}
                  </td>
                  <td>
                    {"A deck that has to look like nothing else."}
                  </td>
                  <td>
                    {"Long or high-stakes decks you want checked before you look."}
                  </td>
                </tr>
                <tr>
                  <td>
                    {"Cost"}
                  </td>
                  <td>
                    {"The least."}
                  </td>
                  <td>
                    {"More. You see it first."}
                  </td>
                  <td>
                    {"The most, with an estimate and a cap."}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="note4" style={{ textAlign: "center" } as CSSProperties} data-reveal="true">
            {"Author mode and agent mode will arrive on the higher plans first. "}
            <Link href="/pricing" style={{ color: "var(--accent)", fontWeight: "600" } as CSSProperties}>
              {"See pricing →"}
            </Link>
          </p>
        </div>
        <div className="slide__chip">
          <b>
            {"05"}
          </b>
          <span>
            {"/ 06"}
          </span>
          <i />
          {"Modes"}
        </div>
      </section>
      <section className="slide slide--night" id="close" data-snap="slide" data-slide-label="Begin" data-label="Begin">
        <div className="glow glow--violet" style={{ width: "60vw", height: "60vw", left: "20vw", top: "-20vh", opacity: ".4" } as CSSProperties} />
        <div className="glow glow--coral" style={{ width: "36vw", height: "36vw", right: "-8vw", bottom: "0", opacity: ".3" } as CSSProperties} />
        <div className="dots" />
        <div className="grain" />
        <div className="slide__inner center">
          <span className="eyebrow eyebrow--you" data-reveal="true">
            {"Begin"}
          </span>
          <h2 className="h1 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
            {"Take the wheel. "}
            <span className="you">
              {"Or don't."}
            </span>
          </h2>
          <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
            {"One sentence to your agent is enough to start. Decide later how much of the driving you want to do."}
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
