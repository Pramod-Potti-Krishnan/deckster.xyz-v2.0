# Operating Model: Immediate Connection & Blank Presentation Architecture

**Document Purpose:** Cross-team contract for Director Service, Layout Service, and Frontend coordination
**Status:** Draft for Review
**Date:** 2026-01-03

---

## Executive Summary

This document proposes a significant change to the Deckster builder page workflow:

**Current:** User must start chatting before any presentation exists. WebSocket connects on first message. Editing tools are inactive until a strawman is generated after multiple conversation turns.

**Proposed:** WebSocket connects immediately when user lands on the builder page. Director coordinates with Layout Service to create a blank presentation (single title slide) instantly. All editing tools are active from the start. User can build manually without any chat, use chat for AI generation, or mix both approaches.

**Key Benefits:**
- Reduced friction - users can start building immediately
- Hybrid workflow - manual editing + AI assistance
- Better UX - no waiting for chat to enable tools

---

## 1. Current Operating Model

### 1.1 Architecture Overview

```
CURRENT FLOW:

    User            Frontend              Director             Layout Service
      |                 |                    |                       |
      |  Opens /builder |                    |                       |
      |---------------->|                    |                       |
      |                 | (No WS connection) |                       |
      |                 | (Tools disabled)   |                       |
      |                 |                    |                       |
      | Sends 1st msg   |                    |                       |
      |---------------->|  Connect WS        |                       |
      |                 |------------------->|                       |
      |                 |  (greeting)        |                       |
      |                 |<-------------------|                       |
      |                 |                    |                       |
      |   (5-10 turn conversation)           |                       |
      |                 |<------------------>|                       |
      |                 |                    |                       |
      |                 |  slide_update      | Create Presentation   |
      |                 |<-------------------|---------------------->|
      |                 |  (strawman URL)    |                       |
      |                 |                    |                       |
      |                 |  Iframe loads URL  |                       |
      |                 |------------------------------------------->|
      |                 |  (Tools now active)|                       |
```

### 1.2 Current Service Responsibilities

| Service | URL | Responsibility |
|---------|-----|----------------|
| **Director** | `wss://directorv33-production.up.railway.app/ws` | Orchestrates AI generation, controls conversation flow |
| **Layout Service** | `https://web-production-f0d13.up.railway.app` | Renders presentations, handles editing via postMessage |
| **Frontend** | `/builder` page | Connects services, manages state, displays UI |

### 1.3 Current Message Types

**Director -> Frontend:**
- `chat_message` - Conversational content
- `action_request` - Binary choices/confirmations
- `status_update` - Progress/loading states
- `slide_update` - Strawman preview (Stage 4) with `preview_url`
- `presentation_url` - Final presentation (Stage 6)
- `sync_response` - Cache synchronization

**Frontend -> Director:**
- `user_message` - User text with optional `store_name`, `file_count`, `content_context`
- `ping` - Heartbeat

### 1.4 Current Pain Points

1. User cannot start building until after substantial chat conversation
2. Editing tools are disabled until strawman generated
3. No way to manually build a presentation without AI
4. User must commit to chat-based workflow from the start

---

## 2. Proposed Operating Model

### 2.1 Architecture Overview

```
PROPOSED FLOW:

    User            Frontend              Director             Layout Service
      |                 |                    |                       |
      |  Opens /builder |                    |                       |
      |---------------->|  Connect WS IMMEDIATELY                    |
      |                 |------------------->|                       |
      |                 |                    | create_blank_presentation
      |                 |                    |---------------------->|
      |                 |                    |   blank_pres_url      |
      |                 |                    |<----------------------|
      |                 |  presentation_ready|                       |
      |                 |<-------------------|                       |
      |                 |                    |                       |
      |                 |  Iframe loads URL  |                       |
      |                 |------------------------------------------->|
      |                 |  (ALL TOOLS ACTIVE)|                       |
      |                 |                    |                       |
      |  User can now:  |                    |                       |
      |  - Build manually (no chat)          |                       |
      |  - Chat with AI                      |                       |
      |  - Mix both approaches               |                       |
```

### 2.2 Key Changes Summary

| Aspect | Current | Proposed |
|--------|---------|----------|
| WebSocket Connection | On first message | Immediately on page load |
| Initial Presentation | None until Stage 4 | Blank title slide immediately |
| Editing Tools | Disabled until strawman | Active from start |
| Director Awareness | Only AI-generated content | All content (manual + AI synced) |
| User Modes | Chat-only | Manual-only, Chat-only, or Mixed |
| Version URLs | `?session_id=xxx` | Add `&view=strawman` / `&view=final` |

### 2.3 User Workflow Options

**Option A: Manual Only**
1. User lands on page, sees blank presentation
2. Adds slides, edits content using toolbar
3. Downloads/exports when done
4. Never uses chat

**Option B: Chat Only (Current Flow, Enhanced)**
1. User lands on page, sees blank presentation
2. Starts chatting with AI
3. AI generates strawman (replaces blank slide)
4. User refines through chat
5. Final presentation generated

**Option C: Mixed Mode**
1. User lands on page, sees blank presentation
2. Manually creates 3 slides
3. Starts chatting: "Add slides about market trends"
4. AI generates additional slides (preserves manual work)
5. User continues editing manually or via chat

---

## 3. Service Contracts

### 3.1 Director Service - NEW Requirements

#### 3.1.1 Immediate Blank Presentation on Connect

**Trigger:** WebSocket connection established (no user message required)

**Action:**
1. Create session if not exists
2. Call Layout Service to create blank presentation
3. Send `presentation_ready` message to frontend

**New Message Type: `presentation_ready`**
```json
{
  "message_id": "msg_xxx",
  "session_id": "uuid",
  "timestamp": "2026-01-03T10:00:00.000Z",
  "type": "presentation_ready",
  "payload": {
    "url": "https://web-production-f0d13.up.railway.app/p/uuid",
    "presentation_id": "uuid",
    "is_blank": true,
    "slide_count": 1
  }
}
```

[<Director Service>: **APPROVED with modification.** We recommend reusing the existing `slide_update` message type with an `is_blank: true` flag rather than creating a new `presentation_ready` type. This reduces frontend changes and maintains protocol consistency. The `slide_update` already has `metadata.preview_url` and `metadata.preview_presentation_id` fields that serve the same purpose. We will also call DeckBuilder (existing integration) rather than Layout Service directly for blank creation.]

#### 3.1.2 Edit Synchronization

**Trigger:** Frontend sends `edit_sync` message when user makes manual edits

**Action:**
1. Store slide state for context awareness
2. Track what slides exist (count, types)
3. Make this context available to AI agents

**New Message Type: `edit_sync` (Frontend -> Director)**
```json
{
  "type": "edit_sync",
  "data": {
    "presentation_id": "uuid",
    "operation": "slide_added | slide_deleted | slide_modified | slide_reordered",
    "slide_index": 2,
    "slide_count": 3,
    "element_type": "text | image | chart | table",
    "change_summary": "Added new slide with title 'Market Analysis'"
  }
}
```

[<Director Service>: **APPROVED.** We will implement `edit_sync` as a new message type. Suggest adding debounce on frontend side (1s for text changes, immediate for slide CRUD operations) to reduce message volume. Director will store the sync state in `SessionV4.edit_sync_state` for AI context awareness. We also recommend adding `has_user_content: boolean` and `slide_summaries: [{slide_id, slide_type, title}]` to the payload for richer context.]

#### 3.1.3 Mixed Mode Generation Logic

**Rule:** When user has manual slides and requests AI generation:
- **If only blank title slide exists:** AI can replace it
- **If user has created content:** AI ADDS slides, does not replace
- AI should acknowledge existing work: "I see you have 3 slides. I'll add 5 more about..."

[<Director Service>: **APPROVED with clarification.** The "AI ADDS, does not replace" rule is clear. For the edge case in Open Question #4 (user deletes all manual slides after AI sees them): Director will detect `slide_count=0` via `edit_sync` and treat as blank state, allowing AI to replace. Implementation will use `StrawmanRefiner.merge_with_manual_edits()` with "append" strategy. The Decision Engine's system prompt will be updated to acknowledge existing user work before suggesting additions.]

### 3.2 Layout Service - NEW Requirements

#### 3.2.1 Blank Presentation Creation

**Option A: Enhanced Existing Endpoint**
```
POST /api/presentations
{
  "blank": true,
  "session_id": "uuid",
  "user_id": "string"
}

Response:
{
  "id": "uuid",
  "url": "/p/{id}",
  "slide_count": 1
}
```

**Option B: New Dedicated Endpoint**
```
POST /api/presentations/blank
{
  "session_id": "uuid",
  "user_id": "string"
}

Response:
{
  "id": "uuid",
  "url": "/p/{id}",
  "slide_count": 1,
  "layout": "blank-title"
}
```

**Performance Requirement:** < 500ms response time

[<Layout Service>: **We recommend Option A.** Current POST /api/presentations already achieves 20-70ms (filesystem) and 100-300ms (Supabase) - far exceeding the <500ms requirement. Adding a `blank: true` parameter is trivial (~10 lines), avoids code duplication, and maintains a single source of truth. We propose using `C1-text` as the default layout for blank presentations. No new endpoint needed.]

#### 3.2.2 Edit Event Broadcasting

**New postMessage Event: `slide_content_changed`**

Emit when any slide CRUD operation occurs:

```typescript
{
  action: 'slide_content_changed',
  data: {
    slideIndex: 2,
    changeType: 'add' | 'modify' | 'delete',
    elementType: 'text' | 'image' | 'chart' | 'table' | 'slide',
    elementId: 'element_xxx',
    timestamp: 1704268800000
  }
}
```

**Trigger Points:**
- `addSlide` command executed
- `deleteSlides` command executed
- `duplicateSlide` command executed
- `reorderSlides` command executed
- Any element added/modified/deleted
- Text content changed (debounced)

[<Layout Service>: **Feasible, ~30 min implementation.** We already have 70+ postMessage actions with proven outbound event patterns (textBoxSelected, chartRendered). For text changes, we'll fire on blur/focus-loss instead of debounced keystrokes - this is less chatty and aligns with your requirements. We recommend a simplified payload (omit `elementId`, parent can query via `getSlideInfo` if needed). Also clarify: should this fire for theme/style changes? We suggest NO - those are presentation-level, not slide-content-level.]

### 3.3 Frontend - NEW Requirements

#### 3.3.1 Immediate WebSocket Connection

```typescript
// Current: Connect on first message
useEffect(() => {
  if (hasUserMessage && !isConnected) {
    connect();
  }
}, [hasUserMessage]);

// Proposed: Connect immediately
useEffect(() => {
  connect(); // Immediate connection on mount
}, []);
```

#### 3.3.2 Handle `presentation_ready` Message

```typescript
case 'presentation_ready':
  setPresentationUrl(message.payload.url);
  setPresentationId(message.payload.presentation_id);
  setIsBlankPresentation(message.payload.is_blank);
  setIframeReady(false); // Will be true after iframe loads
  break;
```

#### 3.3.3 Edit Sync Relay

```typescript
// Listen for Layout Service events
window.addEventListener('message', (event) => {
  if (event.origin !== VIEWER_ORIGIN) return;

  if (event.data.action === 'slide_content_changed') {
    // Forward to Director
    sendMessage({
      type: 'edit_sync',
      data: {
        presentation_id: currentPresentationId,
        operation: mapChangeType(event.data.data.changeType),
        slide_index: event.data.data.slideIndex,
        slide_count: currentSlideCount,
        element_type: event.data.data.elementType,
        change_summary: generateSummary(event.data.data)
      }
    });
  }
});
```

#### 3.3.4 Version URL Parameters

```typescript
// Parse version from URL
const searchParams = useSearchParams();
const viewParam = searchParams.get('view'); // 'strawman' | 'final' | null

// Apply version
useEffect(() => {
  if (viewParam === 'strawman' && strawmanPreviewUrl) {
    setPresentationUrl(strawmanPreviewUrl);
    setActiveVersion('strawman');
  } else if (viewParam === 'final' && finalPresentationUrl) {
    setPresentationUrl(finalPresentationUrl);
    setActiveVersion('final');
  }
}, [viewParam, strawmanPreviewUrl, finalPresentationUrl]);

// Update URL when version changes
const switchVersion = (version: 'strawman' | 'final') => {
  const url = new URL(window.location.href);
  url.searchParams.set('view', version);
  router.push(url.toString());
};
```

---

## 4. Sequence Diagrams

### 4.1 New User Landing (Proposed)

```
User           Frontend         Director        Layout Service
  |                |                |                |
  | GET /builder   |                |                |
  |--------------->|                |                |
  |                |                |                |
  |  Page renders  |                |                |
  |<---------------|                |                |
  |                |                |                |
  |                | WS Connect     |                |
  |                |(session_id,    |                |
  |                | user_id)       |                |
  |                |--------------->|                |
  |                |                |                |
  |                |                | POST /api/presentations/blank
  |                |                |--------------->|
  |                |                |                |
  |                |                | {id, url}      |
  |                |                |<---------------|
  |                |                |                |
  |                | presentation_ready              |
  |                | {url, id,      |                |
  |                |  is_blank:true}|                |
  |                |<---------------|                |
  |                |                |                |
  |                | Load iframe    |                |
  |                |-------------------------------->|
  |                |                |                |
  | Sees blank     |                |                |
  | title slide    |                |                |
  | ALL TOOLS      |                |                |
  | ACTIVE         |                |                |
  |<---------------|                |                |
```

### 4.2 Manual Editing (No Chat)

```
User           Frontend         Director        Layout Service
  |                |                |                |
  | Click "Add     |                |                |
  |  Slide"        |                |                |
  |--------------->|                |                |
  |                | postMessage    |                |
  |                | {action:       |                |
  |                |  'addSlide'}   |                |
  |                |-------------------------------->|
  |                |                |                |
  |                | slide_content_changed           |
  |                |<--------------------------------|
  |                |                |                |
  |                | edit_sync      |                |
  |                | {operation:    |                |
  |                |  'slide_added'}|                |
  |                |--------------->|                |
  |                |                | (Director      |
  |                |                |  stores state) |
  |                |                |                |
  | Edit text      |                |                |
  |--------------->|                |                |
  |                | postMessage    |                |
  |                | {action:       |                |
  |                |  'updateText'} |                |
  |                |-------------------------------->|
  |                |                |                |
  |                | slide_content_changed           |
  |                |<--------------------------------|
  |                |                |                |
  |                | edit_sync      |                |
  |                | {operation:    |                |
  |                |  'slide_modified'}              |
  |                |--------------->|                |
```

### 4.3 Mixed Mode (Manual + AI)

```
User           Frontend         Director        Layout Service
  |                |                |                |
  | (Has 3 manual  |                |                |
  |  slides from   |                |                |
  |  earlier edits)|                |                |
  |                |                |                |
  | "Add slides    |                |                |
  |  about market  |                |                |
  |  trends"       |                |                |
  |--------------->|                |                |
  |                | user_message   |                |
  |                |--------------->|                |
  |                |                |                |
  |                |                | (Director has  |
  |                |                |  slide state   |
  |                |                |  from edit_sync|
  |                |                |  messages)     |
  |                |                |                |
  |                | chat_message   |                |
  |                | "I see you     |                |
  |                |  have 3 slides.|                |
  |                |  I'll add 4    |                |
  |                |  more..."      |                |
  |                |<---------------|                |
  |                |                |                |
  | "Yes, go ahead"|                |                |
  |--------------->|                |                |
  |                | user_message   |                |
  |                |--------------->|                |
  |                |                |                |
  |                |                | APPEND 4 new   |
  |                |                | slides to      |
  |                |                | existing 3     |
  |                |                |--------------->|
  |                |                |                |
  |                | slide_update   |                |
  |                | (7 total slides)|               |
  |                |<---------------|                |
  |                |                |                |
  | Views combined |                |                |
  | presentation   |                |                |
  | (3 manual +    |                |                |
  |  4 AI slides)  |                |                |
  |<---------------|                |                |
```

### 4.4 Version Switching (Strawman/Final)

```
User           Frontend         Director        Layout Service
  |                |                |                |
  | (Viewing       |                |                |
  |  strawman)     |                |                |
  | URL: ?view=    |                |                |
  |      strawman  |                |                |
  |                |                |                |
  | Clicks         |                |                |
  | "Accept"       |                |                |
  |--------------->|                |                |
  |                | user_message   |                |
  |                | "accept_plan"  |                |
  |                |--------------->|                |
  |                |                | Generate final |
  |                |                |--------------->|
  |                |                | final URL      |
  |                |                |<---------------|
  |                | presentation_url                |
  |                |<---------------|                |
  |                |                |                |
  |                | Update URL to  |                |
  |                | ?view=final    |                |
  |                | Load final     |                |
  |                |-------------------------------->|
  |                |                |                |
  | Clicks "View   |                |                |
  |  Strawman"     |                |                |
  |--------------->|                |                |
  |                | Update URL to  |                |
  |                | ?view=strawman |                |
  |                | Load strawman  |                |
  |                |-------------------------------->|
```

---

## 5. Implementation Phases

### Phase 1: Immediate Connection + Blank Presentation (MVP)

| Service | Task | Priority |
|---------|------|----------|
| **Layout Service** | Add blank presentation creation endpoint | P0 |
| **Director** | Support WS connect without user message | P0 |
| **Director** | Create blank presentation on connect | P0 |
| **Director** | Implement `presentation_ready` message | P0 |
| **Frontend** | Connect WebSocket immediately on mount | P0 |
| **Frontend** | Handle `presentation_ready` message | P0 |
| **Frontend** | Enable tools on page load | P0 |

### Phase 2: Edit Synchronization

| Service | Task | Priority |
|---------|------|----------|
| **Layout Service** | Emit `slide_content_changed` events | P1 |
| **Director** | Implement `edit_sync` handler | P1 |
| **Director** | Store slide state for AI context | P1 |
| **Frontend** | Listen for iframe edit events | P1 |
| **Frontend** | Forward edits to Director | P1 |

### Phase 3: Mixed Mode Generation

| Service | Task | Priority |
|---------|------|----------|
| **Director** | Detect existing manual content | P2 |
| **Director** | Implement append vs replace logic | P2 |
| **Director** | Update AI prompts for context awareness | P2 |

### Phase 4: Version URL Parameters

| Service | Task | Priority |
|---------|------|----------|
| **Frontend** | Parse `view` URL parameter | P3 |
| **Frontend** | Update URL on version switch | P3 |
| **Frontend** | Handle browser back/forward | P3 |

[<Director Service>: **Timeline accepted.** Phase 1 (MVP) requires ~3-4 days implementation + ~2 days testing for Director Service. Phase 2-3 can follow incrementally. We will use feature flag `ENABLE_BLANK_PRESENTATION=false` (disabled by default) for safe rollback. Suggest gradual rollout: 10% → 50% → 100% over 3 weeks after initial deployment.]

---

## 6. Open Questions

1. **Blank Presentation Cleanup:** How long to retain unused blank presentations? (Suggest: 24h)

2. **Edit Sync Granularity:** Sync every change or debounce? (Suggest: Debounce 1s for text, immediate for slide CRUD)

3. **Performance SLA:** What's acceptable latency for blank creation? (Suggest: <500ms)

4. **AI Behavior Edge Case:** If user deletes all manual slides after AI sees them, what happens?

5. **Session Persistence:** Should blank presentations create a database session immediately, or only on first edit/chat?

---

## 7. Critical Files

**Frontend:**
- `/hooks/use-deckster-websocket-v2.ts` - WebSocket hook (immediate connection, new message handlers)
- `/app/builder/page.tsx` - Builder page (connection timing, URL params)
- `/components/presentation-viewer.tsx` - Iframe (edit event listeners)

**Documentation:**
- `/docs/integrations/director-v3.4.md` - Director integration guide
- `/docs/LAYOUT_SERVICE_ORCHESTRATION.md` - Layout Service API docs

---

## 8. Rollback Plan

| Service | Rollback Mechanism |
|---------|-------------------|
| **Frontend** | Feature flag: `NEXT_PUBLIC_IMMEDIATE_CONNECTION=false` |
| **Director** | Environment variable: `ENABLE_BLANK_PRESENTATION=false` |
| **Layout Service** | New endpoint is additive, no rollback needed |

---

## Approval Signatures

| Team | Reviewer | Status | Date |
|------|----------|--------|------|
| Director Service | Director Service Team | ✅ Approved with Modifications | 2026-01-03 |
| Layout Service | Layout Service Team | ✅ Approved with Comments | 2026-01-03 |
| Frontend | Frontend Team | ✅ Approved - All modifications accepted | 2026-01-03 |

---

## 9. Review Guidelines

### Inline Comments Convention

When adding comments within the document, use the following format:

```
[<Director Service>: Your comment here]
[<Layout Service>: Your comment here]
```

**Examples:**
- `[<Director Service>: This timeline seems aggressive, suggest 2 weeks for Phase 1]`
- `[<Layout Service>: We already have a similar endpoint, can reuse /api/presentations with blank=true param]`

### Review Sections

Each team should add their comprehensive feedback in their designated section below.

---

## 10. Director Service Team Feedback

**Reviewer:** Director Service Team (Claude Code Technical Review)
**Date:** 2026-01-03

### General Observations

The proposal is well-structured and addresses a real UX pain point. The phased approach is sensible and aligns with agile delivery practices. Director Agent v4.0's architecture (Decision Engine + flexible SessionV4 model with progress flags) is well-suited for these changes. The existing infrastructure already supports most of the required modifications.

**Key Architecture Alignment:**
- v4.0 uses AI-driven decision making, not rigid state machine - fits mixed mode naturally
- SessionV4.context dict provides flexible storage for edit_sync state
- StrawmanRefiner already has merge infrastructure for combining content
- DeckBuilderClient exists and can be extended for blank presentation creation

### Technical Feasibility

| Requirement | Feasibility | Effort | Notes |
|-------------|-------------|--------|-------|
| 3.1.1 Immediate blank presentation | ✅ FEASIBLE | 3-4 days | Modify `websocket.py` connect handler |
| 3.1.2 Edit synchronization | ✅ FEASIBLE | 2 days | New message type + session storage |
| 3.1.3 Mixed mode generation | ✅ FEASIBLE | 2 days | StrawmanRefiner already has merge infra |
| <500ms latency | ⚠️ DEPENDENT | N/A | Requires DeckBuilder to support fast blank creation |
| Session cleanup | ✅ FEASIBLE | 1 day | New cleanup utility with scheduled job |

**Total Estimated Effort:** ~8-10 days implementation + testing

### Concerns / Disagreements

1. **New `presentation_ready` message type**: We **recommend AGAINST** creating a new message type. Instead, reuse `slide_update` with `is_blank: true` flag.
   - **Benefits:**
     - Less frontend code change (one fewer message type to handle)
     - Consistent with existing protocol patterns
     - `slide_update` already has `metadata.preview_url` and `metadata.preview_presentation_id` fields
   - **Implementation:** Add `is_blank: bool = Field(False)` to `SlideUpdatePayload`

2. **Service ownership for blank creation**: Document shows Director calling Layout Service. We **recommend Director calls DeckBuilder** (existing integration via `DeckBuilderClient`).
   - Layout Service is for layout selection/rendering, not presentation CRUD
   - DeckBuilder already handles presentation creation via `POST /api/presentations`
   - We'll add `blank=true` query param to signal minimal slide generation

3. **Session cleanup overhead**: Immediate session creation will generate orphan records.
   - We'll implement 24h cleanup job (`src/utils/session_cleanup.py`)
   - Recommend monitoring Supabase `dr_sessions_v4` table size in first week
   - Cleanup query: `has_blank_presentation=TRUE AND has_topic=FALSE AND created_at < now() - 24h`

4. **Greeting behavior**: Document doesn't specify if blank presentation replaces or accompanies greeting.
   - Our implementation: Send blank `slide_update` FIRST, then send greeting `chat_message`
   - Allows tools-first UX while maintaining conversational context

### Suggested Modifications

1. **Replace `presentation_ready` → `slide_update`** with `is_blank: true` flag
2. **Add `is_blank: boolean`** field to existing `SlideUpdatePayload` (not new message type)
3. **Director calls DeckBuilder** for blank creation, not Layout Service
4. **Add `edit_sync`** as new `MessageType` enum value (Frontend → Director only, no response)
5. **Feature flag:** `ENABLE_BLANK_PRESENTATION=false` (disabled by default for safe rollback)
6. **Enhanced `edit_sync` payload** - recommend adding:
   ```json
   {
     "slide_count": 3,
     "slide_summaries": [{"slide_id": "1", "slide_type": "title", "title": "My Pres"}],
     "has_user_content": true,
     "last_edit_timestamp": "2026-01-03T10:00:00Z"
   }
   ```

### Questions for Frontend Team

1. **Greeting + Blank slide order:** Should `slide_update` with `is_blank=true` arrive BEFORE or AFTER the greeting `chat_message`? (We propose: slide_update first, greeting second)

2. **Edit sync acknowledgment:** Should Director send an acknowledgment for each `edit_sync` message, or is fire-and-forget acceptable? (We propose: fire-and-forget for performance)

3. **Version URL params:** Does frontend need Director to send BOTH strawman and final URLs in a single message (dual-URL response), or are separate messages acceptable?

4. **Error handling:** If blank presentation creation fails (DeckBuilder timeout), should Director:
   - (A) Continue with greeting only (degraded UX)
   - (B) Send error message and close connection
   - (C) Retry once then fallback to (A)
   (We propose: Option C)

5. **Slide count tracking:** For `edit_sync`, should frontend track and send total slide count, or should Director query DeckBuilder for current state?

---

## 11. Layout Service Team Feedback

**Reviewer:** Layout Service Team (Claude Code Analysis)
**Date:** 2026-01-03

### General Observations

- Proposal is well-structured and aligns with Layout Service architecture
- Performance requirements (<500ms) are already met by current implementation
- PostMessage infrastructure supports the proposed `slide_content_changed` event pattern
- The "Format Ownership Model" (Layout Service owns structure, Text Service owns content) is preserved

### Technical Feasibility

**3.2.1 Blank Presentation Creation: ✅ FULLY FEASIBLE**
- Current response times: 20-70ms (filesystem), 100-300ms (Supabase)
- <500ms requirement easily achieved with significant headroom
- **Recommend Option A** (enhanced existing endpoint):
  - Avoids code duplication
  - Single source of truth for presentation creation
  - Trivial implementation (~10 lines)
  - Already have `get_default_content()` for any layout

**3.2.2 Edit Event Broadcasting: ✅ FEASIBLE**
- 70+ postMessage actions already supported
- Outbound event pattern proven (textBoxSelected, chartRendered)
- Implementation: ~30 minutes for simple notification approach
- Key integration point: `src/utils/element-manager.js`

**Proposed Implementation:**
- Default layout: `C1-text` (text-focused content slide)
- Text change events: Fire on blur/focus loss only (not every keystroke)
- Event payload: Simple notification (parent queries for full state if needed)

### Concerns / Disagreements

1. **Event Payload Simplification**: The proposed `slide_content_changed` spec includes `elementId` and detailed change info. We recommend starting simpler:
   ```javascript
   {
     action: 'slide_content_changed',
     data: {
       slideIndex: number,
       changeType: 'add' | 'modify' | 'delete',
       elementType: 'text' | 'image' | 'chart' | 'slide',
       timestamp: number
     }
   }
   ```
   Parent can call `getSlideInfo` RPC if details needed.

2. **Debouncing Clarification**: Document specifies "debounced" for text but doesn't specify timing. We'll implement blur/focus-loss triggering instead of time-based debounce for text edits.

3. **Theme Changes**: Document doesn't specify if `slide_content_changed` should fire for theme/style changes. Suggest: NO - theme changes are presentation-level, not slide-content-level.

### Suggested Modifications

1. **Section 3.2.1**: Update Option A to show `C1-text` as default layout instead of generic "blank-title"

2. **Section 3.2.2**: Simplify event payload specification per our recommendation above

3. **Add to Open Questions**: "Should blank presentations be persisted immediately or only on first edit?" (We can support either)

### Questions for Frontend Team

1. Should the blank presentation have a default title ("Untitled Presentation") or empty string?
2. Do you want a loading state while blank presentation creates, or assume it's instant (<300ms)?
3. For the `edit_sync` relay - do you need acknowledgment from Director, or fire-and-forget?
4. Should we emit `slide_content_changed` for programmatic updates (via postMessage from parent), or only user-initiated edits?


---

## 12. Joint Discussion Notes

_To be filled during cross-team review meeting_

---

## 13. Agreement Summary

### 13.1 FULLY AGREED Items

| Item | Description | Agreed By | Notes |
|------|-------------|-----------|-------|
| **Immediate WS Connection** | WebSocket connects on page load, not on first message | All Teams | Core feature approved |
| **Blank Presentation on Connect** | Single blank slide provided immediately | Director ✅, Layout ✅ | Both teams confirmed feasibility |
| **Edit Synchronization (3.1.2)** | `edit_sync` message type approved | Director ✅ | New message type accepted |
| **Mixed Mode Logic (3.1.3)** | AI adds slides, doesn't replace user content | Director ✅ | Edge case clarified |
| **Blank Creation via Option A** | Use existing `POST /api/presentations` with `blank=true` | Layout ✅ | No new endpoint needed |
| **Performance SLA** | <500ms for blank creation | Layout ✅ | Already achieving 20-300ms |
| **Edit Event Broadcasting** | `slide_content_changed` postMessage event | Layout ✅ | ~30 min implementation |
| **Text Change Triggering** | Fire on blur/focus-loss, not keystrokes | Layout ✅ | Less chatty approach |
| **Theme Changes Excluded** | `slide_content_changed` should NOT fire for theme/style changes | Layout ✅ | Presentation-level, not slide-level |
| **Implementation Phases** | 4-phase rollout accepted | Director ✅ | Phase 1: 3-4 days Director |
| **Feature Flag Rollback** | `ENABLE_BLANK_PRESENTATION=false` default | Director ✅ | Safe rollback mechanism |
| **Session Cleanup** | 24h cleanup for unused blank presentations | Director ✅ | Open Question #1 resolved |
| **Debounce Strategy** | 1s for text, immediate for slide CRUD | Director ✅ | Open Question #2 resolved |

### 13.2 AGREED WITH MODIFICATIONS (Frontend Accepted)

| Item | Original Proposal | Team Modification | Status | Teams Involved |
|------|-------------------|-------------------|--------|----------------|
| **Message Type for Blank** | New `presentation_ready` message | Director: Use existing `slide_update` with `is_blank: true` flag | ✅ ACCEPTED | **Frontend ↔ Director** |
| **Event Payload** | Include `elementId` in `slide_content_changed` | Layout: Omit `elementId`, keep simpler payload | ✅ ACCEPTED | **Frontend ↔ Layout** |
| **Enhanced edit_sync Payload** | Basic payload | Director: Add `has_user_content`, `slide_summaries`, `last_edit_timestamp` | ✅ ACCEPTED | **Frontend ↔ Director** |
| **Default Layout** | Generic "blank-title" | Layout: Use `C1-text` layout | ✅ ACCEPTED | **Frontend ↔ Layout** |

[<Frontend>: All proposed modifications accepted. We will update our message handlers to use `slide_update` with `is_blank` flag, implement the enhanced `edit_sync` payload with additional fields, and configure the default layout as `C1-text`.]

### 13.3 Frontend Decisions (RESOLVED)

These questions were raised by Director and Layout Service teams. Frontend responses provided below:

#### From Director Service Team:

| # | Question | Director's Proposal | Frontend Decision |
|---|----------|---------------------|-------------------|
| D1 | Should `slide_update` (blank) arrive BEFORE or AFTER greeting `chat_message`? | Slide first, greeting second | ✅ **Slide first, then greeting** - Agreed with Director's proposal |
| D2 | Should Director acknowledge each `edit_sync` message? | Fire-and-forget (no ack) | ✅ **Fire-and-forget** - No acknowledgment needed for performance |
| D3 | Version URLs: Send both strawman+final in single message or separate? | Separate messages acceptable | ✅ **Separate messages** - Current pattern works |
| D4 | If blank creation fails, what should Director do? | Option C: Retry once, then fallback to greeting-only | ✅ **Option C** - Retry once, graceful degradation |
| D5 | Should Frontend track/send slide count, or Director query DeckBuilder? | Frontend sends count | ✅ **Frontend sends count** - Avoids extra API call |

[<Frontend>: All Director proposals accepted. We'll handle slide_update before greeting in our message queue, implement fire-and-forget for edit_sync, and track slide count locally to include in sync messages.]

#### From Layout Service Team:

| # | Question | Layout's Suggestion | Frontend Decision |
|---|----------|---------------------|-------------------|
| L1 | Blank presentation title: "Untitled Presentation" or empty string? | (No preference stated) | ✅ **"Untitled Presentation"** - Clear placeholder for users |
| L2 | Show loading state while blank creates, or assume instant (<300ms)? | (No preference stated) | ✅ **No loading state** - Assume instant (<300ms response) |
| L3 | Emit `slide_content_changed` for programmatic updates (from parent postMessage) or only user-initiated? | (Seeking clarification) | ✅ **User-initiated only** - Avoid echo for programmatic updates |

[<Frontend>: Confirmed Layout Service questions. We'll display "Untitled Presentation" as default, skip loading spinners for blank creation, and only expect `slide_content_changed` events for user-initiated edits (not our own programmatic postMessage calls).]

### 13.4 Resolution Status (ALL RESOLVED)

| Priority | Item | Teams | Status |
|----------|------|-------|--------|
| **P0** | Accept `slide_update` with `is_blank` instead of `presentation_ready` | Frontend ↔ Director | ✅ RESOLVED - Accepted |
| **P0** | Accept simplified event payload (no `elementId`) | Frontend ↔ Layout | ✅ RESOLVED - Accepted |
| **P1** | Answer D1-D5 questions | Frontend → Director | ✅ RESOLVED - All answered |
| **P1** | Answer L1-L3 questions | Frontend → Layout | ✅ RESOLVED - All answered |
| **P2** | Accept enhanced `edit_sync` payload | Frontend ↔ Director | ✅ RESOLVED - Accepted |

---

## 14. Next Steps

~~1. **Frontend Team** to review this document and:~~
   ~~- Accept/reject the modifications in Section 13.2~~
   ~~- Provide answers to questions in Section 13.3~~
   ~~- Add responses using `[<Frontend>: response here]` format~~

~~2. Once Frontend responds, update Section 13 to mark items as ✅ RESOLVED~~

~~3. Schedule joint discussion if any disagreements remain~~

### ✅ DOCUMENT FINALIZED - All Teams Approved (2026-01-03)

**Ready for Implementation:**

1. **Phase 1 (MVP) - Begin Immediately**
   - Director Service: Implement blank presentation on WS connect (~3-4 days)
   - Layout Service: Add `blank=true` support to POST /api/presentations (~1 day)
   - Frontend: Connect WebSocket immediately, handle `slide_update` with `is_blank` (~2 days)

2. **Phase 2 (Edit Sync) - After Phase 1**
   - Layout Service: Implement `slide_content_changed` postMessage event (~30 min)
   - Director Service: Implement `edit_sync` handler (~2 days)
   - Frontend: Listen for iframe events, relay to Director (~1 day)

3. **Phase 3 (Mixed Mode) - After Phase 2**
   - Director Service: Implement append vs replace logic (~2 days)

4. **Phase 4 (Version URLs) - After Phase 3**
   - Frontend: Parse/update URL `view` parameter (~1 day)

---

## 15. Final Confirmation Requests

### 15.1 Director Service Team - Please Confirm

**Frontend has accepted all your proposals. Please confirm these final specifications:**

| Item | Agreed Specification | Your Confirmation |
|------|---------------------|-------------------|
| Message type for blank | `slide_update` with `is_blank: true` flag | ✅ |
| Message order | Slide first, then greeting | ✅ |
| edit_sync acknowledgment | Fire-and-forget (no ack) | ✅ |
| Version URLs | Separate messages | ✅ |
| Error handling | Option C: Retry once, then greeting-only | ✅ |
| Slide count tracking | Frontend sends count in edit_sync | ✅ |
| Enhanced edit_sync payload | Include `has_user_content`, `slide_summaries`, `last_edit_timestamp` | ✅ |

**One remaining open question:**
- **Session Persistence (Open Question #5):** Should blank presentations create a database session immediately, or only on first edit/chat?
  - Frontend preference: Immediate (simpler state management)
  - Please confirm your approach.

[<Director Service>: **CONFIRMED - Ready to implement.**

All 7 specifications confirmed as listed above.

**Open Question #5 (Session Persistence):** We confirm **IMMEDIATE** session creation, aligned with Frontend preference. Implementation details:
- Session created in Supabase `dr_sessions_v4` table on WebSocket connect
- New fields added: `has_blank_presentation`, `blank_presentation_id`
- 24-hour cleanup job will delete unused sessions (where `has_blank_presentation=TRUE AND has_topic=FALSE AND age > 24h`)
- This approach simplifies state management and ensures session_id is available for all subsequent operations

Estimated implementation: Phase 1 = 3-4 days, Phase 2 = 2 days, Phase 3 = 2 days. Ready to begin.]

---

### 15.2 Layout Service Team - Please Confirm

**Frontend has accepted all your proposals. Please confirm these final specifications:**

| Item | Agreed Specification | Your Confirmation |
|------|---------------------|-------------------|
| Endpoint | Option A: `POST /api/presentations` with `blank=true` param | ✅ |
| Default layout | `C1-text` | ✅ |
| Default title | "Untitled Presentation" | ✅ |
| Event payload | Simplified (no `elementId`) | ✅ |
| Text change trigger | On blur/focus-loss only | ✅ |
| Event scope | User-initiated only (no programmatic) | ✅ |
| Theme changes | Excluded from `slide_content_changed` | ✅ |

**One remaining open question:**
- **Session Persistence (Open Question #5):** Should blank presentations be persisted to database immediately on creation, or only on first user edit?
  - You mentioned "We can support either" - please confirm preferred approach.

[<Layout Service>: **CONFIRMED - Ready to implement.**

All 7 specifications confirmed as listed above.

**Open Question #5 (Session Persistence):** We confirm **IMMEDIATE** persistence, aligned with Director and Frontend. Implementation details:
- `POST /api/presentations` with `blank=true` will immediately create and persist the presentation to Supabase
- Presentation stored in `ls_presentations` table with `is_blank=true` flag
- Returns presentation ID and URL within <300ms (current benchmarks: 100-300ms)
- Director's 24-hour cleanup will handle orphaned presentations (we don't need separate cleanup)

**Implementation breakdown:**
- **Phase 1** (~1 day): Add `blank=true` parameter handling to existing endpoint, return `C1-text` slide with "Untitled Presentation" title
- **Phase 2** (~30 min): Add `slide_content_changed` postMessage emission in `element-manager.js` for all CRUD operations, fire on blur for text

**API Contract for blank creation:**
```
POST /api/presentations
Body: { "blank": true, "session_id": "uuid", "user_id": "string" }
Response: { "id": "uuid", "url": "/p/{id}", "slide_count": 1, "layout": "C1-text" }
```

Ready to begin implementation.]

---

### 15.3 Frontend Team - Implementation Commitments

For the record, Frontend commits to:

1. **Phase 1:**
   - Connect WebSocket immediately on `/builder` page mount
   - Handle `slide_update` with `is_blank: true` to load blank presentation
   - Enable all editing tools immediately (no waiting for chat)

2. **Phase 2:**
   - Listen for `slide_content_changed` postMessage from iframe
   - Relay changes to Director via `edit_sync` message
   - Include `slide_count`, `has_user_content`, `slide_summaries`, `last_edit_timestamp` in payload

3. **Phase 4:**
   - Parse `?view=strawman` / `?view=final` URL parameters
   - Update URL on version switch

[<Frontend>: CONFIRMED - Ready to implement per above specifications]
