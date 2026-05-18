# Director / Agent Orchestration — Real-time activity stream for the builder

> **Audience:** Director Service team (the multi-agent orchestrator that drives slide generation).
>
> **Author:** Builder Frontend team.
>
> **TL;DR:** We want to show users what the agent team is doing in real time inside the builder — a "team status bar" below the slide. To build it without it being marketing theater, we need the backend to emit per-agent events as they happen. Spec below covers the UX we'd build on top, the event shape we need, and what we will *not* build if the events aren't real.

---

## Why this matters

The Deckster homepage sells "8 specialist AI agents working together to build your deck." Today, when users land in the builder, the agents are invisible — there's a chat panel and a slide preview, but no visual evidence the multi-agent team exists. The brand promise from the homepage doesn't carry over.

This proposal closes that gap by surfacing real-time per-agent activity in the builder, so users can:

1. **See the team work** while a deck is generating (turns wait time into anticipation)
2. **Understand chain-of-thought** when something specific changes (Visualizer redoing a chart, Researcher pulling new data)
3. **Trust the system** — opaque AI is the #1 retention barrier; transparency builds confidence

It's the same UX win that Cursor, Claude, ChatGPT, and Linear have ridden over the past 18 months: show the model thinking, watch user perception of intelligence go up.

---

## What the UI will look like (so you know what data is needed)

A **progressive-disclosure status bar** at the bottom of the slide area in the builder. Three states:

### State 1 — Idle (~28px tall)

Single line. Shows the last action with timestamp:

```
Team idle · Last action: Visualizer regenerated chart on slide 4 · 2 min ago      [⌃ expand]
```

### State 2 — Active (auto-expands to ~120-160px)

Live present-tense feed. One line per agent currently doing something:

```
🧭 Director  · scoping deck (8 slides planned)
🔍 Researcher · reading your Q3 PDF (page 8 of 12)
📝 Content Gen · drafting slide 3 headline
```

### State 3 — Expanded (user clicks expand, up to ~300px)

Full chain-of-thought tree. Who called whom, what tool was invoked, what data flowed. For power users + debugging.

```
Director  →  Researcher  →  search_pdf("Q3 revenue.pdf", "ARR growth")
                          ←  3 results extracted (cached)
          →  Analyst     →  compute_growth_rate(ARR, last_4_quarters)
                          ←  +18% QoQ
          →  Visualizer  →  generate_chart(type=waterfall, slide=4)
                          ←  chart rendered (cached)
```

### Visual linking (also requires backend data)

When an agent is working on a specific slide or element, the relevant thumbnail (right strip) gently pulses to show "this is what's changing right now." Requires the events to carry `target_slide` / `target_element` references.

---

## What we need from the backend

A **WebSocket event stream of per-agent activity**, real-time, with enough granularity to render the three states above without inventing intermediate fake steps.

Concretely:

### Event types we need

1. `agent.started` — an agent begins a unit of work
2. `agent.progress` — periodic update during long-running work (optional but valuable for "reading page 8 of 12" style updates)
3. `agent.tool_call` — agent invokes a tool / subservice
4. `agent.tool_result` — tool returns
5. `agent.completed` — agent finishes its unit of work
6. `agent.failed` — agent errors out
7. `orchestration.handoff` — agent A passes work to agent B

### Suggested payload shape

```jsonc
{
  "event": "agent.started",
  "ts": "2026-05-17T14:32:01.245Z",
  "session_id": "sess_abc123",
  "agent": {
    "id": "researcher",                  // matches the 8 agent IDs we already use
    "name": "Researcher"                 // human label for the status bar
  },
  "action": {
    "verb": "reading",                   // present-tense gerund for the UI
    "object": "your Q3 PDF",             // user-facing description
    "detail": "page 8 of 12"             // optional progress detail
  },
  "target": {
    "type": "slide",                     // "slide" | "element" | "deck" | null
    "slide_index": 3,                    // optional — for visual linking
    "element_id": "chart_4a"             // optional — for visual linking
  },
  "trace_id": "trace_xyz789",            // links related events (handoffs)
  "parent_trace_id": "trace_abc456"      // optional — for the call tree
}
```

The exact field names are negotiable; what matters is that **every event has**:

- A specific agent ID (one of the 8 we use)
- A present-tense human-readable verb + object (we display these directly)
- An optional target (slide index / element id) for visual linking
- A trace_id so we can reconstruct the call tree for the expanded view

### Transport

Reuse the existing WebSocket connection between the builder and the Director (the one currently carrying chat messages, slide updates, and generation status). Add a new message type — e.g., `agent_activity` — alongside the existing channels. We'll subscribe and route to the activity panel.

If a separate channel is architecturally cleaner, we can manage two connections — just let us know which way you want it.

---

## What we will NOT build without real events

This is the single most important constraint. **If the events are fabricated** — e.g., showing "Researcher is searching..." as a scripted intermediate caption while the backend actually runs a single LLM call — users will detect this within 2-3 generations and trust will drop sharply. AI users have become very good at spotting theater.

So our commitment to the frontend rollout:

- ✅ **Will build if events are real:** the team status bar exactly as spec'd above
- ❌ **Will NOT build with scripted/fake captions:** a marketing-style fake activity feed
- 🟡 **Will discuss case-by-case:** partial coverage (e.g., we can show real `agent.completed` events but no in-progress states yet) — depends on whether it still delivers user value

If your orchestration today is a single monolithic LLM call with a final result, **please tell us that honestly** rather than retrofit fake intermediate events. We'd rather scope this down or wait for real multi-agent orchestration than ship theater.

---

## Acceptance criteria

For us to ship the user-facing feature:

1. WebSocket emits `agent.started`, `agent.completed`, `agent.failed`, and (ideally) `agent.progress` events as agents actually execute
2. Each event carries the agent ID, a present-tense human-readable action description, and a timestamp
3. Events have a stable `trace_id` so the expanded chain-of-thought view can render the call tree
4. Optional but valuable: `target.slide_index` / `target.element_id` for visual linking to the canvas
5. End-to-end latency: events surface in the WebSocket within ~250ms of the underlying agent action starting
6. Volume: events are emitted only when meaningful — not for every micro-step of a tool call. Rough budget: 5–30 events per slide-generation cycle is healthy; 200+ would be too noisy.

---

## What the frontend will do once the stream exists

- New component `AgentActivityBar` mounted below the slide preview in `components/builder/presentation-area.tsx`
- Subscribes to the new WebSocket message type, maintains a rolling buffer of recent events
- Renders the three states (idle / active / expanded) based on whether agents are currently working
- Pulses thumbnails when events carry `target.slide_index`
- User preference (pinned open / pinned closed / auto) persisted via `next-themes`-style localStorage
- Mobile: collapses to a single "Team working…" pill in narrow viewports

Estimated frontend work once events exist: ~1 week. Most of the complexity is on your side (orchestrating + emitting), not ours (rendering).

---

## Priority

**Medium-high.** This isn't blocking core functionality, but it's one of the highest-leverage *delight* features we can ship — the kind of thing first-time users tell friends about. It's also the feature that lets the homepage's "8 agents" pitch finally pay off inside the product.

Sequencing suggestion: ship after the Layout Service's thumbnail-previews work (the parallel ask doc) since that's a more direct UX gap.

---

## Open questions for the backend team

1. Does the current Director orchestration actually invoke discrete agents per task, or is it a single LLM call internally? (Honest answer determines whether this is buildable now or needs orchestration work first.)
2. Do you already emit any internal trace of which agents/tools run? (LangSmith, Langfuse, OpenTelemetry, or homegrown — any of these can be the source.)
3. What latency budget do you have for emitting events? (Adding a WebSocket emit per agent action adds ~5-20ms per emit, usually negligible but worth confirming.)
4. Any concerns with exposing internal trace data via WebSocket — e.g., does it leak prompts, model names, or anything we'd need to filter before display?

---

## Contact

Reach out to the Builder Frontend team (PR conversation in the deckster-frontend repo or direct channel) when you have a sense of feasibility + timeline. Happy to iterate on the event shape before you commit to anything.
