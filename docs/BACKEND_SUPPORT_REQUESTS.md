# Backend Support Requests

This document lists frontend features that are currently marked as "Coming Soon" or require backend support to be fully functional.

## Overview

The frontend has been aligned with `ELEMENTOR_FRONTEND_INTEGRATION_SPEC.md` v1.0.0. However, some features are included in the UI but marked as disabled because they require backend implementation.

---

## Diagram Types - Coming Soon

### 1. Class Diagram (UML)
- **Type ID:** `class`
- **Category:** Mermaid diagrams
- **Status:** Coming Soon (disabled in UI)
- **Description:** UML class diagrams showing classes, properties, methods, and relationships
- **Use Cases:** Software architecture, OOP design documentation
- **Priority:** Medium
- **Notes:** Mermaid supports class diagrams, but the backend spec doesn't list it as supported

### 2. Git Graph
- **Type ID:** `gitgraph`
- **Category:** Mermaid diagrams
- **Status:** Coming Soon (disabled in UI)
- **Description:** Git branch visualization showing commits, branches, merges
- **Use Cases:** Version control documentation, branching strategy explanations
- **Priority:** Low
- **Notes:** Mermaid supports gitgraph, but the backend spec doesn't list it as supported

### 3. Mindmap
- **Type ID:** `mindmap`
- **Category:** Mermaid diagrams
- **Status:** Coming Soon (disabled in UI)
- **Description:** Hierarchical idea mapping with central topic and branches
- **Use Cases:** Brainstorming, concept mapping, idea organization
- **Priority:** Medium
- **Notes:** Mermaid supports mindmap, but the backend spec doesn't list it as supported

---

## New Endpoints Required

### 1. Hero Slide Generation
- **Endpoint:** `POST /api/generate/hero`
- **Status:** Frontend ready, awaiting backend implementation
- **Request Format:**
  ```json
  {
    "context": {
      "presentation_id": "string",
      "presentation_title": "string",
      "slide_id": "string",
      "slide_index": 0
    },
    "prompt": "string",
    "hero_type": "title | title_with_image | section | section_with_image | closing | closing_with_image",
    "visual_style": "illustrated | professional | kids"
  }
  ```
- **Notes:** Visual style only applies when hero_type includes "_with_image"

### 2. Slide Background
- **Endpoint:** `POST /api/slide/background`
- **Status:** Frontend ready, awaiting backend implementation
- **Request Format:**
  ```json
  {
    "context": {
      "presentation_id": "string",
      "slide_id": "string",
      "slide_index": 0
    },
    "background_color": "#hex",
    "gradient": "CSS gradient string",
    "opacity": 0.0-1.0
  }
  ```

---

## Future Enhancement Requests

### 1. CSV Import for Charts
- **Description:** Allow users to upload CSV files to populate chart data
- **Priority:** Low
- **Notes:** Currently, users can only describe data via prompt or use synthetic data

### 2. Manual Data Entry for Tables
- **Description:** Inline table editor for manual data entry
- **Priority:** Low
- **Notes:** Currently, users can only generate data via AI prompt

### 3. Text Transformations
- **Description:** Transform existing text using operations like expand, condense, simplify, formalize, etc.
- **Types:** expand, condense, simplify, formalize, casualize, bulletize, paragraphize, rephrase, proofread, translate
- **Priority:** Medium
- **Notes:** The types are defined in the frontend, but the UI only supports text generation, not transformation

---

## Implementation Notes

### Frontend Changes Made
1. **Chart AI Tab:** 18 chart types with synthetic toggle, theme, and data format
2. **Diagram AI Tab:** 34 diagram types with 3 marked as Coming Soon
3. **Infographic AI Tab:** 14 types with item count, color scheme, icon style
4. **Image AI Tab:** 5 ratios including 3:4, remove background, quality, negative prompt
5. **Table AI Tab:** Now Text/Table with mode switcher, 6 text formats, 6 tones, 6 table styles
6. **Slide Format Panel:** NEW - Shows when no element selected, with Format and Generate tabs
7. **Elementor Client:** Updated with all new types and Hero/Slide endpoints

### Files Modified
- `types/elements.ts` - Complete type definitions aligned with backend spec
- `components/element-format-panel/ai-tabs/chart-ai-tab.tsx`
- `components/element-format-panel/ai-tabs/diagram-ai-tab.tsx`
- `components/element-format-panel/ai-tabs/infographic-ai-tab.tsx`
- `components/element-format-panel/ai-tabs/image-ai-tab.tsx`
- `components/element-format-panel/ai-tabs/table-ai-tab.tsx`
- `components/element-format-panel/slide-format-panel.tsx` (NEW)
- `components/element-format-panel/index.tsx`
- `lib/elementor-client.ts`

---

## Contact

For questions about frontend implementation or to discuss backend requirements:
- Reference: `ELEMENTOR_FRONTEND_INTEGRATION_SPEC.md`
- Frontend aligned as of: December 2024
