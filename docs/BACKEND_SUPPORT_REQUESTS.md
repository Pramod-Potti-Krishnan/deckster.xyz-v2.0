# Backend Support Requests

This document lists frontend features that are currently marked as "Coming Soon" or require backend support to be fully functional.

## Overview

The frontend has been aligned with:
- `ELEMENTOR_FRONTEND_INTEGRATION_SPEC.md` v1.0.0 (Element generation)
- `SLIDE_TYPES.md` (Layout Service v7.5 - Slide operations)

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

## Layout Service Integration (NEW)

### Service URL
- **Base URL:** `https://web-production-f0d13.up.railway.app`
- **Status:** Frontend integrated, endpoints available

### Available Slide Layouts (15 total)

#### Hero Slides (Full-Bleed) - 4 types
| Layout ID | Name | Description |
|-----------|------|-------------|
| `H1-generated` | Title Slide (AI) | Full canvas for AI-generated content |
| `H1-structured` | Title Slide (Manual) | Editable title, subtitle, background |
| `H2-section` | Section Divider | Chapter/section breaks |
| `H3-closing` | Closing Slide | Thank you with contact info |

#### Content Slides (Single Content Area) - 6 types
| Layout ID | Name | Description |
|-----------|------|-------------|
| `C1-text` | Text Content | Body text with title/subtitle |
| `C2-table` | Table Slide | Data table area |
| `C3-chart` | Single Chart | Chart visualization |
| `C4-infographic` | Single Infographic | Infographic area |
| `C5-diagram` | Single Diagram | Diagram area |
| `C6-image` | Single Image | Image with caption |

#### Split Layout Slides (Two Columns) - 4 types
| Layout ID | Name | Description |
|-----------|------|-------------|
| `S1-visual-text` | Visual + Text | Chart/diagram left, text right |
| `S2-image-content` | Image + Content | Full-height image left, content right |
| `S3-two-visuals` | Two Visuals | Side-by-side visuals |
| `S4-comparison` | Comparison | Two columns with headers |

#### Blank Slides - 1 type
| Layout ID | Name | Description |
|-----------|------|-------------|
| `B1-blank` | Blank Canvas | Empty slide for free placement |

### Layout Service Endpoints

#### 1. Add Slide
- **Endpoint:** `POST /api/presentations/{presentation_id}/slides`
- **Status:** Available
- **Request Format:**
  ```json
  {
    "layout": "C1-text",
    "position": 2,
    "content": {
      "slide_title": "...",
      "subtitle": "...",
      "body": "..."
    },
    "background_color": "#hex",
    "background_image": "url"
  }
  ```

#### 2. Delete Slide
- **Endpoint:** `DELETE /api/presentations/{presentation_id}/slides/{slide_index}`
- **Status:** Available
- **Note:** Cannot delete the last remaining slide

#### 3. Duplicate Slide
- **Endpoint:** `POST /api/presentations/{presentation_id}/slides/{slide_index}/duplicate`
- **Status:** Available
- **Request Format:**
  ```json
  {
    "insert_after": true
  }
  ```

#### 4. Reorder Slides
- **Endpoint:** `PUT /api/presentations/{presentation_id}/slides/reorder`
- **Status:** Available
- **Request Format:**
  ```json
  {
    "from_index": 0,
    "to_index": 3
  }
  ```

#### 5. Change Slide Layout
- **Endpoint:** `PUT /api/presentations/{presentation_id}/slides/{slide_index}/layout`
- **Status:** Available
- **Request Format:**
  ```json
  {
    "new_layout": "S1-visual-text",
    "preserve_content": true,
    "content_mapping": {}
  }
  ```

---

## Elementor Endpoints (Element Generation)

### 1. Hero Slide Generation (AI)
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

### Frontend Changes Made (December 2024)

#### Element Generation (Elementor)
1. **Chart AI Tab:** 18 chart types with synthetic toggle, theme, and data format
2. **Diagram AI Tab:** 34 diagram types with 3 marked as Coming Soon
3. **Infographic AI Tab:** 14 types with item count, color scheme, icon style
4. **Image AI Tab:** 5 ratios including 3:4, remove background, quality, negative prompt
5. **Table AI Tab:** Now Text/Table with mode switcher, 6 text formats, 6 tones, 6 table styles

#### Slide Layout (Layout Service v7.5)
6. **Slide Format Panel:** Redesigned with 15 slide layout types
   - Add tab: Select layout, configure content, add new slide
   - Layout tab: Change existing slide layout
   - Format tab: Background color, gradient, opacity
7. **Layout Service Client:** NEW - Functions for add, delete, duplicate, reorder, change layout
8. **Type Definitions:** Added SlideLayoutType with all 15 layouts and content schemas

### Files Modified
- `types/elements.ts` - Added SlideLayoutType, SLIDE_LAYOUTS, SLIDE_LAYOUT_DEFAULTS, SLIDE_LAYOUT_FIELDS
- `lib/layout-service-client.ts` (NEW) - Layout Service client
- `lib/elementor-client.ts` - Added SlideLayoutType support and mapping
- `components/element-format-panel/slide-format-panel.tsx` - Redesigned with 15 layouts
- `components/element-format-panel/index.tsx`

### Environment Variables
- `NEXT_PUBLIC_LAYOUT_SERVICE_URL` - Layout Service base URL (default: https://web-production-f0d13.up.railway.app)
- `NEXT_PUBLIC_ELEMENTOR_URL` - Elementor service URL

---

## Contact

For questions about frontend implementation or to discuss backend requirements:
- Reference: `ELEMENTOR_FRONTEND_INTEGRATION_SPEC.md` (Element generation)
- Reference: `SLIDE_TYPES.md` (Slide layouts)
- Frontend aligned as of: December 2024
