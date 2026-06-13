# Deckster — Landing Page Upgrade Recap & Forward Plan

**Date:** June 2026
**Scope:** Home page (`app/page.tsx` + `components/marketing/HomepageV2/*`), support pages (`app/{agents,compare,pricing,learn,about,enterprise,examples,templates,careers,contact,help,docs,integrations}`), and the real builder (`app/builder` + `components/builder/*`) **only as it relates to the demo↔reality gap and visual UX** — not a builder feature rebuild.
**How to read this:** Part 0 is the doctrine. Part 1 is what shipped this session. Parts 2–3 are the plan. Each plan item carries a priority (**P0/P1/P2**) and, where it's a copy change, a concrete before→after with `file:line`.

---

## Part 0 — The doctrine (the lens for everything below)

These five principles were established while rebuilding the hero this session. They are the standard every other slide and page is measured against. (Mirrored in agent memory as `feedback_landing_page_sales.md`.)

1. **The landing page is a sales process.** Every section must enthuse the visitor to take the next step toward sign-up. Judge a change by whether it builds momentum, not by cleverness.
2. **Visitor vocabulary, above the fold.** Cold visitors know presentation words (deck, slides, charts, PowerPoint) and general AI verbs (plan, research, write, design). They do **not** know product terms ("Director", "Element", scopes). Product terminology is introduced later, on the team slide — after the demo has *shown* the agents working.
3. **One idea per altitude.** Display heading ≤ ~8 words, ideally one line. Demote the explanation to the subhead. Let cards carry the detail.
4. **Make it about the person, not the product.** Lead with the visitor's reclaimed life; the agents are the *mechanism*, named second.
5. **Honesty over social proof.** No fabricated testimonials, logos, or numbers (we have none yet). Trust comes from verifiable product facts.

Two cross-cutting truths surfaced by this session's audit that the plan must respect:

- **The single biggest benefit, per PK, is the compounding personal knowledge base** — every deck grows a knowledge base the agents lean on next time ("IT REMEMBERS"). It is currently undersold everywhere except the hero card, and is actually *contradicted* by pricing (see §2.3).
- **Describing isn't limited to one sentence.** Users can specify in as much detail as they want and attach data points. Copy that says "just a sentence" undersells the control on offer.

---

## Part 1 — What we accomplished this session

Seven commits, `bb69c7f` → `3713a38`, all on `main` and deployed via Vercel. Home page only (plus shared header/footer and `app/layout.tsx`).

### 1.1 The arc of the work

| Commit | Theme | What changed |
|---|---|---|
| `bb69c7f` | Hygiene & measurement | Installed `@vercel/analytics`; added `lib/analytics.ts` (`trackCta`/`trackSlideView`) and wired CTA events; generated the missing OG image via `app/opengraph-image.tsx` + `app/twitter-image.tsx` (the referenced `/og-image.png` never existed — social previews were broken); resized header/footer logos 1.5MB→38KB; removed `maximumScale:1` (pinch-zoom a11y). |
| `4359bd1` | Deck flow + reorder + copy | Slide progress rail, hero scroll cue, mobile snap strategy (mandatory ≥768×640, proximity below); reordered Demo→Agents→Gallery; first visitor-vocabulary copy pass. |
| `92e1045` | Perf + mobile fixes | Lazy-loaded the gallery carousel and agent pyramid; fixed the agents-title horizontal overflow at 390px; made agent-card drag desktop-only (touch-none was trapping phone scroll). |
| `82d50ab` | Hero in visitor vocabulary | Eyebrow names the category; lighter display type. |
| `fa7d24a` | Single hero CTA | "See the team in action" demoted from a competing button to a caps scroll-connector at the slide's bottom edge. |
| `4912893` | Person-centric hero | Rotating reclaimed-moment headline + the four-beat story cards + knowledge-base beat. |
| `3713a38` | Hero CTA placement | Get Started moved below the story cards, so reading order = the sales arc. |

### 1.2 The hero (slide 1) — final state, in detail

This is the reference implementation the rest of the plan extends.

- **Eyebrow** — `"AI presentation builder"` (`homepage-v2-content.ts:66`). Plain category, three words.
- **Headline, line 1 (rotating)** — `RotatingHeadline.tsx` cycles `HERO_ROTATING_PHRASES` (`homepage-v2-content.ts:85-90`): *"Take that walk." / "Drink your tea." / "Rehearse your pitch." / "Call it a night."* Gentle framer-motion fade, ~3.5s each; the first phrase is server-rendered and is also the static value under `prefers-reduced-motion`; an invisible sizer span prevents layout shift.
- **Headline, line 2 (fixed, gradient)** — `"Your deck is getting built."` (`headlineAccent`, `:69`).
- **Subhead (mechanism)** — *"A team of AI agents plans the story, researches the facts, writes the words, and designs every slide — checking in with you in plain English at every step."* (`:70-71`). This is where "AI agents" first appears — as the how, not the hook.
- **Trust strip (honest facts)** — `TRUST_SIGNALS` (`:95-99`): *"Charts, diagrams & infographics built in" · "PowerPoint & PDF export — no watermark" · "No templates — just conversation."*
- **Story cards (the cycle, person as protagonist)** — `CONVERSATION_SCOPES` (`:118-159`): **YOU DESCRIBE** ("A sentence or a full brief — with your data.") → **THEY BUILD** ("Story, slides, charts, design.") → **YOU REFINE** ("Change anything by asking.") → **IT REMEMBERS** ("Your knowledge base grows with every deck."). Replaced the old insider DECK/SLIDE/ELEMENT scopes.
- **CTA** — single `Get Started` (`HeroCTA.tsx`), placed *below* the cards.
- **Scroll connector** — `ScrollCue.tsx` renders `HERO_COPY.scrollConnector` ("See the team in action") in caps with a bouncing chevron at the slide's bottom edge; click advances one slide; fades on scroll. Slide position lives only on the right-edge progress rail.
- **Reading order = sales arc:** claim → mechanism → facts → story beats → ask (at peak conviction) → "show me more" connector.

### 1.3 Known nit introduced this session

- `Hero.tsx:8-14` still carries a **stale doc-comment** describing the old "DECK/SLIDE/ELEMENT" scopes and a single static headline. It no longer matches the rotating headline + four-beat cards actually rendered. **P2 cleanup** — update the comment when next touching the file.

---

## Part 2 — Applying the doctrine to the rest of the page & the support pages

The audit's headline finding: **three of the four non-hero home sections are product-framed, and the length discipline is already met — so the work is *angle*, not trimming.** Support pages are more uneven: only `/pricing` already meets the bar.

### 2.1 Home page — slides 3–6

#### Slide 3 — Agents ("Meet the team") · `AgentChoreographySection.tsx:32-37`, copy `homepage-v2-agent-deep.ts:129-134`

This is the sanctioned place to introduce product terminology — but the *hook* should still be relatable. Today's heading is an architecture claim.

- **Before:** "Specialists, not a one-size-fits-all model."
- **After (Recommended):** **"You bring the idea. They bring the craft."** (gradient on the second sentence — mirrors the hero's two-altitude rhythm.)
- **Alternatives:** "The team you'd hire if you could." / "Eight specialists. One of you."
- **Subhead:** keep — *"Each agent owns one craft — research, numbers, copy, charts, themes. The Director keeps them in sync."* ("Director" is allowed here, by rule.)
- **Also (P2):** the pyramid card nicknames ("The Orchestrator", "The Investigator", "The Stylist" — `homepage-v2-agent-deep.ts:25,38,…`) are clever-abstract. Consider outcome-shaped subtitles so each card says what the visitor *gets*, not a role nickname. Optional.
- **Priority:** **P1** (heading angle).

#### Slide 4 — Gallery ("What they build") · `homepage-v2-element-gallery.ts:219-226`, `InventoryCounters.tsx`

Heading is the **best of the four** — keep it ("Every shape your idea fits into." centers the visitor). The problem is jargon in the *supporting* copy.

- **Counter sublabels (`InventoryCounters.tsx:13-35`)** — soften the insider chart/diagram names for cold visitors:
  - "From bar to Sankey to choropleth" → **"From bar charts to heat maps"** (keep one impressive term at most).
  - "Cloud, logical, data, kanban, gantt" → **"Architecture, kanban, timelines & more"**.
- **Subhead** — naming "the Visualizer" is borderline (second product term, doing capability-proof work that doesn't need an agent name). Optional: *"Charts, diagrams, infographics, tables — describe it, and the right one gets built."*
- **Priority:** **P2** (heading is fine; jargon-softening is polish).

#### Slide 5 — Pricing ("A team of agents, on tap.") · `homepage-v2-pricing.ts:97-105`, tiers `:40-95`

Heading is product-framed; the feature bullets are the **heaviest jargon zone on the page**.

- **Heading before:** "A team of agents, on tap."
- **Heading after (Recommended):** **"Priced for how you actually present."** (benefit/person-framed.) Alternative: keep "A team of agents, on tap." if you prefer the punch — it's the least offensive of the product-framed headings.
- **Feature-bullet de-jargon (P1):**
  - `"Upload your files as source material (RAG over your corpus)"` (`:68`) → **"Upload your own files as source material"** (drop "RAG over your corpus" — pure ML jargon).
  - `"insight extraction from your numbers"` (`:70`) → **"finds the story in your numbers"**.
  - Starter's first bullet lists five agent names (`:48`) — fine post-team-slide, but it's product-inventory framing. Consider leading the tier with a benefit bullet, names second.
- **Consistency fix (P1) — reconcile with the hero's biggest promise:** the hero sells **"IT REMEMBERS — your knowledge base grows with every deck"** to *everyone*, but pricing gates it as **"Knowledge Graph"** to the $100 Max tier only (`:86`). Either (a) rename "Knowledge Graph" to match the hero's plain language and clarify that *some* memory is in every tier with *more* at Max, or (b) soften the hero card so it doesn't over-promise a paywalled feature. **This needs a PK product decision** (see §4).
- **Priority:** **P1** (heading + the memory-gating contradiction).

#### Slide 6 — Final CTA ("Talk to the team. Ship the deck.") · `FinalCTASection.tsx:26-36`

The closing slide. The payoff half ("Ship the deck.") is person-relevant; the hook half ("Talk to the team") re-centers on the product at the moment of peak conviction.

- **Before:** "Talk to the team. Ship the deck."
- **After (Recommended):** **"Take the evening. Ship the deck."** — rhymes with the hero's rotating moments and closes the reclaimed-time loop. Keep "Ship the deck." as the gradient line.
- **Add an eyebrow (P2):** the only section without one — minor consistency gap.
- **Subhead:** keep, but per the doctrine note, avoid "just a sentence" framing if reworded (users can specify in detail). Current wording is acceptable.
- **Priority:** **P1** (hook angle).

#### Cross-section summary

| Slide | Heading today | Framing | Recommended move |
|---|---|---|---|
| Agents | "Specialists, not a one-size-fits-all model." | Product | → "You bring the idea. They bring the craft." (P1) |
| Gallery | "Every shape your idea fits into." | **Person ✓** | Keep; soften counter jargon (P2) |
| Pricing | "A team of agents, on tap." | Product | → "Priced for how you actually present." + de-jargon bullets + fix memory gating (P1) |
| Final CTA | "Talk to the team. Ship the deck." | Mixed | → "Take the evening. Ship the deck." (P1) |

**Arc integrity is sound** — eyebrows deliberately chain the slides ("Meet the team" → "What they build" → "Pricing" → close). No reordering needed.

### 2.2 Support pages — priority-ordered rewrite plan

Only `/pricing` currently meets the new hero bar. Two visual generations coexist: most marketing pages use full-viewport `data-snap` slide heroes; **`/help`, `/docs`, `/integrations` use the legacy `PageHeader`/inline-band pattern** (smaller type, Title-Case labels) — bringing them on-pattern is structural, not just copy.

**Tier 1 — highest conversion leverage (a visitor evaluating the product):**

1. **`/pricing`** — already the in-repo template to clone. Polish only: the eyebrow is a dead "Pricing" label (`homepage-v2-pricing.ts:98`); give it a micro-promise. **P2.**
2. **`/compare`** (`app/compare/page.tsx:142-151`) — heading "How Deckster Compares" is fine; the subhead + differentiator cards lead with "multi-agent AI system / eight specialists" before any person-benefit beat. Reorder to person-benefit first, mechanism as proof. **Plus:** the four data-driven competitor headlines in `content/comparisons.ts` (`summary.headline`, lines 79/209/346/476) are abstract X-vs-Y analyst titles ("Multi-Agent AI vs. Template-Based Design"). Rewrite all four to outcome-first lines a switcher would say ("Stop building decks by hand.") — **single-file edit, four highest-intent competitor-search landing pages. P1.**
3. **`/agents`** (`app/agents/page.tsx:105-114`) — "Meet your AI team" is a clean 3-word line; keep it. Reframe the subhead toward what the visitor *gets back* (reclaimed time / "it remembers you"), let the team be the proof not the promise. This is the canonical place for Director/Element terms. **P1.**
4. **`/learn`** (`app/learn/page.tsx:51-60`) — "Learn to use Deckster" is chore-framing (implies a learning curve at the worst altitude). Reframe to an outcome: **"Get your first deck shipped today."** Lead with examples (show-don't-tell). A `/learn` visitor is mid-funnel and persuadable — surface the knowledge-base benefit here. **P1.**

**Tier 2 — trust pages:**

5. **`/about`** (`:38-43`) — replace cliché "Building the Future of Presentations" with a specific founder-truth line. **Credibility bug (P1):** the origin story (`:192-194`) names a defunct agent roster — `Scripter`, `Graphic Artist`, `Data Visualizer` — that contradicts the canonical 8 (Director, Researcher, Analyst, Content Generator, Visualizer, Theme Builder, Slide Composer, Element Generator). Fix the names.
6. **`/enterprise`** (`:61-66`) — tighten "Enterprise-Grade AI Presentation Platform" (three stacked modifiers) to one idea. Different audience (IT buyer), so visitor-vocab bends. **Caveat for PK:** it makes a hard `SOC 2 Type II compliant` claim (`:17`) — verify accuracy at solo-founder stage. **P2.**

**Tier 3 — gallery/utility (lower hook leverage, most off-voice):**

7. **`/examples`** (`:40-45`) — "Example Presentations" is a label, not a hook; high-intent proof-seekers land here, so it punches above its tier. Lead with the strongest visual proof + an honest confidence line ("See what a sentence turns into."). Fix lowercase "deckster" in the subhead. **P2.**
8. **`/templates`, `/contact`, `/careers`** — label/utility headings; light touch. `/careers` copy ("distributed team across the globe", `:66`) contradicts the solo-founder reality — soften or remove. **P2/P3.**
9. **`/help`, `/docs`, `/integrations`** — legacy `PageHeader`/inline-band pattern; bringing them onto the slide-hero voice is structural. `/help` FAQ (`:400-412`) repeats the **same stale agent roster** as `/about` — fix alongside. **P2 (copy) / P3 (structural re-pattern).**

**Cross-cutting support-page fixes:**
- **Casing:** `about`, `enterprise`, `careers`, `templates`, `examples` use Title Case; the new voice is sentence case. Normalize.
- **Stale agent roster** (`/about`, `/help`) — credibility bug, fix once.
- **The knowledge-base / reclaimed-time beat appears on no support hero** — most missed on `/learn`, `/compare`, `/examples`.

---

## Part 3 — The demo (slide 2) ↔ the real builder

This is the most important part of the document, because it concerns the gap between **what we promise** and **what we deliver** — the thing most likely to cause churn right after sign-up.

### 3.1 The central finding

> **The demo parades eight named, color-coded specialist agents talking to each other. The real builder only ever shows two speakers: "You" and "Director." The WebSocket protocol has no per-agent identity at all** (`use-deckster-websocket-v2.ts:22,223` — messages carry only `role: 'assistant' | 'user'`).

Every specialist the homepage makes the visitor care about — Researcher, Analyst, Visualizer, Theme Builder, Slide Composer, Content Generator, Element Generator — is **invisible in the product**. The demo's chat names them (`ChatPanel.tsx:12-19` resolves each speaker to its `AGENT_TEAM` name + color) and the `AgentRail` shows all eight pulsing; the real chat hardcodes a purple `Sparkles` avatar labeled "Director" for *every* bot message (`message-list.tsx:377-379, 531-533`).

This is the headline gap. Everything else is secondary.

### 3.2 Full demo-vs-reality divergence list

Ranked by how surprising it is to a freshly-converted user.

| # | Demo (homepage) | Real builder | Severity |
|---|---|---|---|
| 1 | 8 named, color-coded agents converse (`choreography.data.ts:88-178`) | Only "You" + "Director"; no agent identity in protocol | **Critical** |
| 2 | "The agents talk to each other"; animated pulsing AgentRail (`SlideCanvas.tsx:202-242`) | One muted "Director" thinking-stream, three identical dots (`message-list.tsx:473-510`) | High |
| 3 | Dark, glassy, **monospace neon** aesthetic (`ChatPanel.tsx:42,114`) | **Light** white/slate utility UI, tiny system-sans | High |
| 4 | Clean fixed two-pane grid, chat-left/slide-right (`BuilderDemo.tsx:17`) | Three overlapping **left-edge drawers** (Element/Slide/Deck) + right thumbnail strip, toggled by 16px vertical pill handles | High |
| 5 | Rounded bubbles w/ per-agent colored rings + typewriter | Flat avatar+text rows; structured cards (📊 slide list, ✅ Open) the demo never shows | Medium |
| 6 | Frictionless conversation, no chrome | Foregrounds **token usage**, +N badges, limit warnings, **Top-up** upsell; toolbar (Add Slide/Element/Theme/Mode/Show/Play/Download); version switcher; Deep Research/Web/Extended/Knowledge-graph toggles | Medium |
| 7 | "Director" never shown as the *only* entity | Input placeholder is literally **"Message Director…"** (`chat-input.tsx:233`); empty state says "tell Director…" (`presentation-area.tsx:180`) — product term, cold, contradicts the visitor-vocabulary rule | Medium |
| 8 | Same polished FinTechCo deck assembles in ~21s on loop | iframe-rendered via remote Layout Service, 3s polling, 5s timeouts, strawman→final stages, loaders | Medium |

### 3.3 The strategic choice

There are two ways to close a promise↔delivery gap: lower the promise, or raise the delivery. **Do not lower the promise.** The entire brand — and the hero we just built — is "a team of specialist agents." The right answer is to **make the team visible in the product**, and in the interim adjust the demo so nothing it shows is *contradicted* by reality.

This breaks into three workstreams, ordered by leverage-per-effort.

### 3.4 Workstream A — Make the team visible in the builder (the real fix)

**A1 — [P0, frontend-only, highest leverage] Attribute the existing thinking-stream to agents using data we already have.**
The builder already receives a stream of "thinking" stages and renders them under a single "Director" label (`message-list.tsx:463-524`). The repo already contains **`lib/token-stage-labels.ts`** — a ready stage→label mapping that is currently unused (per memory). Add a `stage → agent` map, and render each thinking line with the corresponding agent's name, color, and icon (the `AGENT_TEAM` metadata in `homepage-v2-content.ts:118-190` is the single source of truth the demo already uses). Result: "Director is thinking…" becomes **"Researcher is pulling your data… → Analyst found the trend… → Visualizer is drawing the chart…"** — the team becomes visible **with no backend change**, closing divergence #1 and #2 cheaply. This is the single highest-leverage item in the entire document.

**A2 — [P1, needs backend] Add agent/sender identity to the WebSocket protocol.**
For true per-message attribution (not just the thinking stream), the backend must stamp each `assistant` message with which agent/stage produced it. Then the chat can render per-agent avatars/colors exactly like the demo (`message-list.tsx` already has the rendering structure; it just always passes "Director"). This is the durable fix; A1 is the bridge that delivers most of the value first.

**A3 — [P1] Stop leading with "Director" as the only named entity.**
Replace the first-contact copy with plain language: placeholder "Message Director…" → **"Describe the deck you want to build…"** (`chat-input.tsx:233`); empty-state "tell Director…" → **"Tell us what you want to make…"** (`presentation-area.tsx:180`). Introduce agent names *progressively* once the conversation is underway — the same principle the landing page follows.

### 3.5 Workstream B — Bring the builder up to the brand (visual UX)

The builder is functionally rich but reads as a flat gray developer tool, while the landing page is a crafted dark-gradient brand experience. The first 10 seconds in the builder (empty state → first message → first wait) must feel as branded and alive as the page that sold the user. Full prioritized backlog:

**P0 — broken-feeling or trust-damaging:**
- **B-P0-1 — Empty canvas is an unbranded gray void** (`presentation-area.tsx:168-184`). The first screen after the polished dark landing page is a flat `bg-gray-100` field with a 40%-opacity logo. Design a real welcome canvas: subtle brand gradient wash, a confident headline ("Let's build your deck"), and 3–4 clickable example-prompt chips that pre-fill the input. Turns dead space into an on-ramp.
- **B-P0-2 — Dark-mode class bug** (`page.tsx:849,1000,1057`; `chat-input.tsx:171,236`): elements set `dark:text-slate-900` *and* `dark:text-slate-100` (conflicting, source-order-dependent → dark text on dark panels). De-duplicate.
- **B-P0-3 — Hardcoded `VIEWER_ORIGIN`** (`presentation-viewer.tsx:150`) gates all iframe `postMessage`; off-prod it silently freezes the entire slide canvas with no error. Move to env config; derive from `presentationUrl` origin as fallback.

**P1 — visible polish a discerning visitor notices:**
- **B-P1-1** — No client-side chat empty state (`message-list.tsx` renders nothing at zero messages) → builder can be two empty boxes on first load. Add a Director-avatar welcome + example chips, independent of socket timing.
- **B-P1-2** — Three different unbranded boot spinners (`page.tsx:1298-1304`, `:1188-1194`; `chat-input.tsx:341`). Standardize one branded loader.
- **B-P1-3** — `currentStatus` (the live "what the agents are doing now") is received but its text is **never shown** (`page.tsx:274,1210`; used only as a boolean at `presentation-area.tsx:170`). Surface it as a caption on `SlideBuildingLoader`, using the `token-stage-labels.ts` mapping (ties directly to A1). Silence during the longest waits is where users abandon.
- **B-P1-4** — `SlideBuildingLoader` types a literal fake title "Executive Summary & Key Insights" (`slide-building-loader.tsx:207`) unrelated to the user's deck. Feed real slide titles when available, else neutral shimmer.
- **B-P1-5** — Builder chrome shares none of the landing brand aesthetic (flat white/slate vs the hero's `hsl(240,10%,4%)` mesh). Introduce restrained brand presence (subtle gradient header / faint mesh behind empty canvas; align dark-mode base to the hero's near-black).
- **B-P1-6** — Fragmented accent colors (purple/blue/indigo/green with no rule across the four drawer handles + thumbnails). Define a semantic palette: brand-purple = primary/AI, one neutral = nav chrome, green/amber/red = status only.
- **B-P1-7** — Thin message bubbles, invisible team, no timestamps (`message-list.tsx:354-568`). (Pairs with A1/A2.)
- **B-P1-8** — Fake schematic thumbnails (`slide-thumbnail-strip.tsx:310-345`) all look identical → strip has near-zero navigational value. Pursue real renders from the Layout Service (`BACKEND_REQUEST_THUMBNAILS_AND_NOTES.md` referenced at `presentation-viewer.tsx:2101` suggests it's in flight); interim, show the real slide title + a layout-type icon.
- **B-P1-9** — Primary navigation rests on four tiny 16px vertical-text edge handles (`page.tsx:950-982,1012-1039,1126-1153`); three are near-identical purple. Consolidate to clearer labeled toggles.
- **B-P1-10** — Dead "Template — coming soon" disabled button in the primary toolbar (`presentation-viewer.tsx:1831-1838`). Hide behind a flag until it ships.
- **B-P1-11** — WebSocket error retry is a full `window.location.reload()` (`builder-header.tsx:86`) with `maxReconnectAttempts: 0` (`page.tsx:305-306`). Offer in-place reconnect + a few auto-attempts with a "Reconnecting…" state.
- **B-P1-12** — Builder is effectively desktop-only (fixed 420px drawers, mouse-only resize, dense single-row toolbar). The landing page is mobile-tuned, so a mobile convert hits an unusable builder. Define a mobile layout (single-panel bottom-sheet/tab switching, overflow toolbar, touch resize).

**P2 — refinements:** thinking-vs-chat bubble too similar (`message-list.tsx:473-568`); sub-10px chrome type; light-only fullscreen toolbar (`presentation-viewer.tsx:2045`); buried connection status (the `ConnectionStatusIndicator` at `connection-error.tsx:54-95` exists but is unused — wire it in); no optimistic send state; native `confirm()`/`alert()` instead of the app's toast/AlertDialog (`presentation-viewer.tsx:603,613`; `page.tsx:647,652`); off-palette `stone` colors (`presentation-viewer.tsx:2132-2135`); silent iframe-command failures.

### 3.6 Workstream C — Make the demo mirror reality (so it stops over-promising)

The demo's dark, premium aesthetic is *good brand* — the fix is not to dumb it down to match a plain builder, but to ensure it doesn't depict things the product contradicts. Sequence **after** A1 (once the team is visible in the product, the demo's 8-agent promise becomes true and most of this evaporates).

- **C1 — [P1] Reflect the real layout.** The real builder is chat-as-a-left-drawer + a large slide canvas; the demo's chat-left/slide-right two-pane is roughly aligned already. Nudge it closer by hinting the real chrome (a slim toolbar above the slide, a token/credits whisper) so the product's surfaces aren't a total surprise.
- **C2 — [P1] Show the real stages.** The product runs strawman→final with visible loaders; have the demo loop pass through a "drafting structure → filling in → designing" beat rather than only smooth element-drop-in, so the multi-stage reality is set up.
- **C3 — [P2] Use real element types.** The demo hand-builds title/metric/chart on a 12×6 grid; the product has 9 element types on a 32×18 canvas via the Layout Service iframe. Broaden the demo's element vocabulary slightly so "what assembles" matches what the gallery slide then promises.
- **C4 — [P2] Copy nits in the demo:** the closing Director bubble double-labels itself (`'Director: "Ready for your review."'` inside a bubble already headed "DIRECTOR" — `choreography.data.ts:178`); the chart label says "2026 → 2029" (4 years) but plots 5 bars (`:56-69`). Fix both.

### 3.7 Recommended sequence for Part 3

1. **A1** (thinking-stream → agent identity via existing `token-stage-labels.ts`) + **B-P1-3** (show `currentStatus` text) — together, cheaply, make the team visible during waits. Highest leverage in the doc.
2. **B-P0-1/2/3** — fix the empty-canvas void and the two latent bugs (dark-mode classes, hardcoded origin) that can make the builder look outright broken.
3. **A3** + **B-P1-1** — fix first-contact copy + chat empty state.
4. **B-P1-5/6** — bring builder chrome toward the brand; unify accents.
5. **A2** (backend agent identity) when backend capacity allows → full per-message attribution.
6. **C1–C4** — align the demo to the now-truthful product.
7. Remaining B-P1/P2 polish + **B-P1-12** (mobile) as a dedicated effort.

---

## Part 4 — Decisions only PK can make

1. **Memory feature naming & gating** — the hero promises "your knowledge base grows with every deck" to everyone; pricing gates "Knowledge Graph" to the $100 Max tier (`homepage-v2-pricing.ts:86`). Reconcile: is *some* memory in every tier (with more at Max), or is the hero card over-promising? (§2.1 Pricing, §0.)
2. **Backend agent identity (A2)** — is adding per-agent sender attribution to the WebSocket protocol feasible/worth it? A1 delivers most of the value without it, but A2 is the durable fix.
3. **`/enterprise` SOC 2 claim** (`app/enterprise/page.tsx:17`) and **`/careers` "distributed team"** (`:66`) — verify these are true at solo-founder stage or soften.
4. **Voice on Title-Case support pages** — confirm the move to sentence-case site-wide.

---

## Appendix — Consolidated quick-fix backlog (independent of the larger plans)

These are small, high-confidence, ship-anytime items surfaced by the audit:

- **Stale agent roster** ("Scripter / Graphic Artist / Data Visualizer") on `/about` (`:192-194`) and `/help` (`:400-412`) — contradicts the canonical 8. **Credibility bug.**
- **Dead "Template" button** in builder toolbar (`presentation-viewer.tsx:1831-1838`) — hide behind a flag.
- **Dark-mode class duplication** (`page.tsx:849,1000,1057`; `chat-input.tsx:171,236`).
- **Hardcoded `VIEWER_ORIGIN`** (`presentation-viewer.tsx:150`) → env config.
- **Stale Hero.tsx doc-comment** (`Hero.tsx:8-14`).
- **Demo copy nits** (`choreography.data.ts:178` double-label; `:56-69` 4yr-label/5-bar mismatch).
- **lowercase "deckster"** in `/examples` subhead (`:43-45`).
- **Wire the existing unused `ConnectionStatusIndicator`** (`connection-error.tsx:54-95`) into the builder chat header.

---

## File map (where the work lives)

- **Hero (reference impl):** `components/marketing/HomepageV2/Hero/{Hero,HeroHeadline,RotatingHeadline,HeroCTA,ConversationalScopes}.tsx`; copy in `lib/marketing/homepage-v2-content.ts`.
- **Other home sections:** `components/marketing/HomepageV2/{AgentChoreography,ElementGallery,PricingV2,FinalCTA}/`; copy in `lib/marketing/homepage-v2-{agent-deep,element-gallery,pricing}.ts`.
- **Demo:** `components/marketing/HomepageV2/BuilderDemo/{BuilderDemoSection,BuilderDemo,ChatPanel,SlideCanvas,choreography.data,useChoreography,MeetTheTeamLink}.tsx/ts`.
- **Real builder:** `app/builder/page.tsx`; `components/builder/{builder-header,chat-input,message-list,presentation-area,token-usage-strip,topup-modal}.tsx`; `components/presentation-viewer.tsx`; `components/slide-building-loader.tsx`; `hooks/{use-builder-session,use-deckster-websocket-v2}.ts`; **`lib/token-stage-labels.ts`** (unused, central to A1).
- **Support pages:** `app/{agents,compare,pricing,learn,about,enterprise,examples,templates,careers,contact,help,docs,integrations}/`; competitor data in `content/comparisons.ts`; shared scaffolding `components/marketing/{PageHeader,Section}.tsx`.
- **Analytics:** `lib/analytics.ts` — extend `CtaLocation`/`trackSlideView` for any new instrumented surfaces.
