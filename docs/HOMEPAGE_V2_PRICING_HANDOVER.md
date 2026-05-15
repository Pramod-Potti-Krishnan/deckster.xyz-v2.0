# Homepage V2 — Pricing & Trial: Handover for next session

> Drop this in a fresh Claude Code session to pick up where this one left off.
> Read the **memory files first** (see "Memory" section below) — they carry the
> founder context that should shape every recommendation.

---

## TL;DR

Homepage V2 is **live in production at deckster.xyz** (PR #2 merged to main).
The pricing tiers were just rewritten on a new branch with feature-first
framing (no deck counts, no token amounts). PR is open for review.

The **trial provisioning backend is not built yet** — that's the main piece
of work remaining.

---

## Where things live

| Thing | Where |
|---|---|
| Repo | `/Users/pk1980/Documents/Software/deckster-frontend` |
| GitHub | `https://github.com/Pramod-Potti-Krishnan/deckster.xyz-v2.0` |
| Production domain | https://deckster.xyz |
| Main branch | `main` (V2 of the homepage is live here as of merge of PR #2) |
| Active branch | `feat/homepage-v2-pricing-revamp` (this session's work) |
| Open PR | (created at end of this session — see PR list) |
| Memory | `/Users/pk1980/.claude/projects/-Users-pk1980-Documents-Software-deckster-frontend/memory/` |

### Memory — read these first

- `MEMORY.md` — index
- `user_solo_founder.md` — **PK is a single-person startup**. Capacity (cost AND support burden) is the binding constraint on every decision. No forever-free, no high-touch features, prefer auto-converting flows.
- `project_funding_target.md` — **Goal: 1,000–2,000 paid users at $20/$50/$100 tiers** ⇒ ~$40K–$80K MRR. Every funnel/pricing/marketing decision should optimize for conversion to one of those three tiers, not for raw signup volume.

---

## What's live in production right now

PR #2 merged the full Homepage V2 rebuild (commits `9f79764` → `dc7297b` →
the merge commit `2706f01`). On `main` and live on deckster.xyz:

- **Hero** — dark, agent-led headline; 7-agent team grid; live-activity caption loop; 3 conversational scopes (deck/slide/element); muted breadth footer
- **BuilderDemoSection** — 21s looping animated chat → director → agents pulse → slide assembles. Pure client choreography (`useReducer` + rAF + IntersectionObserver pause)
- **ElementGallerySection** — 4 animated counters + filterable grid. Bespoke SVG glyphs for all 75 cards (8 real Text Labs diagrams: Code Display, Cloud/Logical/Data Architecture, Idea Board, Kanban, Gantt, Multi-Chevron Maturity; ∞ infographics with examples like ladder/rocket/tree/ship/rail)
- **AgentChoreographySection** — 7 deep agent cards linking to /agents/[slug]
- **PricingV2Section** — 3 tier cards (this is what's being rewritten in the open PR)
- **SocialProofSection** — single italic pull-quote
- **FinalCTASection** — auth-aware "Start Building Free" → /builder

`content/agents.ts` was rebuilt with the canonical 7-agent roster so
`/agents/[slug]` detail pages work for: director, researcher, analyst,
content-generator, visualizer, theme-builder, slide-composer.

Legacy `components/marketing/Homepage/` was deleted (verified zero imports).

---

## What this PR (`feat/homepage-v2-pricing-revamp`) just did

Rewrote pricing presentation around **features, not quantities**. Two
sales-psychology decisions baked in:

- **Don't show deck counts on marketing surfaces.** Showing "8 decks/mo"
  frames the product as a quota; showing features frames it as capability.
  Capability sells, scarcity discourages.
- **Don't commit to specific token amounts.** Real usage scales with deck
  complexity, length, and visual richness — promising specific numbers
  invites rage-quits when reality differs.

### Files modified

| File | Change |
|---|---|
| `lib/marketing/homepage-v2-pricing.ts` | Rewritten. New `PricingTier` shape with `usageNote` (qualitative, no numbers), feature lists using "Everything in <prev>, plus:" upsell pattern. Added `topUpHeadline` + `topUpBlurb` to `PRICING_COPY`. |
| `components/marketing/HomepageV2/PricingV2/PricingV2Section.tsx` | Layout updated: feature list dominant, italic usage note above CTA, new `TopUpStrip` component below the tier grid acknowledging top-ups exist. |
| `lib/marketing/homepage-v2-content.ts` | `HERO_COPY.primaryCta` changed from `"Start Building Free"` → `"Start free trial"`. |
| `components/marketing/HomepageV2/FinalCTA/FinalCTAButton.tsx` | Hardcoded button label updated to match. |
| `components/marketing/HomepageV2/FinalCTA/FinalCTASection.tsx` | Subtitle now reads "14-day free trial of Pro features…" instead of "Free to start." |

### Locked design decisions (do NOT re-debate)

These were decided with PK in this session and are baked in:

- **No forever-free tier.** Trial only. Reason: solo capacity. PK explicitly rejected forever-free.
- **14-day trial of full Pro features.** Credit card required at signup. Auto-converts to Starter on day 15.
- **Three paid tiers: $20 / $50 / $100.** Names: Starter / Pro / Premium.
- **Don't show deck counts or token amounts on the homepage** — frame everything as features.
- **Top-ups are a relief valve, not a marketed product.** Mention they exist; don't enumerate pack sizes on the homepage. Pack details ($5/3 decks, $15/10 decks, no Large pack — force upgrade beyond that) live on `/pricing` or in-product.
- **Researcher gates Pro tier.** Knowledge Graph gates Premium. Theme Builder is in Starter (everyone gets themes).
- **CTA copy: "Start free trial"** everywhere. Not "Start Building Free" (misleading), not "Start 14-day free trial" (verbose).
- **Internal token-cost math (for PK to validate, not for users to see):**
  - Per-deck cost benchmark: ~$1 per 12-slide deck (PK's number, untested at scale)
  - Targeting ~60% gross margin
  - Internal quotas: Starter ≈ 8 decks, Pro ≈ 15 (Researcher tax), Premium ≈ 30
  - Top-up packs at slight per-token premium to push upgrade pressure

---

## What's still missing (the real work, for the next session)

### 1. Trial provisioning backend — **the big one**

The CTAs currently route to `signIn('google', { callbackUrl: '/builder' })`.
This is the SAME flow as before — there is no actual trial logic. None of
the following exists:

- Stripe trial setup (subscription with `trial_period_days: 14`)
- CC capture during signup (Stripe Checkout / SetupIntent)
- 14-day clock storage + countdown UI
- Auto-conversion to Starter on day 15
- Tier enforcement in the app (Researcher locked behind Pro; KG behind Premium)
- Cancel-trial UI

The marketing page promises "Start free trial" but the product currently
gives you whatever access you had before. **This needs to be built before
the new homepage can honestly be shipped to a wide audience.**

### 2. Top-up purchase flow

In-product UI to buy top-up packs (Stripe one-time payments). UI for "X
credits remaining" / "20% remaining" / "buy more or upgrade" prompts.

### 3. Tier enforcement in the product

The agent-routing layer needs to:
- Block Researcher invocations on Starter
- Block file uploads on Starter
- Block Knowledge Graph features on Starter + Pro
- Surface a "Upgrade to unlock" prompt instead of just erroring

### 4. The `/pricing` route

That page hasn't been touched. It still shows the legacy pricing (presumably).
Should match the new tier structure + carry the top-up pack details that
the homepage intentionally omits.

### 5. Email automation around trial lifecycle

- Welcome / day-0
- Day-7 nudge ("how's it going?")
- Day-12 nudge ("trial ends in 2 days")
- Day-15 conversion confirmation
- Day-15 cancellation if they cancelled
- Top-up purchase receipts

Out of scope for the homepage rebuild but needed for the trial to work.

---

## Things PK should validate before the trial goes live

1. **The $1/12-slide cost benchmark** across the real feature mix. PK said it was untested. If Researcher decks turn out to be $2 instead of $1.50, Pro margin drops below 50% — quotas need tightening.
2. **Knowledge Graph compute cost** assumption (~$5–10/mo amortized). If embeddings + storage + query cost more, Premium needs more headroom.
3. **Stripe CC-required-trial conversion rate** in their own data. Industry benchmark is 40-60% but YMMV; this drives whether the funnel hits the 1,000–2,000 paid user target.

---

## Critical files to read on a fresh session

In order:
1. **This handover** — `docs/HOMEPAGE_V2_PRICING_HANDOVER.md`
2. **Memory** — `~/.claude/projects/-Users-pk1980-Documents-Software-deckster-frontend/memory/MEMORY.md` and the two referenced files
3. **Pricing data** — `lib/marketing/homepage-v2-pricing.ts`
4. **Pricing UI** — `components/marketing/HomepageV2/PricingV2/PricingV2Section.tsx`
5. **Auth-aware CTA flow** — `components/marketing/HomepageV2/Hero/HeroCTA.tsx` and `FinalCTA/FinalCTAButton.tsx` (the trial-signup flow needs to be wired through these or replace them)
6. **NextAuth config** — `lib/auth-options.ts` (where Stripe trial provisioning would hook in via callbacks)
7. **Existing Stripe code** — `lib/stripe/` and `app/api/webhooks/stripe/` (legacy Stripe wiring already exists for billing — the trial flow should plug into this, not start fresh)

---

## Watch out for

- **Pre-existing dirty working tree.** These files were dirty BEFORE V2 work and belong to a different in-flight workstream (likely the element-chat feature). Do **not** stage them when committing pricing/trial work:
  - Modified: `.claude/settings.local.json`, `components/presentation-viewer.tsx`, `components/textbox-format-panel/ai-tab.tsx`, `docs/GEMINI_FILE_SEARCH_ARCHITECTURE.md`, `prisma/schema.prisma`
  - Untracked: `app/api/element-chat/`, `components/element-chat/`, `docs/CURRENT_ELEMENT_FORMS_AUDIT.md`, `hooks/use-element-chat.ts`, `scripts/migrate-element-chat.ts`
  - Always stage by explicit path, never `git add .`
- **Pre-existing TS errors.** Baseline is ~30 errors in unrelated files (stripe, websocket, billing, onboarding). V2 code is clean. Don't chase the baseline; just don't add to it.
- **Auth on Vercel preview URLs fails** because Google OAuth client isn't whitelisted for preview subdomains. Auth only works on `deckster.xyz` (and localhost). When testing pricing CTAs, test on prod (or set up a stable preview alias and whitelist it once).
- **Don't undo the sales-psychology decisions** in this PR — no deck counts, no token amounts, lead with features. PK was explicit about this.

---

## Verification checklist for the next session

```bash
# 1. Working tree hygiene
git checkout main
git pull origin main
git checkout feat/homepage-v2-pricing-revamp  # or wherever the work continues
git status   # confirm pre-existing dirty files are not staged

# 2. TS clean (V2 paths)
npx tsc --noEmit 2>&1 | grep -E "HomepageV2|homepage-v2" | head
# Expected: empty (no V2 errors)
echo -n "Total errors: "; npx tsc --noEmit 2>&1 | grep -c "error TS"
# Expected: ~30 (baseline, unrelated)

# 3. Local dev
pnpm dev
# Open http://localhost:3000 — verify:
#   - Hero CTA reads "Start free trial" (not "Start Building Free")
#   - Pricing section: 3 cards with feature lists, italic usage note above CTA, top-up strip below the grid
#   - FinalCTA button reads "Start free trial"
#   - No deck counts visible anywhere in pricing
#   - No token amounts visible anywhere in pricing
```

---

## What PK has explicitly authorized for the next session

- Continue building toward the locked decisions above
- Wire the trial provisioning backend (Stripe + auth + tier enforcement)
- Build the in-product top-up purchase UI
- Update the `/pricing` route to match
- Anything else that moves the funnel toward the 1,000–2,000 paid user target

What PK has explicitly **not** authorized:
- Adding a forever-free tier
- Removing the credit-card-required-at-trial requirement
- Showing deck counts or token amounts on marketing surfaces
- Mentioning LLM fine-tuning anywhere (PK mentioned it as a future idea but said explicitly "don't even mention that, because I don't have it now with me")
