/* eslint-disable @next/next/no-img-element */
// Marketing v4 (Bring), rendered only with NEXT_PUBLIC_MARKETING_V4=true.
// Converted from the approved mock (Deckster/design-marketing-v4/bring.html, tools/port_to_next.py); maintained by hand from here.
// Status pills are plain markup: the wording rules are in components/marketing/v4/content.ts.
import type { CSSProperties } from "react"
import Link from "next/link"
import { BuildCta } from "@/components/marketing/v3-uat/BuildCta"

export function V4BringPage() {
  return (
    <main data-page="bring">
      <section className="slide slide--night is-in" id="start" data-snap="slide" data-label="Bring" data-slide-label="Bring">
        <div className="glow glow--coral" style={{ width: "56vw", height: "56vw", left: "-20vw", top: "-24vw", opacity: "0.32" } as CSSProperties} />
        <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", right: "-18vw", bottom: "-20vw", opacity: "0.4" } as CSSProperties} />
        <div className="dots" />
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols">
            <div>
              <span className="eyebrow eyebrow--you" data-reveal="true">
                {"Bring · sources, templates, brand, outside designs"}
              </span>
              <h1 className="h1" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"Bring what you've "}
                <span className="you">
                  {"already"}
                </span>
                {" made."}
              </h1>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"Your best material is already on your laptop. Attach reports and spreadsheets as sources, set your brand as the theme, and turn a past PowerPoint into a template you can reuse. Soon, a slide made anywhere else can come in too."}
              </p>
              <div className="ctas" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
                <BuildCta className="btn btn--primary" location="v3_hero_build">
                  {"Request early access "}
                  <svg className="arrow" aria-hidden="true">
                    <use href="#arrow" />
                  </svg>
                </BuildCta>
                <a className="btn btn--ghost" href="#how" data-next="true">
                  {"See a template being made"}
                </a>
              </div>
              <div className="trust" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
                <span>
                  {"PDF, Word, PowerPoint and spreadsheets as sources"}
                </span>
                <span>
                  {"Templates from .pptx (beta)"}
                </span>
                <span>
                  {"Images kept at their own resolution"}
                </span>
                <span>
                  {"Outside designs (coming)"}
                </span>
              </div>
            </div>
            <div data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              <div className="abs abs--dim">
                <img src="/marketing/v3-uat/slides/deck-04.jpg" alt="Slide 11 of the showcase deck: Strengthening the Six Capabilities of Modern Delivery" width="1280" height="720" />
                <i className="role" data-r="eyebrow" style={{ left: "3%", top: "3%", width: "10%", height: "5%" } as CSSProperties} />
                <i className="role" data-r="title" style={{ left: "3%", top: "8%", width: "62%", height: "8%" } as CSSProperties} />
                <i className="role" data-r="cards ×3" style={{ left: "3%", top: "19%", width: "26%", height: "68%" } as CSSProperties} />
                <i className="role" data-r="hex cluster" style={{ left: "32%", top: "19%", width: "36%", height: "68%" } as CSSProperties} />
                <i className="role" data-r="cards ×3" style={{ left: "71%", top: "19%", width: "26%", height: "68%" } as CSSProperties} />
                <i className="role" data-r="takeaway band" style={{ left: "3%", top: "89%", width: "94%", height: "5%" } as CSSProperties} />
                <span className="cap">
                  {"Read as a template · slide 4 of 16"}
                </span>
              </div>
              <div className="k-row">
                <span className="pill">
                  {"Upload"}
                </span>
                <span className="pill">
                  {"Read"}
                </span>
                <span className="pill">
                  {"Use as it was"}
                </span>
                <span className="pill">
                  {"New topic "}
                  <span className="st st--build st--sm">
                    {"Coming"}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <a className="cue" href="#how" data-next="true">
          {"How it works"}
          <i />
        </a>
        <div className="slide__chip">
          <b>
            {"01"}
          </b>
          <span>
            {"/ 08"}
          </span>
          <i />
          {"Bring"}
        </div>
      </section>
      <section className="slide slide--paper" id="how" data-snap="slide" data-label="Template" data-slide-label="Template">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"From deck to template "}
              <span className="st st--beta">
                {"Beta"}
              </span>
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"A deck you've given becomes a template you can reuse."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"Add a PowerPoint to your template library. Deckster reads every slide's layout, roles and theme, keeps its images at their own resolution, and opens it as an editable deck."}
            </p>
          </div>
          <div className="steps">
            <div className="step" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
              <span className="n">
                {"01 · ADD"}
              </span>
              <b>
                {"Upload a .pptx"}
              </b>
              <p>
                {"One PowerPoint at a time, up to 100 MB. PDF templates are not ready yet."}
              </p>
              <span className="you">
                {"“Here's our June board pack.”"}
              </span>
            </div>
            <div className="step" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
              <span className="n">
                {"02 · READ"}
              </span>
              <b>
                {"Layout, roles, theme"}
              </b>
              <p>
                {"Each slide is split into its parts — heading, cards, chart, takeaway — and the theme comes with it."}
              </p>
            </div>
            <div className="step" data-reveal="true" style={{ "--d": "5" } as CSSProperties}>
              <span className="n">
                {"03 · USE AS IT WAS"}
              </span>
              <b>
                {"Edit the words"}
              </b>
              <p>
                {"Open it as a deck with the same layout and images, and change the text in place."}
              </p>
            </div>
            <div className="step" data-reveal="true" style={{ "--d": "6" } as CSSProperties}>
              <span className="n">
                {"04 · NEW TOPIC"}
              </span>
              <b>
                {"Same layout, new story "}
                <span className="st st--build st--sm">
                  {"Coming"}
                </span>
              </b>
              <p>
                {"Describe a new presentation and the agents write it into your layout. Still being tuned."}
              </p>
            </div>
          </div>
          <div className="arrows" data-reveal="true" style={{ "--d": "7" } as CSSProperties}>
            <div className="abs">
              <img src="/marketing/v3-uat/slides/deck-04.jpg" alt="Slide 11 of the showcase deck: Strengthening the Six Capabilities of Modern Delivery" width="1280" height="720" />
              <span className="cap">
                {"Your original"}
              </span>
            </div>
            <div className="ar">
              {"→"}
            </div>
            <div className="abs abs--dim">
              <img src="/marketing/v3-uat/slides/deck-04.jpg" alt="Slide 11 of the showcase deck: Strengthening the Six Capabilities of Modern Delivery" width="1280" height="720" />
              <i className="role" data-r="title" style={{ left: "3%", top: "8%", width: "62%", height: "8%" } as CSSProperties} />
              <i className="role" data-r="cards" style={{ left: "3%", top: "19%", width: "26%", height: "68%" } as CSSProperties} />
              <i className="role" data-r="hex cluster" style={{ left: "32%", top: "19%", width: "36%", height: "68%" } as CSSProperties} />
              <i className="role" data-r="cards" style={{ left: "71%", top: "19%", width: "26%", height: "68%" } as CSSProperties} />
              <i className="role" data-r="takeaway" style={{ left: "3%", top: "89%", width: "94%", height: "5%" } as CSSProperties} />
              <span className="cap">
                {"Template · layout & roles"}
              </span>
            </div>
            <div className="ar">
              {"→"}
            </div>
            <div className="abs">
              <img src="/marketing/v3-uat/slides/deck-04.jpg" alt="Slide 11 of the showcase deck: Strengthening the Six Capabilities of Modern Delivery" width="1280" height="720" loading="lazy" decoding="async" />
              <span className="cap">
                {"Opened as an editable deck"}
              </span>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"02"}
          </b>
          <span>
            {"/ 08"}
          </span>
          <i />
          {"Template"}
        </div>
      </section>
      <section className="slide slide--paper" id="library" data-snap="slide" data-label="Library" data-slide-label="Library">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"Your template library "}
              <span className="st st--beta">
                {"Beta"}
              </span>
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Templates that already look like you."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"Every slide of a PowerPoint you add becomes a layout you can reuse. These four came from one deck. Composer decides which one fits each new slide."}
            </p>
          </div>
          <div className="tgrid" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
            <div className="tcard">
              <div className="th">
                <img src="/marketing/v3-uat/slides/deck-04.jpg" alt="Slide 11 of the showcase deck: Strengthening the Six Capabilities of Modern Delivery" width="1280" height="720" loading="lazy" decoding="async" />
                <i className="role" data-r="hex cluster" style={{ left: "32%", top: "19%", width: "36%", height: "68%" } as CSSProperties} />
              </div>
              <div className="meta">
                <b>
                  {"Six capabilities · honeycomb"}
                </b>
                <span>
                  {"from your deck · .pptx"}
                </span>
              </div>
            </div>
            <div className="tcard">
              <div className="th">
                <img src="/marketing/v3-uat/slides/deck-02.jpg" alt="Slide 2 of the showcase deck: Driving Business Agility through a Five-Step Model" width="1280" height="720" loading="lazy" decoding="async" />
                <i className="role" data-r="steps ×5" style={{ left: "3%", top: "16%", width: "94%", height: "16%" } as CSSProperties} />
                <i className="role" data-r="columns ×5" style={{ left: "3%", top: "35%", width: "94%", height: "44%" } as CSSProperties} />
              </div>
              <div className="meta">
                <b>
                  {"Five-step model · chevrons"}
                </b>
                <span>
                  {"from your deck · .pptx"}
                </span>
              </div>
            </div>
            <div className="tcard">
              <div className="th">
                <img src="/marketing/v3-uat/slides/deck-09.jpg" alt="Slide 16 of the showcase deck: Next Wave Lowers Later Costs" width="1280" height="720" loading="lazy" decoding="async" />
                <i className="role" data-r="statement" style={{ left: "4%", top: "28%", width: "42%", height: "40%" } as CSSProperties} />
                <i className="role" data-r="contact" style={{ left: "54%", top: "46%", width: "24%", height: "16%" } as CSSProperties} />
              </div>
              <div className="meta">
                <b>
                  {"Closing · image hero"}
                </b>
                <span>
                  {"from your deck · .pptx"}
                </span>
              </div>
            </div>
            <div className="tcard">
              <div className="th">
                <img src="/marketing/v3-uat/slides/deck-06.jpg" alt="Slide 6 of the showcase deck: Optimizing Decision Forums and Governance Cadence" width="1280" height="720" loading="lazy" decoding="async" />
              </div>
              <div className="meta">
                <b>
                  {"Decision forums · pyramid"}
                </b>
                <span>
                  {"from your deck · .pptx"}
                </span>
              </div>
            </div>
          </div>
          <div className="stages" data-reveal="true" style={{ "--d": "5" } as CSSProperties}>
            <div className="stage">
              <span className="n">
                {"01 · EXACT"}
              </span>
              <b>
                {"Use it as it was "}
                <span className="st st--beta st--sm">
                  {"Beta"}
                </span>
              </b>
              <p>
                {"The same layout and pictures, with your new words in place."}
              </p>
            </div>
            <div className="stage">
              <span className="n">
                {"02 · MIX & MATCH"}
              </span>
              <b>
                {"Parts of several "}
                <span className="st st--build st--sm">
                  {"Coming"}
                </span>
              </b>
              <p>
                {"Composer takes the card row from one slide and the table from another, and recolours them by role."}
              </p>
            </div>
            <div className="stage">
              <span className="n">
                {"03 · BY AGENT"}
              </span>
              <b>
                {"Composer as a tool "}
                <span className="st st--planned st--sm">
                  {"Later"}
                </span>
              </b>
              <p>
                {"In agent mode, the agent reaches into your library by itself when a slide calls for it."}
              </p>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"03"}
          </b>
          <span>
            {"/ 08"}
          </span>
          <i />
          {"Library"}
        </div>
      </section>
      <section className="slide slide--night tight" id="any" data-snap="slide" data-slide-label="Any design" data-label="Any design">
        <div className="glow glow--violet" style={{ width: "46vw", height: "46vw", left: "27vw", top: "-28vw", opacity: "0.3" } as CSSProperties} />
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"Bring anything "}
              <span className="st st--build">
                {"Coming"}
              </span>
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"Made somewhere else? Bring it in."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"A slide from another tool, or from another AI, usually arrives as a flat picture: you can look at it but not change it. Deckster will read it into its own format, so every text box and picture is yours to edit, restyle in your brand, and export."}
            </p>
          </div>
          <div className="crack" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
            <div className="crack__pane crack__pane--flat">
              <img src="/marketing/v3-uat/slides/deck-07.jpg" alt="A finished slide as a flat picture: Teams Climb Five Levels of Delivery Maturity" width="1280" height="720" loading="lazy" decoding="async" />
              <span className="crack__tag">
                {"As it arrives · a picture"}
              </span>
            </div>
            <div className="crack__arrow">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <use href="#arrow" />
              </svg>
              {"read into Deckster's format"}
            </div>
            <div className="crack__pane">
              <img src="/marketing/v3-uat/slides/deck-07.jpg" alt="The same slide split into editable parts" width="1280" height="720" loading="lazy" decoding="async" />
              <span className="crack__tag crack__tag--ok">
                {"In Deckster · editable"}
              </span>
              <i className="crack__box" data-r="title" style={{ left: "3%", top: "6.2%", width: "48%", height: "5.8%" } as CSSProperties} />
              <i className="crack__box" data-r="steps ×5" style={{ left: "3.4%", top: "15.5%", width: "38.6%", height: "68%" } as CSSProperties} />
              <i className="crack__box" data-r="text" style={{ left: "45.2%", top: "15%", width: "51.2%", height: "65.5%" } as CSSProperties} />
              <i className="crack__box" data-r="takeaway" style={{ left: "3.4%", top: "87%", width: "93.2%", height: "4.8%" } as CSSProperties} />
            </div>
          </div>
          <div className="srcs4" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
            <div>
              <b>
                {"An image or screenshot"}
              </b>
              <p>
                {"PNG or JPG of any slide."}
              </p>
            </div>
            <div>
              <b>
                {"A PDF page"}
              </b>
              <p>
                {"From a report or an exported deck."}
              </p>
            </div>
            <div>
              <b>
                {"A web page"}
              </b>
              <p>
                {"HTML made by another AI tool."}
              </p>
            </div>
            <div>
              <b>
                {"A PowerPoint "}
                <span className="st st--beta st--sm">
                  {"Beta"}
                </span>
              </b>
              <p>
                {"Already works: add it to your template library."}
              </p>
            </div>
          </div>
          <div className="checks" data-reveal="true" style={{ justifyContent: "center", "--d": "5" } as CSSProperties}>
            <span>
              {"Text becomes text boxes"}
            </span>
            <span>
              {"Pictures keep their resolution"}
            </span>
            <span>
              {"Then checked like any other slide"}
            </span>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"04"}
          </b>
          <span>
            {"/ 08"}
          </span>
          <i />
          {"Any design"}
        </div>
      </section>
      <section className="slide slide--paper tight" id="brand" data-snap="slide" data-slide-label="Brand kit" data-label="Brand kit">
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols">
            <div>
              <span className="eyebrow" data-reveal="true">
                {"Brand kit "}
                <span className="st st--build">
                  {"Coming"}
                </span>
              </span>
              <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"Drop in your logo. Get your brand."}
              </h2>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"Deckster will read the colours from your logo, propose a kit, and wait for your yes. Logo, colours, fonts, footer and confidentiality line are then applied to every new deck, with nothing to pick."}
              </p>
              <div className="rules rules--3" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
                <div className="rule">
                  <b>
                    {"Your hex, kept"}
                  </b>
                  {"Brand colours are never changed quietly. If one fails a contrast check, you are warned and you decide."}
                </div>
                <div className="rule">
                  <b>
                    {"You confirm"}
                  </b>
                  {"You see the kit on a sample slide before anything is saved."}
                </div>
                <div className="rule">
                  <b>
                    {"One place"}
                  </b>
                  {"Change the kit once and every new deck follows."}
                </div>
              </div>
              <p className="note4" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
                <b>
                  {"Live today"}
                </b>
                {" your brand colour and a saved standard theme."}
              </p>
            </div>
            <div data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
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
              <figure className="kitslide">
                <img src="/marketing/v3-uat/slides/deck-04.jpg" alt="A slide of the showcase deck in the navy and gold of the kit" width="1280" height="720" loading="lazy" decoding="async" />
                <figcaption className="k4">
                  {"Applied to a new deck · example"}
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"05"}
          </b>
          <span>
            {"/ 08"}
          </span>
          <i />
          {"Brand kit"}
        </div>
      </section>
      <section className="slide slide--night" id="knowledge" data-snap="slide" data-label="Sources" data-slide-label="Sources">
        <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", right: "-10vw", top: "0", opacity: "0.35" } as CSSProperties} />
        <div className="grain" />
        <div className="slide__inner">
          <div className="cols">
            <div>
              <span className="eyebrow" data-reveal="true">
                {"Documents become sources"}
              </span>
              <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
                {"Your files, read for facts. Charts that say where."}
              </h2>
              <p className="lede" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
                {"Attach PDFs, Word files, spreadsheets or decks to a brief. Their figures and claims are used first-hand; charts made from them say where their numbers came from. Switch on the knowledge graph and later decks can draw on them too. Soon every figure carries its own badge."}
              </p>
              <div className="checks" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
                <span>
                  {"PDF · DOCX · PPTX · XLSX · CSV · TXT · MD"}
                </span>
                <span>
                  {"Up to 5 files per deck, 100 MB each"}
                </span>
                <span>
                  {"Spreadsheets become real charts and tables"}
                </span>
              </div>
              <p className="note4" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
                <span className="st st--build st--sm">
                  {"Coming"}
                </span>
                {" Connect Google Drive, so the folders you already keep can feed your research."}
              </p>
            </div>
            <div data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              <div className="steps" style={{ gridTemplateColumns: "1fr", marginTop: "0" } as CSSProperties}>
                <div className="step">
                  <span className="n">
                    {"CHAT · RESEARCH MENU"}
                  </span>
                  <b>
                    {"Web search · Deep research · Knowledge graph"}
                  </b>
                  <p>
                    {"Choose per deck what the Researcher may use. Your attached files are always in."}
                  </p>
                  <span className="st st--live">
                    {"Live"}
                  </span>
                </div>
                <div className="step">
                  <span className="n">
                    {"SETTINGS · KNOWLEDGE GRAPH"}
                  </span>
                  <b>
                    {"Build a knowledge graph across my decks"}
                  </b>
                  <p>
                    {"Opt in once; browse entities and evidence on your Knowledge page; delete everything with one button."}
                  </p>
                  <span className="st st--beta">
                    {"Beta"}
                  </span>
                </div>
                <div className="step">
                  <span className="n">
                    {"PUBLISHED DECK · QUESTIONS"}
                  </span>
                  <b>
                    {"What it can answer from"}
                  </b>
                  <p>
                    {"Pick which of your documents a published deck may use. They are never named to the audience."}
                  </p>
                  <span className="st st--live">
                    {"Live"}
                  </span>
                </div>
                <div className="step">
                  <span className="n">
                    {"ON THE SLIDE · SOURCE BADGES"}
                  </span>
                  <b>
                    {"File, web or estimate, on each number"}
                  </b>
                  <p>
                    {"Click a badge to open where the number came from. Change the number and its badge drops off."}
                  </p>
                  <span className="st st--build">
                    {"Coming"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"06"}
          </b>
          <span>
            {"/ 08"}
          </span>
          <i />
          {"Sources"}
        </div>
      </section>
      <section className="slide slide--paper" id="inout" data-snap="slide" data-label="In & out" data-slide-label="In & out">
        <div className="grain" />
        <div className="slide__inner">
          <div className="center">
            <span className="eyebrow" data-reveal="true">
              {"In and out"}
            </span>
            <h2 className="h2 balance" data-reveal="true" style={{ "--d": "1" } as CSSProperties}>
              {"What comes in. What goes out."}
            </h2>
            <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
              {"No lock-in in either direction. Bring the files you have; leave with the formats your audience expects."}
            </p>
          </div>
          <div className="io" data-reveal="true" style={{ "--d": "3" } as CSSProperties}>
            <div>
              <h4>
                {"In"}
              </h4>
              <ul>
                <li>
                  <div className="file__ic" style={{ background: "linear-gradient(160deg,#c2410c,#f97316)" } as CSSProperties}>
                    {"PPTX"}
                  </div>
                  {"Past presentations "}
                  <span>
                    {"· sources, and templates in beta"}
                  </span>
                </li>
                <li>
                  <div className="file__ic" style={{ background: "linear-gradient(160deg,#991b1b,#ef4444)" } as CSSProperties}>
                    {"PDF"}
                  </div>
                  {"Reports, studies, Word files "}
                  <span>
                    {"· read for facts and figures"}
                  </span>
                </li>
                <li>
                  <div className="file__ic" style={{ background: "linear-gradient(160deg,#1e3a8a,#3b82f6)" } as CSSProperties}>
                    {"DATA"}
                  </div>
                  {"Spreadsheets and CSVs "}
                  <span>
                    {"· become real charts and tables"}
                  </span>
                </li>
                <li>
                  <div className="file__ic" style={{ background: "linear-gradient(160deg,#134e4a,#14b8a6)" } as CSSProperties}>
                    {"WEB"}
                  </div>
                  {"Web search and deep research "}
                  <span>
                    {"· cited; estimates labelled as estimates"}
                  </span>
                </li>
                <li>
                  <div className="file__ic" style={{ background: "linear-gradient(160deg,#4c1d95,#8b5cf6)" } as CSSProperties}>
                    {"ANY"}
                  </div>
                  {"Designs from other tools "}
                  <span>
                    {"· read into editable slides · coming"}
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <h4 style={{ color: "var(--mint)" } as CSSProperties}>
                {"Out"}
              </h4>
              <ul>
                <li>
                  <div className="file__ic" style={{ background: "linear-gradient(160deg,#c2410c,#f97316)" } as CSSProperties}>
                    {"PPTX"}
                  </div>
                  {"PowerPoint, no watermark "}
                  <span>
                    {"· text and tables editable; charts and diagrams as images"}
                  </span>
                </li>
                <li>
                  <div className="file__ic" style={{ background: "linear-gradient(160deg,#991b1b,#ef4444)" } as CSSProperties}>
                    {"PDF"}
                  </div>
                  {"PDF "}
                  <span>
                    {"· every slide as you see it"}
                  </span>
                </li>
                <li>
                  <div className="file__ic" style={{ background: "linear-gradient(160deg,#4c1d95,#8b5cf6)" } as CSSProperties}>
                    {"LINK"}
                  </div>
                  {"Published deck at deckster.xyz/p/… "}
                  <span>
                    {"· link or passcode, downloads you allow"}
                  </span>
                </li>
                <li>
                  <div className="file__ic" style={{ background: "linear-gradient(160deg,#7c2d12,#f4502f)" } as CSSProperties}>
                    {"VOICE"}
                  </div>
                  {"Narrated deck that takes questions "}
                  <span>
                    {"· live"}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="slide__chip">
          <b>
            {"07"}
          </b>
          <span>
            {"/ 08"}
          </span>
          <i />
          {"In & out"}
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
            {"Bring your "}
            <span className="you">
              {"next"}
            </span>
            {" deck."}
          </h2>
          <p className="lede balance" data-reveal="true" style={{ "--d": "2" } as CSSProperties}>
            {"Attach the report, spreadsheet or old deck it should start from. You approve the plan before a single slide is built."}
          </p>
          <div className="ctas" style={{ justifyContent: "center", "--d": "3" } as CSSProperties} data-reveal="true">
            <BuildCta className="btn btn--primary" location="v3_close_build">
              {"Request early access "}
              <svg className="arrow" aria-hidden="true">
                <use href="#arrow" />
              </svg>
            </BuildCta>
          </div>
          <p className="truthline" data-reveal="true" style={{ "--d": "4" } as CSSProperties}>
            <Link href="/auth/signin">
              {"Have an access code? Sign in with Google and enter it."}
            </Link>
          </p>
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
            {"08"}
          </b>
          <span>
            {"/ 08"}
          </span>
          <i />
          {"Begin"}
        </div>
      </section>
    </main>
  )
}
