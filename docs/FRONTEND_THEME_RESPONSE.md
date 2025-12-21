# Frontend Theme System Response

## Response to Text Service Theme System Design v2.1

**From:** Frontend Team
**Date:** December 2024
**Re:** THEME_SYSTEM_DESIGN.md (Cross-Service Contract + Frontend Capabilities)
**Status:** Review Complete - Questions for Alignment

---

## 1. Executive Summary

We have thoroughly reviewed the Text Service team's THEME_SYSTEM_DESIGN.md document. The frontend team confirms:

- **Aligned on visual theme switching** - We support instant theme changes without regeneration
- **Aligned on CSS-based approach** - Theme changes update styling, not content
- **Ready to expand color palette** - Willing to add missing colors for full compatibility

**Key clarification needed:** The frontend currently manages **visual-only** theming (colors, fonts, backgrounds). The backend document describes a broader "theme" that includes **content context** (Audience, Purpose, Time). We need to align on where these responsibilities sit.

---

## 2. Current Frontend Theme Capabilities

### 2.1 Theme Panel Implementation

**Location:** `/components/theme-panel.tsx` (832 lines)

The frontend provides a full-featured Theme Panel with two operation modes:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND THEME PANEL                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  MODE 1: PRESET THEMES                                              │
│  ─────────────────────                                              │
│  • Grid selection from 4 built-in themes                            │
│  • Each theme includes all 14 colors fully defined                  │
│  • Quick customize for Primary and Accent colors                    │
│  • Theme preview with color swatches                                │
│                                                                     │
│  MODE 2: BUILD CUSTOM                                               │
│  ─────────────────────                                              │
│  • Base theme selector (dropdown)                                   │
│  • All 14 colors organized into 4 collapsible sections              │
│  • Individual color pickers with CompactColorPicker                 │
│  • Per-section reset buttons                                        │
│  • Real-time preview updates                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Current Color Palette (14 Colors)

The frontend defines a 14-color system organized by purpose:

```typescript
interface FullThemeColors {
  // Brand Colors (4)
  primary: string          // Main brand color
  primary_light: string    // Lighter variant
  primary_dark: string     // Darker variant
  accent: string           // Call-to-action, highlights

  // Background Colors (3)
  background: string       // Main slide background
  background_alt: string   // Alternate sections
  hero_background: string  // Hero slide backgrounds

  // Text Colors (6)
  text_primary: string     // Main headings
  text_secondary: string   // Secondary text
  text_body: string        // Body content
  hero_text_primary: string    // Hero title text
  hero_text_secondary: string  // Hero subtitle text
  footer_text: string      // Footer/caption text

  // Border (1)
  border: string           // Border color
}
```

### 2.3 Preset Themes

Four preset themes are currently available:

| Theme ID | Name | Primary | Accent | Use Case |
|----------|------|---------|--------|----------|
| `corporate-blue` | Corporate Blue | #1e40af | #f59e0b | Professional business |
| `elegant-emerald` | Elegant Emerald | #065f46 | #d97706 | Sophisticated green |
| `vibrant-orange` | Vibrant Orange | #ea580c | #0891b2 | Creative/energetic |
| `dark-mode` | Dark Mode | #60a5fa | #f472b6 | Low-light environments |

### 2.4 Theme Switching Mechanism

Theme changes are communicated via **postMessage** to the presentation viewer iframe:

```typescript
// Commands sent to viewer iframe (origin: web-production-f0d13.up.railway.app)

// 1. Load current theme on panel open
sendCommand('getTheme')
// Response: { themeConfig: { theme_id, color_overrides } }

// 2. Real-time preview (no persistence)
sendCommand('previewTheme', {
  themeId: 'corporate-blue',
  colorOverrides: { primary: '#ff0000' }
})

// 3. Save theme (persists to backend)
sendCommand('setTheme', {
  themeId: 'corporate-blue',
  colorOverrides: { primary: '#ff0000' }
})
```

**Key characteristics:**
- Instant visual updates (no API calls for preview)
- Theme persisted only on explicit save
- Color overrides stored as key-value pairs

---

## 3. Alignment Analysis

### 3.1 What's Already Aligned

| Backend Requirement | Frontend Status | Notes |
|---------------------|-----------------|-------|
| Instant theme switching without regeneration | **IMPLEMENTED** | Via postMessage to viewer |
| Color-based customization | **IMPLEMENTED** | 14-color system with overrides |
| Preset themes with custom overrides | **IMPLEMENTED** | 4 presets + full customization |
| Theme selection UI | **IMPLEMENTED** | ThemePanel component |
| Real-time preview | **IMPLEMENTED** | Preview before apply |

### 3.2 Color Palette Gaps

The backend spec defines 20+ colors. Current frontend is missing:

| Backend Color Key | Frontend Has | Action Needed |
|-------------------|--------------|---------------|
| `accent_dark` | No | **Add** |
| `accent_light` | No | **Add** |
| `tertiary_1` | No | **Add** |
| `tertiary_2` | No | **Add** |
| `tertiary_3` | No | **Add** |
| `chart_1` - `chart_6` | No | **Add** (6 colors) |
| `surface` | `background_alt` | **Rename** |
| `text_muted` | `footer_text` | **Rename** |

**Frontend commits to expanding the palette** to include all 20+ colors.

### 3.3 Theme ID Naming Difference

| Frontend ID | Backend ID | Visual Similarity |
|-------------|------------|-------------------|
| `corporate-blue` | `professional` | Similar (navy/blue) |
| `elegant-emerald` | `educational` | Similar (teal/green) |
| `vibrant-orange` | `children` | Different (orange vs purple) |
| `dark-mode` | (none) | No backend equivalent |

**Note:** Frontend themes are purely visual presets. Backend themes appear to also influence content generation via associated audience/purpose settings.

### 3.4 Architecture Difference

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CURRENT FRONTEND SCOPE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Frontend manages:                                                  │
│  ✅ Theme preset selection                                          │
│  ✅ Color customization (14 colors → expanding to 20+)              │
│  ✅ Real-time preview                                               │
│  ✅ Theme persistence via viewer iframe                             │
│                                                                     │
│  Frontend does NOT currently manage:                                │
│  ❌ Audience type selection (kids_young → executive)                │
│  ❌ Purpose type selection (inform, persuade, educate)              │
│  ❌ Time/Duration input (5 min → 60+ min)                           │
│  ❌ Regeneration warnings for content-affecting changes             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Commitments

### 4.1 Expand Color Palette to 20+ Colors

We will update the `FullThemeColors` interface to include all backend-required colors:

```typescript
interface FullThemeColors {
  // Brand Colors (4) - existing
  primary: string
  primary_light: string
  primary_dark: string
  accent: string

  // Accent Variants (2) - NEW
  accent_light: string
  accent_dark: string

  // Tertiary Colors (3) - NEW
  tertiary_1: string    // Lightest
  tertiary_2: string    // Medium
  tertiary_3: string    // Darkest

  // Background Colors (3) - rename background_alt → surface
  background: string
  surface: string       // Was: background_alt
  hero_background: string

  // Text Colors (6) - rename footer_text → text_muted
  text_primary: string
  text_secondary: string
  text_body: string
  text_muted: string    // Was: footer_text
  hero_text_primary: string
  hero_text_secondary: string

  // Border (1) - existing
  border: string

  // Chart Colors (6) - NEW
  chart_1: string
  chart_2: string
  chart_3: string
  chart_4: string
  chart_5: string
  chart_6: string
}
```

**Total: 25 colors** (matching backend specification)

### 4.2 Adopt snake_case Naming Convention

All color keys will use snake_case for cross-service consistency:
- `background_alt` → `surface`
- `footer_text` → `text_muted`
- New keys already use snake_case

### 4.3 Support CSS Class Mode

Frontend can render content with CSS class-based styling. When HTML contains `.deckster-*` classes:

```css
/* Frontend will load theme-specific CSS like: */
.theme-professional .deckster-t1 {
  font-size: 32px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.theme-executive .deckster-t1 {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-primary);
}
```

---

## 5. Questions for Backend Teams

### Q1: Theme ID Mapping Strategy

Frontend themes are **visual-only** presets (colors, fonts, backgrounds). Backend themes appear to have **deeper meaning** affecting content generation.

**Question:** How should we handle the mapping?

| Option | Description | Frontend Preference |
|--------|-------------|---------------------|
| A | Rename frontend IDs to match backend (`corporate-blue` → `professional`) | Acceptable |
| B | Keep separate naming, add mapping layer | Workable |
| C | Frontend themes are independent visual presets | Preferred |

**Our perspective:** Since frontend themes control only visual appearance while backend themes affect content (via associated audience/purpose), these may be **orthogonal concepts**. A user could have:
- Backend theme: `executive` (affects vocabulary, bullet count)
- Frontend visual style: Any of our color presets

**Clarification needed:** Is the backend's `theme_id` purely visual, or does it also imply audience/purpose settings?

---

### Q2: Audience/Purpose/Time Collection

Section 4.3.4 of THEME_SYSTEM_DESIGN.md states frontend MUST collect:
- **Audience** (kids_young, kids_older, high_school, college, professional, executive)
- **Purpose** (inform, educate, persuade, entertain, inspire, report)
- **Time/Duration** (5 min → 60+ min)

**Questions:**

| Question | Context |
|----------|---------|
| **a) When collected?** | At presentation creation? Before first generation? Editable later? |
| **b) UI Components?** | Dropdowns? Radio buttons? Wizard flow? Inline in chat? |
| **c) UX Guidelines?** | Are there mockups? Should these be prominent or advanced settings? |
| **d) Edit after creation?** | If user changes these post-generation, do we show regeneration warning? |
| **e) Where stored?** | In presentation metadata? Session? Passed to Director? |

**Current state:** These inputs are NOT collected in the current frontend. We need guidance on:
1. UX expectations
2. API contracts for passing these to backend
3. Integration with existing chat-based workflow

---

### Q3: CSS Class vs PostMessage Approach

Current frontend uses **postMessage** to communicate theme changes to the viewer iframe:

```javascript
// Current approach
iframe.postMessage({ action: 'setTheme', params: { themeId, colorOverrides } }, viewerOrigin)
```

Backend spec suggests **CSS class swap**:

```html
<!-- Backend expectation -->
<div class="presentation theme-professional">
           ↓ (user changes theme)
<div class="presentation theme-executive">
```

**Question:** Should frontend:

| Option | Description |
|--------|-------------|
| A | Adopt CSS class approach directly | Requires viewer architecture change |
| B | Continue postMessage, viewer uses CSS classes internally | Minimal frontend change |
| C | Hybrid: CSS classes for local preview, postMessage for save | Both benefits |

**Our preference:** Option B or C - postMessage works well for our iframe architecture.

---

### Q4: Typography Controls

Backend defines a full typography hierarchy:

```
Hero Level: hero_title (72-96px), hero_subtitle (36-48px), hero_accent (24-32px)
Slide Level: slide_title (42-48px), slide_subtitle (28-32px)
Content Level: t1 (28-32px), t2 (22-26px), t3 (18-22px), t4 (16-18px)
```

Current frontend ThemePanel **only controls colors**, not typography (font family, size, weight).

**Question:** Should frontend:

| Option | Description |
|--------|-------------|
| A | Add typography controls to ThemePanel | Font family, size scale, weights |
| B | Leave typography to backend, frontend controls colors only | Current approach |
| C | Both: Full typography + colors in advanced mode | Most flexible |

**Our preference:** Option B for now (colors only), expand to C later if needed.

---

## 6. Proposed Alignment Path

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PROPOSED NEXT STEPS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PHASE 1: Confirm Scope (Backend Teams)                             │
│  ───────────────────────────────────────                            │
│  • Clarify: Are frontend themes purely visual or content-related?   │
│  • Clarify: Where should Audience/Purpose/Time be collected?        │
│  • Agree on CSS class naming convention                             │
│                                                                     │
│  PHASE 2: Frontend Color Expansion                                  │
│  ─────────────────────────────────                                  │
│  • Expand palette from 14 → 25 colors                               │
│  • Rename keys for consistency (surface, text_muted)                │
│  • Update all 4 preset themes with new colors                       │
│  • Update ThemePanel UI to organize 25 colors                       │
│                                                                     │
│  PHASE 3: CSS Class Support                                         │
│  ─────────────────────────────                                      │
│  • Define CSS custom properties for theme colors                    │
│  • Create .deckster-* class definitions per theme                   │
│  • Integrate with viewer iframe                                     │
│                                                                     │
│  PHASE 4: Content Context UI (if required)                          │
│  ─────────────────────────────────────────                          │
│  • Add Audience/Purpose/Time inputs (pending UX guidance)           │
│  • Implement regeneration warning flow                              │
│  • Pass content context to Director via API                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Current Implementation Reference

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `/components/theme-panel.tsx` | Main theme UI component | 832 |
| `/components/presentation-viewer.tsx` | Theme panel integration | ~500 |
| `/components/ui/color-picker.tsx` | Color picker component | ~200 |

### Current Theme Data Model

```typescript
// Theme configuration stored per presentation
interface PresentationThemeConfig {
  theme_id: string                           // Preset ID (e.g., 'corporate-blue')
  color_overrides?: Record<string, string>   // Custom color modifications
}

// Example:
{
  theme_id: 'corporate-blue',
  color_overrides: {
    primary: '#ff5500',      // Custom primary color
    accent: '#00ff00'        // Custom accent color
  }
}
```

### PostMessage Protocol

```typescript
// Commands sent to viewer iframe
type ThemeCommand =
  | { action: 'getTheme' }                                    // Load current
  | { action: 'previewTheme', params: ThemeParams }           // Preview only
  | { action: 'setTheme', params: ThemeParams }               // Save and apply

// Response from viewer
type ThemeResponse = {
  action: string
  success: boolean
  themeConfig?: PresentationThemeConfig
  error?: string
}
```

---

## 8. Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| Visual theme switching | **READY** | Instant, no regeneration |
| Color customization | **NEEDS EXPANSION** | 14 → 25 colors |
| CSS class support | **CAN IMPLEMENT** | Awaiting viewer integration details |
| Theme presets | **NEEDS ALIGNMENT** | ID naming discussion needed |
| Audience/Purpose/Time | **NEEDS GUIDANCE** | Not currently collected |
| Typography controls | **NOT PLANNED** | Colors only for now |

---

**Contact:** Frontend Team
**Document Version:** 1.0
**Last Updated:** December 2024

---

## Appendix: Full Color Comparison

### Current Frontend Palette (14 colors)

```typescript
const THEME_PREVIEWS = {
  'corporate-blue': {
    primary: '#1e40af',
    primary_light: '#3b82f6',
    primary_dark: '#1e3a8a',
    accent: '#f59e0b',
    background: '#ffffff',
    background_alt: '#f8fafc',
    hero_background: '#1e40af',
    text_primary: '#1f2937',
    text_secondary: '#6b7280',
    text_body: '#374151',
    hero_text_primary: '#ffffff',
    hero_text_secondary: '#e0e7ff',
    footer_text: '#9ca3af',
    border: '#e5e7eb'
  }
  // ... other themes
}
```

### Backend Required Palette (20+ colors)

```python
THEME_COLOR_PALETTES = {
    "professional": {
        # Primary (3)
        "primary": "#1e3a5f",
        "primary_dark": "#152a45",
        "primary_light": "#e8eef4",

        # Accent (3)
        "accent": "#3b82f6",
        "accent_dark": "#2563eb",
        "accent_light": "#dbeafe",

        # Tertiary (3)
        "tertiary_1": "#64748b",
        "tertiary_2": "#94a3b8",
        "tertiary_3": "#cbd5e1",

        # Neutrals (6)
        "background": "#ffffff",
        "surface": "#f8fafc",
        "border": "#e2e8f0",
        "text_primary": "#1e3a5f",
        "text_secondary": "#4b5563",
        "text_muted": "#9ca3af",

        # Charts (6)
        "chart_1": "#3b82f6",
        "chart_2": "#10b981",
        "chart_3": "#f59e0b",
        "chart_4": "#ef4444",
        "chart_5": "#8b5cf6",
        "chart_6": "#ec4899"
    }
}
```

### Mapping Table

| Backend Key | Frontend Current | Frontend Proposed |
|-------------|------------------|-------------------|
| primary | primary | primary |
| primary_dark | primary_dark | primary_dark |
| primary_light | primary_light | primary_light |
| accent | accent | accent |
| accent_dark | - | **ADD** |
| accent_light | - | **ADD** |
| tertiary_1 | - | **ADD** |
| tertiary_2 | - | **ADD** |
| tertiary_3 | - | **ADD** |
| background | background | background |
| surface | background_alt | **RENAME** |
| border | border | border |
| text_primary | text_primary | text_primary |
| text_secondary | text_secondary | text_secondary |
| text_muted | footer_text | **RENAME** |
| chart_1-6 | - | **ADD** (6 colors) |
| hero_background | hero_background | hero_background |
| hero_text_primary | hero_text_primary | hero_text_primary |
| hero_text_secondary | hero_text_secondary | hero_text_secondary |
| text_body | text_body | text_body |
