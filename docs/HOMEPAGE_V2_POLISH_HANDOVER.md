# Homepage V2 polish — handover for next session

> Drop this in a fresh Claude Code session to pick up where this one
> left off. Pair it with the earlier `HOMEPAGE_V2_PRICING_HANDOVER.md`
> if you also want the pricing/trial-backend context — that's the work
> that is still **not done** and is still the main thing blocking a
> wide launch.

---

## TL;DR

Homepage V2 went through ~11 polish PRs after the original Homepage V2
launch (PR #2). Everything in those PRs is **merged to main** and live
on **deckster.xyz**. The homepage now behaves like a deck:

- 6 snap-locked slides + a white footer attached to the last one
- Strict scroll-snap (mandatory) so each section locks into the viewport
- On-screen up/down arrow buttons + keyboard navigation (Arrow/PgUp/Dn/Home/End)
- Per-slide refinements (hero chips, agents knowledge-graph with draggable cards, gallery autoscroll, etc.)

**No tier/trial backend yet** — the previous handover's "trial
provisioning is the big remaining work" is still true.

---

## Where things live

| Thing | Where |
|---|---|
| Repo | `/Users/pk1980/Documents/Software/deckster-frontend` |
| GitHub | `https://github.com/Pramod-Potti-Krishnan/deckster.xyz-v2.0` |
| Production | https://deckster.xyz (Vercel auto-deploys `main`) |
| Latest commit | `c3fb71f` — connectors meet cards + thinner grid + L→R wave sweep (PR #14) |
| Original V2 baseline | `2706f01` (PR #2) |
| Pricing rewrite baseline | `f01cc68` (PR #3) |
| Prior handover | `docs/HOMEPAGE_V2_PRICING_HANDOVER.md` |
| Memory | `/Users/pk1980/.claude/projects/-Users-pk1980-Documents-Software-deckster-frontend/memory/` |

### Recent PR timeline (all merged)

| PR | Branch (deleted) | What it did |
|---|---|---|
| #4 | feat/hero-knowledge-graph-bg | Animated SVG knowledge-graph background in the hero (KG tease for Premium). |
| #5 | feat/homepage-slide-format | First slide-format pass: each section ≈ 100svh, ElementGallery became a horizontal carousel, AgentChoreography went 3+4, SocialProof absorbed into FinalCTA. |
| #6 | feat/homepage-snap-and-fixes | Scroll-snap + agents pyramid + Element Generator added as 8th agent + drop "Start free trial" everywhere. |
| #8 | feat/hero-simplify | Removed the AgentTeam grid + AgentActivityLoop from the hero — redundant with the agents slide below. |
| #9 | feat/homepage-slide-nav | On-screen up/down arrows, mandatory snap, keyboard navigation. |
| #10 | feat/homepage-six-slide-polish | Thinner header bar, hero outcome chips, autoscroll on the gallery, compressed agents slide, deleted fake testimonial in FinalCTA. |
| #11 | feat/agents-connectors-v2 | Solid outlined connector lines between agents (replaced faint dashed). |
| #12 | feat/agents-knowledge-graph | Knowledge-graph rebuild: mesh edges, dynamic position tracking via refs, draggable cards, compact footer merged into FinalCTA. |
| #13 | feat/agents-lightning-grid | Round pulse dots (pixel-based viewBox so they aren't ovals), lightning-grid background, white compact footer. |
| #14 | feat/agents-wave-sweep | Connector endpoints fixed (proper edge-distance math), thinner grid lines, lightning-bolts replaced with left-to-right wave sweep every 4 s. |

PR #7 was opened then closed/superseded by #9.

---

## How the homepage is wired right now

### Page composition

`app/page.tsx`:

```tsx
<div>
  <HomepageSnap />       // adds .snap-homepage to <html>, binds keyboard nav
  <SlideNavArrows />     // soft up/down buttons fixed bottom-right
  <Header />             // sticky h-12 (48 px) header
  <main>
    <Hero />                    data-snap="slide"
    <BuilderDemoSection />      data-snap="slide"
    <ElementGallerySection />   data-snap="slide"
    <AgentChoreographySection /> data-snap="slide"
    <PricingV2Section />        data-snap="slide"
    <FinalCTASection />         data-snap="slide" + compact <Footer /> inside it
  </main>
  {/* Footer NOT rendered here — it's inside FinalCTASection */}
</div>
```

`SocialProofSection.tsx` still exists in the folder but is **not
rendered** anywhere — its pull-quote was absorbed into FinalCTA in PR #5
and then deleted in PR #10.

### Snap mechanics

- `app/globals.css` has `html.snap-homepage` rules:
  - `scroll-snap-type: y mandatory`
  - `scroll-padding-top: 3rem` (matches the 48 px header)
- Each slide section is marked `data-snap="slide"` and gets
  `scroll-snap-align: start` via the same stylesheet.
- The header constant (`HEADER_OFFSET_PX = 48`) is duplicated in
  `HomepageSnap.tsx` and `SlideNavArrows.tsx`. **If you change the
  header height, change all three of these together** + the
  `min-h-[calc(100svh-3rem)]` values on every section (6 sections).
- Keyboard nav: ArrowUp/Down, PageUp/Down, Home, End. Form-field guard
  prevents typing in inputs from triggering slide jumps.

### Header

- `components/layout/Header.tsx` — h-12 sticky, uses
  `public/logo-transparent.png` at `h-8 w-auto`. The original
  `logo-full.png` had a baked-in white background that read as a hard
  card; the transparent variant was generated in PR #5 by stripping
  near-white pixels and cropping to the wordmark bounding box.

### Footer

- `components/layout/Footer.tsx` — exports a single component with a
  `compact?: boolean` prop. Default (full) renders on every other route.
  Compact mode renders a slim, **white** footer with a top border and
  dark text, used only inside `FinalCTASection`.

### Each slide

| Slide | File | Notes |
|---|---|---|
| Hero | `Hero/Hero.tsx` | Headline + 2 CTAs ("Get Started" + "See the team in action") + outcome chips ("Pitch decks · Strategy decks · Product specs") + DECK/SLIDE/ELEMENT scopes + KG background. Agent grid + activity loop removed. |
| BuilderDemo | `BuilderDemo/BuilderDemoSection.tsx` | Wraps `<BuilderDemoLoader />`. `justify-start` so title anchors below header. |
| Gallery | `ElementGallery/ElementGallerySection.tsx` + `ElementGalleryGrid.tsx` | 4 counter cards + filter chips + horizontal scroll-snap carousel with auto-scroll (36 px/s, pauses on hover/focus/manual-scroll/filter-change, prefers-reduced-motion). |
| Agents | `AgentChoreography/*` | See full breakdown below. |
| Pricing | `PricingV2/PricingV2Section.tsx` | 3 tier cards + top-up strip + "See the pricing page" link. CTAs all say "Get Started". |
| FinalCTA | `FinalCTA/FinalCTASection.tsx` + `FinalCTAButton.tsx` | "Talk to the team. Ship the deck." + CTA button + compact `<Footer />` pinned to the bottom of the slide. |

### Agents slide — the most complex piece

`components/marketing/HomepageV2/AgentChoreography/`:

- `AgentChoreographySection.tsx` — the slide itself. Mounts the
  background + overlay, owns a `containerRef` for the pyramid container
  and a `cardRefs` map (one ref per `AgentId`).
- `AgentConnectorOverlay.tsx` — the SVG layer that draws connector
  lines, port dots, and **two traveling pulse circles per edge**.
  - 15 connections total (Director → 3 synthesizers, each synthesizer
    → its specialists, plus feedback edges back upward, plus 2
    cross-row laterals).
  - **Pixel-based dynamic viewBox** — `viewBox="0 0 ${pxW} ${pxH}"`
    where pxW/pxH come from a ResizeObserver. This is what keeps the
    pulse circles perfectly round on the wide pyramid container.
  - **Endpoint maths** uses `min(|hw/ux|, |hh/uy|)` (proper
    ray-rectangle exit distance), then 0.98 EDGE_TUCK so port circles
    sit just inside the rounded card border.
  - Reads each card's `getBoundingClientRect()` every rAF tick so
    dragging a card updates the lines + pulses live.
- `LightningGridBackground.tsx` — two-layer grid:
  1. Faint static grid (24×14 lines, strokeWidth 0.3, opacity 0.06).
  2. Bright cyan copy of the same grid masked to a moving vertical
     band. Band is animated via rAF: 0.5 s sweep left→right every
     4 s total cycle. Wave lights up the grid lines as it passes.
- Cards are draggable via framer-motion `motion.div`:
  - `drag dragMomentum={false} dragElastic={0.15} dragConstraints={pyramidRef}`
  - `whileDrag={{ scale: 1.04, zIndex: 50 }}`
  - `cursor-grab active:cursor-grabbing touch-none`
  - Each card has 3 single-line bullets (`bullets = deep.capabilities.slice(0, 3)`).
    The bullet copy was rewritten to short phrases in
    `lib/marketing/homepage-v2-agent-deep.ts`; the longer original
    capabilities still live further down each agent's array for use on
    the `/agents/[slug]` detail pages.
  - Title is `text-3xl sm:text-4xl md:text-5xl` with the brand gradient
    applied to the phrase "one-size-fits-all model."
- Hint under the title: **"Drag any agent to rearrange the graph"**.

### Slide-nav arrows

`components/marketing/HomepageV2/SlideNavArrows.tsx` — soft dark glass
buttons fixed bottom-right. Up greys out on hero, down greys out on the
last slide. State recomputed on scroll/resize via rAF-throttled handler.

---

## Locked design decisions — do not re-debate

- **No "free trial" copy anywhere.** All CTAs are "Get Started". Trial
  backend doesn't exist yet (see prior handover).
- **No deck counts or token amounts** on marketing surfaces.
- **8 agents.** Element Generator was added as the 8th in PR #6.
- **Pyramid 1/3/4.** Top: Director. Middle: Content Generator, Slide
  Composer, Element Generator. Bottom: Researcher, Analyst, Visualizer,
  Theme Builder.
- **Footer is white** with dark text, sits inside the FinalCTA snap-slide.
  Standalone full footer still renders on every other route.
- **Hero stays light.** No agent grid, no activity loop — those would
  re-clutter it. The agents slide does the heavy lifting two scrolls
  down.
- **Lightning bolts replaced by L→R wave sweep.** Don't add the bolts
  back — PK said the bolts felt slow and weren't reading.
- **No "fake" testimonial.** The pull-quote ("The first AI tool where I
  stopped fighting the output…") was deleted in PR #10.

---

## What is still not done

### Big one: trial provisioning backend

Pulled forward from the prior handover — **still nothing built**:

- Stripe trial setup (subscription with `trial_period_days: 14`)
- CC capture at signup (Stripe Checkout / SetupIntent)
- 14-day clock storage + countdown UI
- Auto-conversion to Starter on day 15
- Tier enforcement (Researcher gated to Pro, Knowledge Graph to Premium,
  file uploads to Pro)
- Cancel-trial UI

Marketing copy is now silent on trials (`PRICING_COPY.description`
reads "Three tiers. Monthly credits scale with how much you present.
Top up anytime — no surprise bills.") — but until the backend works,
the "Get Started" CTAs all just route to `signIn → /builder` with no
tier provisioning.

### Other open items (from prior handover, still open)

- Top-up purchase flow (Stripe one-time payments)
- In-product tier enforcement in the agent-routing layer
- `/pricing` route still shows the legacy pricing
- Trial-lifecycle emails (day-0, 7, 12, 15)

### Smaller things that surfaced during polish but were left

- Pre-existing hydration warning in `Hero/AgentTeam.tsx` — but that
  component is no longer rendered on `/` (removed in PR #8). It still
  ships in the bundle though; could be deleted entirely if you want
  to clean up.
- `SocialProofSection.tsx` is also a dead file now. Same: can be
  deleted, or kept around in case PK ever wants a real testimonial
  later.

---

## Critical files to read on a fresh session

In order:

1. **This handover.**
2. **Prior handover** — `docs/HOMEPAGE_V2_PRICING_HANDOVER.md` for the
   pricing/trial context.
3. **Memory** — `~/.claude/projects/.../memory/MEMORY.md` and the two
   referenced files. PK is a solo founder; capacity is the binding
   constraint.
4. **Slide list** — `app/page.tsx` for the exact section ordering.
5. **Snap mechanics** — `app/globals.css`
   (search for `.snap-homepage`) +
   `components/marketing/HomepageV2/HomepageSnap.tsx` +
   `components/marketing/HomepageV2/SlideNavArrows.tsx`. Three places
   share the `HEADER_OFFSET_PX = 48` constant.
6. **Agents slide** — `AgentChoreography/AgentChoreographySection.tsx`,
   `AgentConnectorOverlay.tsx`, `LightningGridBackground.tsx`. This is
   the most code-dense slide.
7. **Pricing data** — `lib/marketing/homepage-v2-pricing.ts` (single
   source of truth for tier names, prices, features, CTAs).
8. **Agent data** — `lib/marketing/homepage-v2-content.ts` (AGENT_TEAM,
   icons, colours) + `lib/marketing/homepage-v2-agent-deep.ts`
   (descriptions + capabilities[]; only the first 3 capabilities show
   on the agents slide card, the rest are for `/agents/[slug]`).

---

## Watch-outs

- **Pre-existing dirty working tree.** These files were dirty
  *before* the homepage polish work and belong to a different
  in-flight workstream (likely element-chat). Do **not** stage them:
  - Modified: `.claude/settings.local.json`,
    `components/presentation-viewer.tsx`,
    `components/textbox-format-panel/ai-tab.tsx`,
    `docs/GEMINI_FILE_SEARCH_ARCHITECTURE.md`,
    `prisma/schema.prisma`
  - Untracked: `app/api/element-chat/`, `components/element-chat/`,
    `docs/CURRENT_ELEMENT_FORMS_AUDIT.md`,
    `hooks/use-element-chat.ts`, `scripts/migrate-element-chat.ts`
  - **Always stage by explicit path**, never `git add .`.
- **Pre-existing TS errors.** Baseline is **30 errors** in unrelated
  files (billing, onboarding, stripe, websocket, generation-panel
  metrics-form, etc.). HomepageV2 code is clean. Don't chase the
  baseline; just don't add to it.
- **Stale Finder duplicates** sometimes appear in
  `.next/types/*` as `* 2.ts` files and add ~9 phantom TS errors.
  Clean with `find .next/types -name "* 2*" -delete` before
  re-counting.
- **Auth on Vercel preview URLs fails** because Google OAuth client
  isn't whitelisted for preview subdomains. Auth only works on
  `deckster.xyz` and localhost.
- **Don't undo the locked decisions above.** Hero stays light, footer
  stays white, no trial wording, no fake quotes, etc.
- **Dev mode is slow on this repo.** First `/api/auth/[...nextauth]`
  compile took ~6 minutes for me. After it's warmed, page loads are
  ~300 ms. If you spin up a fresh dev server and curl times out,
  **wait it out** — don't assume the build is broken.
- **Playwright is installed in `/tmp/slide-shots/` ad-hoc** for
  screenshot verification across PRs. Not part of the project's
  node_modules. If you want screenshots, set it up the same way:
  `npm i playwright` in a tmp dir, then drive Chromium with a small
  mjs script.

---

## Verification checklist for the next session

```bash
# 1. Sync
git checkout main
git pull origin main
git log --oneline -5
# Expect c3fb71f at top (or newer if PK has merged more since this handover)

# 2. Cut a fresh branch for whatever comes next
git checkout -b feat/<your-thing>
git status   # confirm only the dirty element-chat files appear, NOT staged

# 3. TS sanity
find .next/types -name "* 2*" -delete
echo -n "Total errors: "; npx tsc --noEmit 2>&1 | grep -c "error TS"
# Expect 30 (baseline)

# 4. Local dev
pnpm dev
# First request will take 1-6 minutes to compile auth. Be patient.
# Open http://localhost:3000 and walk down all six slides:
#   - Hero: thin header, transparent logo, headline + 2 CTAs + chip row + scopes
#   - BuilderDemo: title anchored top, demo content below
#   - Gallery: 4 counters, filter chips, carousel auto-drifts; pauses on hover
#   - Agents: gradient title, 1/3/4 pyramid with 8 cards, 15 connector edges
#     with travelling cyan/coloured dots, faint grid with cyan wave sweeping
#     L→R every ~4 s, "Drag any agent" hint visible. Try dragging a card —
#     connectors should follow live.
#   - Pricing: 3 tier cards "Get Started" + top-up strip + pricing-page link
#   - FinalCTA: "Talk to the team. Ship the deck." + CTA + white footer pinned
#     to bottom of the same slide
#   - Down arrow at bottom-right greys out on hero/finalcta as appropriate;
#     ArrowDown/Up jumps one slide

# 5. Production (only for auth-dependent flows)
# Auth only works on deckster.xyz, not preview URLs.
```

---

## What PK has explicitly authorized for the next session

- Continue building toward the locked decisions above.
- **Wire the trial provisioning backend** (Stripe + auth + tier
  enforcement). This is the main remaining blocker for promoting the
  homepage.
- Build the in-product top-up purchase UI.
- Update the `/pricing` route to match the new tier structure +
  top-up pack details.
- Tier enforcement in the agent routing layer (Researcher behind Pro,
  Knowledge Graph behind Premium, file uploads behind Pro).
- Trial-lifecycle email automation.

What PK has explicitly **not** authorized:

- Adding a forever-free tier.
- Removing the credit-card-required-at-trial requirement.
- Showing deck counts or token amounts on marketing surfaces.
- Mentioning LLM fine-tuning anywhere.
- Re-cluttering the hero with the agent grid.
- Bringing back the fake testimonial quote.
