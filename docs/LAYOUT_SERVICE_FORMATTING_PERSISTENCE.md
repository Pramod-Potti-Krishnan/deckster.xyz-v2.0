# Layout Service: Formatting Persistence Requirement

## Problem

When user applies formatting (e.g., text color) using the **LHS TextBoxFormatPanel**, the changes appear visually but **don't persist after save/reload**. However, formatting applied via the **embedded toolbar** inside the Layout Service iframe persists correctly.

## Root Cause

The postMessage flow is **transient only** - it updates the DOM in the iframe but does NOT persist changes to the presentation database.

### Current Flow (broken):
1. User changes color in LHS panel → `setTextBoxColor` sent via postMessage
2. Layout Service iframe receives message and updates DOM element's style
3. Formatting appears immediately in the presentation ✓
4. User clicks "Save"
5. Page reloads → **Formatting is GONE** ✗

### Why Embedded Toolbar Works:
The embedded toolbar inside the iframe has direct access to the Layout Service's persistence layer. It can update the presentation JSON directly, so changes survive reload.

## Solution

The Layout Service must **persist formatting changes** when it receives postMessage commands. When the iframe receives a formatting command like `setTextBoxColor`, it must:

1. Apply the change to the DOM (already working)
2. **Also update the element's data in the presentation model**
3. Ensure that when "Save" is triggered, the updated formatting is included

---

## Commands That Need Persistence

When the Layout Service receives these postMessage commands, it must persist the changes:

| Command | Parameters | Persistence Target |
|---------|-----------|-------------------|
| `setTextBoxColor` | `{ elementId, color }` | `element.style.color` |
| `setTextBoxFont` | `{ elementId, fontFamily }` | `element.style.fontFamily` |
| `setTextBoxFontSize` | `{ elementId, fontSize }` | `element.style.fontSize` |
| `setTextBoxFontWeight` | `{ elementId, fontWeight }` | `element.style.fontWeight` |
| `setTextBoxAlignment` | `{ elementId, alignment }` | `element.style.textAlign` |
| `setTextBoxLineHeight` | `{ elementId, lineHeight }` | `element.style.lineHeight` |
| `setTextBoxBackgroundColor` | `{ elementId, backgroundColor }` | `element.style.backgroundColor` |
| `applyTextFormatCommand` | `{ elementId, command }` | Bold/Italic/Underline state |

---

## Implementation Requirement

When Layout Service handles a formatting command:

```javascript
// Example: handling setTextBoxColor
function handleSetTextBoxColor(elementId, color) {
  // 1. Update DOM (already implemented)
  const element = document.getElementById(elementId)
  element.style.color = color

  // 2. UPDATE THE PRESENTATION MODEL (THIS IS MISSING)
  // The element's formatting must be stored so it persists on save
  updateElementFormatting(elementId, { color: color })

  // 3. Return success
  return { success: true }
}
```

The key is step 2: **the formatting change must be stored in the presentation data model**, not just applied to the DOM.

---

## Testing

After Layout Service implements persistence:

1. Go to Builder page
2. Click on a text box → LHS TextBoxFormatPanel appears
3. Change text color using the LHS panel → Color changes visually
4. Click "Save"
5. Refresh the page
6. Click on the same text box → **Color should still be the changed color** (THE FIX)

---

## Summary

This is a **Layout Service-only fix**. The frontend is sending commands correctly. The Layout Service needs to:

1. Continue updating the DOM (already working)
2. **Also persist the formatting to the presentation model** (missing)
3. Ensure saved presentation includes the updated formatting

The embedded toolbar already has this persistence mechanism - the postMessage handler needs the same capability.
