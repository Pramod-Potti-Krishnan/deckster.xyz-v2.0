# Layout Service postMessage Integration Request

## Issue Summary

The frontend "Add Slide" picker is sending the correct layout IDs (e.g., `C1-text`, `H1-structured`) to the Layout Service iframe via `postMessage`, but slides are not being added. The iframe needs to handle these commands and call the Layout Service REST API.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend (deckster-frontend)                                       │
│                                                                     │
│  SlideLayoutPicker                                                  │
│       │                                                             │
│       │ onClick → onAddSlide('C1-text')                            │
│       ▼                                                             │
│  PresentationViewer.handleAddSlide(layoutId)                       │
│       │                                                             │
│       │ sendCommand(iframe, 'addSlide', { layout, position })      │
│       ▼                                                             │
│  postMessage({ action: 'addSlide', params: {...} }, VIEWER_ORIGIN) │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ postMessage
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Layout Service Iframe (https://web-production-f0d13.up.railway.app)│
│                                                                     │
│  ❌ Currently NOT handling 'addSlide' postMessage command          │
│                                                                     │
│  Expected: Listen for postMessage, call REST API, respond          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## What Frontend Sends

When user clicks a slide type in the "Add Slide" picker:

### postMessage Command
```javascript
iframe.contentWindow.postMessage({
  action: 'addSlide',
  params: {
    layout: 'C1-text',      // New layout ID (one of 15 types)
    position: 2             // 0-based index to insert after
  }
}, 'https://web-production-f0d13.up.railway.app')
```

### Layout IDs Sent
The frontend sends these exact layout IDs (from SLIDE_TYPES.md):

**Hero Slides:**
- `H1-generated` - Title Slide (AI)
- `H1-structured` - Title Slide (Manual)
- `H2-section` - Section Divider
- `H3-closing` - Closing Slide

**Content Slides:**
- `C1-text` - Text Content
- `C2-table` - Table Slide
- `C3-chart` - Single Chart
- `C4-infographic` - Single Infographic
- `C5-diagram` - Single Diagram
- `C6-image` - Single Image

**Split Layouts:**
- `S1-visual-text` - Visual + Text
- `S2-image-content` - Image + Content
- `S3-two-visuals` - Two Visuals
- `S4-comparison` - Comparison

**Blank:**
- `B1-blank` - Blank Canvas

---

## What Frontend Expects Back

The frontend listens for a response via `postMessage`:

```javascript
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://web-production-f0d13.up.railway.app') return

  if (event.data.action === 'addSlide') {
    if (event.data.success) {
      // event.data.data.slideIndex - new slide's 0-based index
      // event.data.data.slideCount - total slide count after add
    } else {
      // event.data.error - error message
    }
  }
})
```

### Expected Response Format

**Success:**
```javascript
{
  action: 'addSlide',
  success: true,
  data: {
    slideIndex: 2,    // 0-based index where slide was inserted
    slideCount: 5     // Total slides after insertion
  }
}
```

**Error:**
```javascript
{
  action: 'addSlide',
  success: false,
  error: 'Error message describing what went wrong'
}
```

---

## Implementation Request for Layout Service Viewer

The iframe at `https://web-production-f0d13.up.railway.app` needs to:

### 1. Listen for postMessage Commands
```javascript
window.addEventListener('message', async (event) => {
  // Validate origin
  if (!isAllowedOrigin(event.origin)) return

  const { action, params } = event.data

  if (action === 'addSlide') {
    await handleAddSlide(params, event.source)
  }
  // ... other actions: deleteSlide, duplicateSlide, changeSlideLayout, etc.
})
```

### 2. Call the REST API
```javascript
async function handleAddSlide(params, source) {
  const { layout, position } = params
  const presentationId = getCurrentPresentationId() // From URL or state

  try {
    const response = await fetch(
      `/api/presentations/${presentationId}/slides`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout: layout,      // e.g., 'C1-text'
          position: position   // e.g., 2
        })
      }
    )

    const result = await response.json()

    if (result.success) {
      // Refresh the presentation display
      refreshPresentation()

      // Respond to frontend
      source.postMessage({
        action: 'addSlide',
        success: true,
        data: {
          slideIndex: result.slide_index,
          slideCount: result.slide_count
        }
      }, event.origin)
    } else {
      source.postMessage({
        action: 'addSlide',
        success: false,
        error: result.detail || 'Failed to add slide'
      }, event.origin)
    }
  } catch (error) {
    source.postMessage({
      action: 'addSlide',
      success: false,
      error: error.message
    }, event.origin)
  }
}
```

---

## Other Commands That Need postMessage Handling

The frontend also sends these commands that need iframe support:

### deleteSlide
```javascript
{ action: 'deleteSlide', params: { index: 2 } }
```

### duplicateSlide
```javascript
{ action: 'duplicateSlide', params: { index: 2, insert_after: true } }
```

### changeSlideLayout
```javascript
{ action: 'changeSlideLayout', params: { index: 2, new_layout: 'S1-visual-text', preserve_content: true } }
```

### reorderSlides
```javascript
// If drag-and-drop is implemented
{ action: 'reorderSlides', params: { from_index: 0, to_index: 3 } }
```

---

## Testing

1. Open browser DevTools Console
2. Navigate to a presentation in the builder
3. Click "Add Slide" → Select a layout (e.g., "Text")
4. Check Console for:
   - Outgoing postMessage: `➕ Added C1-text slide at position X`
   - If you see timeout errors, the iframe isn't responding

---

## Current Frontend Files

- `components/slide-layout-picker.tsx` - UI for selecting layouts
- `components/presentation-viewer.tsx` - Sends postMessage commands
- `lib/layout-service-client.ts` - REST API client (not used for postMessage)
- `types/elements.ts` - SlideLayoutType definitions

---

## Contact

Frontend is ready and aligned with SLIDE_TYPES.md. Waiting for Layout Service iframe to handle postMessage commands.

Created: December 4, 2024
