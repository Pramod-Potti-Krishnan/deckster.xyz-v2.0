# Text Labs Element Generation Integration Plan

> Single source of truth for the multi-phase Text Labs integration into Deckster frontend.

## Status

- **Current Phase**: 1 (Foundation + Text Box)
- **Last Updated**: 2026-02-14

---

## Context

Replace current Elementor per-element API endpoints with Text Labs unified `/api/chat/message` endpoint. Same backend service (Railway URL: `web-production-3b42.up.railway.app`), richer config schemas, 9 element types.

**What changes:**
- Old: separate endpoints per element type (text, chart, image, etc.)
- New: single `/api/chat/message` with `component_type` discriminator and per-type config objects

---

## Architecture

### New Generation Flow

```
Toolbar button -> GenerationPanel (LHS ~350px) -> Config form -> "Generate"
  -> textlabs-client.ts: POST /api/chat/message
  -> Response: { element: { html?, image_url?, component_type } }
  -> sendCommand(iframe, insertMethod, params) -> Element on canvas
```

### Layout Change

```
BEFORE:
┌──────────┬──────────────────────────────────┐
│  Chat    │       PresentationViewer          │
│  25%     │            75%                    │
└──────────┴──────────────────────────────────┘

AFTER:
┌──────────┬─────────────┬────────────────────┐
│  Chat    │ Generation  │ PresentationViewer  │
│  25%     │ Panel ~350px│      flex-1         │
│          │ (conditional│                     │
│          │  slide-in)  │                     │
└──────────┴─────────────┴────────────────────┘
```

### Canvas Insertion Routing

| Component Type | Response Field | Canvas Method |
|---|---|---|
| TEXT_BOX, METRICS, TABLE, SHAPE | `html` | `insertElement` / `insertTextBox` |
| CHART | `html` | `insertChart` |
| IMAGE, ICON_LABEL, INFOGRAPHIC | `image_url` | `insertImage` |
| DIAGRAM (8 subtypes) | `html` | `insertDiagram` |

### Session Management

- One Text Labs session per presentation, lazy creation on first generation request
- Stored in React state via `useTextLabsSession` hook
- Session ID format: `tl_UUID`
- Session persists across panel open/close cycles within same presentation

---

## Phase 1: Foundation + Text Box

Establish the API client, type system, session management, panel shell, and first working element type (TEXT_BOX).

### Files to Create

| File | Purpose |
|---|---|
| `lib/textlabs-client.ts` | API client (`createSession`, `sendMessage`, `healthCheck`) |
| `types/textlabs.ts` | All component types, config interfaces, request/response types |
| `hooks/use-textlabs-session.ts` | Session hook with lazy creation |
| `hooks/use-generation-panel.ts` | Panel open/close state, active element type |
| `components/generation-panel/index.tsx` | Main panel shell with slide-in animation |
| `components/generation-panel/types.ts` | Internal panel types |
| `components/generation-panel/header.tsx` | Header with element type label + close button |
| `components/generation-panel/footer.tsx` | Footer with Generate button + loading state |
| `components/generation-panel/shared/prompt-input.tsx` | Reusable prompt textarea |
| `components/generation-panel/shared/toggle-row.tsx` | Reusable toggle button row |
| `components/generation-panel/forms/text-box-form.tsx` | TEXT_BOX config form |

### Files to Modify

| File | Change |
|---|---|
| `app/builder/page.tsx` | Add GenerationPanel to layout between chat and viewer |
| `components/presentation-viewer.tsx` | Wire toolbar buttons to open GenerationPanel |
| `types/elements.ts` | Add new element type discriminators |

### Checklist

- [ ] `textlabs-client.ts` created with `createSession`, `sendMessage`, `healthCheck`
- [ ] `types/textlabs.ts` with all component types and config interfaces
- [ ] `useTextLabsSession` hook with lazy session creation
- [ ] `useGenerationPanel` hook for panel state
- [ ] GenerationPanel shell with slide-in animation
- [ ] Header with element type label + close button
- [ ] Footer with Generate button + loading state
- [ ] `PromptInput` shared component
- [ ] `ToggleRow` shared component
- [ ] `TextBoxForm` with basic + advanced sections
- [ ] Builder page layout updated (chat | panel | viewer)
- [ ] Text toolbar button opens GenerationPanel
- [ ] Generation flow works end-to-end (prompt -> API -> canvas)

---

## Phase 2: Metrics + Table

Add two data-heavy element types that share formatting controls (font overrides, position presets, padding).

### Files to Create

| File | Purpose |
|---|---|
| `components/generation-panel/shared/font-override-section.tsx` | Reusable font family/size/color overrides |
| `components/generation-panel/shared/position-presets.tsx` | 9-position preset selector |
| `components/generation-panel/shared/padding-control.tsx` | Padding with link-all toggle |
| `components/generation-panel/forms/metrics-form.tsx` | METRICS config form |
| `components/generation-panel/forms/table-form.tsx` | TABLE config form |

### Checklist

- [ ] `FontOverrideSection` reusable component
- [ ] `PositionPresets` with 9 presets
- [ ] `PaddingControl` with link toggle
- [ ] `MetricsForm` with all config fields
- [ ] `TableForm` with all config fields
- [ ] Forms registered in GenerationPanel
- [ ] Toolbar buttons wired

---

## Phase 3: Chart + Image

Add visual element types that use different canvas insertion methods (`insertChart`, `insertImage`).

### Files to Create

| File | Purpose |
|---|---|
| `components/generation-panel/forms/chart-form.tsx` | CHART config form (15 chart types) |
| `components/generation-panel/forms/image-form.tsx` | IMAGE config form (styles, aspect ratios) |

### Checklist

- [ ] `ChartForm` with 15 types, custom data, position
- [ ] `ImageForm` with styles, aspect ratios, position
- [ ] Chart/Image toolbar buttons open GenerationPanel
- [ ] `insertChart` and `insertImage` canvas methods work

---

## Phase 4: Icon/Label + Shape

Add smaller decorative element types.

### Files to Create

| File | Purpose |
|---|---|
| `components/generation-panel/forms/icon-label-form.tsx` | ICON_LABEL config form |
| `components/generation-panel/forms/shape-form.tsx` | SHAPE config form (25 shape types) |

### Checklist

- [ ] `IconLabelForm` with icon/label modes
- [ ] `ShapeForm` with 25 shape types
- [ ] New toolbar buttons added
- [ ] `types/elements.ts` updated with new types

---

## Phase 5: Infographic + Diagram

Add the most complex element types. Infographic supports file upload; Diagram has 8 subtypes each with their own config.

### Files to Create

| File | Purpose |
|---|---|
| `components/generation-panel/forms/infographic-form.tsx` | INFOGRAPHIC config form with multipart upload |
| `components/generation-panel/forms/diagram-form.tsx` | DIAGRAM config form with 8 subtype panels |

### Checklist

- [ ] `InfographicForm` with multipart upload support
- [ ] `DiagramForm` with 8 subtype panels
- [ ] Infographic/Diagram toolbar buttons wired
- [ ] All 9 element types working end-to-end

---

## Phase 6: Polish + Error Handling

Harden the integration with error handling, keyboard shortcuts, and feature flagging.

### Checklist

- [ ] Error handling with toasts and retry
- [ ] Keyboard shortcuts (Escape to close, Cmd+Enter to generate)
- [ ] Feature flag in `config.ts`
- [ ] `CLAUDE.md` and memory updated

---

## Key Constants

### Grid System

- **Grid**: 32 columns x 18 rows
- **Cell size**: 60px per cell
- **Canvas**: 1920 x 1080

### Default Sizes (W x H in grid units, Z-Index)

| Type | W | H | Z |
|------|---|---|---|
| TEXT_BOX | 10 | 6 | 50 |
| METRICS | 8 | 5 | 90 |
| TABLE | 16 | 8 | 50 |
| CHART | 16 | 12 | 50 |
| IMAGE | 12 | 7 | 75 |
| ICON_LABEL | 2 | 2 | 90 |
| SHAPE | 3 | 3 | 10 |
| INFOGRAPHIC | 16 | 9 | 50 |
| DIAGRAM | 30 | 14 | 50 |

### Position Presets (9)

| Preset | Description |
|---|---|
| `full` | Full canvas |
| `half-left` | Left half |
| `half-right` | Right half |
| `quarter-tl` | Top-left quarter |
| `quarter-tr` | Top-right quarter |
| `quarter-bl` | Bottom-left quarter |
| `quarter-br` | Bottom-right quarter |
| `center-wide` | Centered wide rectangle |
| `center-square` | Centered square |

### API Key Mapping (camelCase -> snake_case)

| Frontend (camelCase) | API (snake_case) |
|---|---|
| `textboxConfig` | `textbox_config` |
| `metricsConfig` | `metrics_config` |
| `tableConfig` | `table_config` |
| `chartConfig` | `chart_config` |
| `imageConfig` | `image_config` |
| `iconLabelConfig` | `icon_label_config` |
| `shapeConfig` | `shape_config` |
| `infographicConfig` | `infographic_config` |
| `diagramConfig` | `diagram_config` |

---

## Critical Files Reference

| File | Role |
|---|---|
| `lib/textlabs-client.ts` | All API communication |
| `types/textlabs.ts` | Type definitions (source of truth for schemas) |
| `hooks/use-textlabs-session.ts` | Session lifecycle |
| `hooks/use-generation-panel.ts` | Panel UI state |
| `components/generation-panel/index.tsx` | Panel shell + form routing |
| `app/builder/page.tsx` | Layout integration |
| `components/presentation-viewer.tsx` | Toolbar button wiring |
