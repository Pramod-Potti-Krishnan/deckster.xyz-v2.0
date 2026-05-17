# Layout Service — Integration asks from the Builder Frontend

> **Audience:** Layout Service team (the service that renders the slide iframe inside the Deckster builder).
>
> **Author:** Builder Frontend team.
>
> **TL;DR:** Two integration gaps are blocking presentation-quality UX on the builder. Both require small changes on your side and unblock large frontend improvements.
>
> 1. **Thumbnail previews** — give us a way to render a real visual preview per slide (image endpoint or pinnable URL). Today we show numbered text cards; competitors show real slide previews.
> 2. **Speaker notes** — please don't render the speaker-notes panel inside the slide viewport. Either honor a "hide notes" signal, or just don't render it; we'll build the notes UI ourselves. **The current overlay is worse than not having notes at all.**

---

## Why this document exists

The Deckster builder embeds the Layout Service via an `<iframe>`. The frontend has full control over the chrome around that iframe (toolbar, drawers, thumbnail strip, chat panel) but **no control over what gets rendered inside it**. Two pieces of in-iframe behavior are damaging the user experience and need cooperation from your side to fix.

We've tried best-effort frontend workarounds (URL parameters, postMessage commands), but without a corresponding handler on the Layout Service side they're no-ops.

---

## Ask 1 — Slide preview images (or pinnable per-slide URLs)

### What we have today

The right column of the builder shows a vertical strip of slide thumbnails. Each card currently shows:

```
┌────────────┐
│      3     │
│            │
│ The Ice    │
│ Age Was a  │
│ Challeng…  │
└────────────┘
```

Just the slide number and the title (truncated). To navigate by content, the user has to read each title.

For comparison: Google Slides, Pitch, Keynote, Beautiful.ai, Pages all show actual mini-renders of each slide in their thumbnail navigators. It's table-stakes for a deck-building product.

### What we need

A way to render a visual representation of each slide at thumbnail size. Three options in order of preference:

#### Preferred — image endpoint

```
GET /presentations/<presentation_id>/slides/<slide_number>/preview.png
GET /presentations/<presentation_id>/slides/<slide_number>/preview.webp
```

- Returns a rendered PNG/WebP of slide N at a thumbnail-appropriate size (suggested: **480 × 270 px**, the 16:9 aspect at 2× the visible thumbnail size so it stays crisp on retina displays)
- Cacheable: `Cache-Control: max-age=300, stale-while-revalidate=3600` is fine; invalidate when the slide content changes
- Authenticated via the same mechanism as `presentationUrl` (existing session token)
- Optional query param `?version=strawman` / `?version=final` to support both preview modes

**Frontend wire-up once this exists:** ~5 lines per thumbnail.

```tsx
<img
  src={`/presentations/${presentationId}/slides/${n}/preview.png?version=${activeVersion}`}
  alt={`Slide ${n} preview`}
  loading="lazy"
  className="w-full aspect-video object-cover"
/>
```

#### Alternative — pinnable slide URL with no chrome

If full PNG rendering is too heavy, support a URL pattern that renders **one slide, no chrome, no notes**, scaled to fit its container:

```
<presentationUrl>?slide=<N>&chrome=none
```

We'd then render small iframes per thumbnail. This is more expensive in the browser (N iframe contexts) but works without server-side image generation.

#### Last resort — websocket push of base64 previews

On every slide-change/save event you push base64-encoded preview images down the existing websocket. We'd cache them client-side.

### Acceptance criteria

- For any slide N in any presentation P, return a visual representation within ~500 ms median
- Updates when the slide content changes (cache invalidation hook, or push a websocket event we can listen to so we know to re-fetch)
- Works for both `strawman` and `final` versions of the deck
- Works while the deck is still being generated (return a placeholder/skeleton image is fine, but don't 404)

### Why this is high-priority

Numbered text columns force users to read every title to find the slide they want. With a 30-slide deck this is genuinely painful. Visual thumbnails are the single biggest navigation win we can ship in the builder — and we can't ship them without you.

---

## Ask 2 — Get the speaker-notes panel out of the slide viewport

### What's happening now

The Layout Service renders a "SPEAKER NOTES" panel at the bottom of the slide viewport. In the current implementation it **overlaps the slide content** — the bottom portion of every slide is occluded by the notes panel.

```
┌────────────────────────────────────────┐
│                                        │
│       closest cousins from             │
│                                        │
│       history                          │
│                                        │
│       The deck opens by challenging    │
│       the 'caveman' stereotype…        │ ← slide content extends here
│                                        │
│ ▰▰▰▰▰▰▰▰ SPEAKER NOTES ▴ ▰▰▰▰▰▰▰▰▰▰  │ ← but notes panel covers it
└────────────────────────────────────────┘
```

This is **worse than not having a notes panel at all** because:

- It cuts off slide content that should be visible
- It looks broken to the user
- In fullscreen presentation mode it's visible behind/over the slide
- It defeats the strawman preview's purpose (showing the user how the slide will look)

### What we need — in priority order

#### Option A (best): honor a "hide notes" signal

Either a URL parameter:

```
<presentationUrl>?showNotes=false
```

…or a postMessage command:

```js
iframe.contentWindow.postMessage({ action: 'hideSpeakerNotes' }, '*')
```

When set, the speaker-notes panel doesn't render. The notes data stays available (presumably already in your data model) for future use.

We've already wired the URL parameter on our side. If you implement the handler we get a fix the moment you deploy — no frontend change needed.

#### Option B (also good): move notes BELOW the slide

Render the speaker-notes panel as a footer *outside* the slide viewport — below the slide, not overlapping. The iframe content becomes slide-on-top, notes-below, with the slide always fully visible.

#### Option C (acceptable): don't render notes at all in the iframe

If neither A nor B is feasible: **don't render the speaker-notes panel inside the iframe**.

We will build our own speaker-notes UI on the frontend in a user-conscious way — likely a collapsible panel below the iframe that the user can show/hide on demand, plus a presenter view that surfaces notes during actual presentation.

Just give us access to the notes data (via the existing message contract, websocket payload, or a `GET /presentations/<id>/slides/<n>/notes` endpoint) and we'll handle the rest.

### Critical: please don't iterate on the in-iframe overlay

The current overlay design isn't fixable by tweaking the panel — it's structurally wrong. **If you can't deliver A or B, please default to C** (no notes panel inside the iframe). We'd rather have nothing to consume than fight an overlay that occludes the slide.

### Acceptance criteria

- Fullscreen presentation mode: speaker notes never visible inside the slide viewport
- Builder preview mode: slide content is fully visible end-to-end, regardless of slide length
- Notes data still accessible to the frontend by some mechanism

---

## What the frontend has already tried

For transparency, here's what we've shipped to compensate:

| Problem | Frontend workaround | Status |
|---|---|---|
| No real thumbnails | Schematic mini-card per slide (fake title bar + body lines + number badge) | Shipped — placeholder only, no actual content |
| Speaker notes overlay | Append `?showNotes=false` to iframe URL on fullscreen entry | Shipped — waiting for backend handler |

Both will become trivial wire-up tasks once your side ships the underlying capability.

---

## Priority + sequencing

| Ask | Why it matters | Backend effort estimate | Frontend wire-up |
|---|---|---|---|
| Thumbnail image endpoint | Biggest navigation UX win; competitors all have it | Medium (render-to-image pipeline) | ~5 LOC per thumbnail |
| Speaker notes — hide signal | Fixes an actively-broken overlay | Small (gate the panel render on a URL param or postMessage) | already wired on our side |
| Speaker notes — separate data endpoint (Option C path) | Enables proper frontend-owned notes UX | Small (expose existing notes data) | Larger (build new notes UI) but we own that work |

If you're capacity-constrained: **ship the speaker-notes "hide signal" first** — it's cheap on your side and unblocks an immediate user-facing fix. The thumbnail endpoint is a bigger lift but higher value.

---

## How we'll consume this

- **Thumbnails endpoint:** consumed in `components/slide-thumbnail-strip.tsx`. We'll swap the schematic placeholder for `<img>` tags pointing at your endpoint. Will lazy-load thumbnails that aren't currently scrolled into view.
- **Speaker notes hide signal:** if you support `?showNotes=false`, our existing append-on-fullscreen wiring at `components/presentation-viewer.tsx` activates immediately. If you go Option C (don't render at all), we'll build the notes UI in the builder chrome — likely as a slide-out drawer with a toggle near the toolbar.

---

## Contact

Reach out to the Builder Frontend team (PR conversation in the deckster-frontend repo or direct channel) when either ask is ready for integration testing.
