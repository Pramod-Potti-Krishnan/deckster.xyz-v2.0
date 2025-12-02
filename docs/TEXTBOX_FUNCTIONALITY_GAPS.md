# TextBox Functionality Gaps Analysis

This document provides a complete analysis of all TextBox formatting commands sent by the frontend LHS Panel vs. what the Layout Service backend currently supports.

**Document Date:** 2024-12-02 (Updated)
**Frontend Component:** `components/textbox-format-panel/` (style-tab, ai-tab)

---

## Recent Changes

**2024-12-02 - Simplified Panel Structure:**
- Removed Layout Tab entirely
- Merged essential box styling features (padding, border, fill) into Style Tab
- Removed unnecessary features: Columns, Autosize Text, Indents, Border Positions, Border Offset

**2024-12-02 - Bug Fix:**
- Added `elementId` to all commands - Layout Service must use this to identify target element

---

## Overview

| Category | Total Commands | Working | Needs Implementation |
|----------|----------------|---------|----------------------|
| Font & Text | 8 | 6 | 2 |
| Alignment | 2 | 1 | 1 |
| Spacing | 2 | 1 | 1 |
| Box Styling | 3 | 3 | 0 |
| AI | 1 | Partial | Enhanced |
| **Total** | **16** | **11** | **5** |

---

## Style Tab Commands

### Font & Text - Working

| Command | Parameters | Status | Notes |
|---------|------------|--------|-------|
| `setTextBoxFont` | `{ elementId, fontFamily: string }` | ✅ Working | Font family dropdown |
| `setTextBoxFontSize` | `{ elementId, fontSize: string }` | ✅ Working | Font size input/dropdown |
| `setTextBoxColor` | `{ elementId, color: string }` | ✅ Working | Text color picker |
| `setTextBoxLineHeight` | `{ elementId, lineHeight: string }` | ✅ Working | Line spacing |
| `applyTextFormatCommand` | `{ elementId, command: string }` | ✅ Working | bold, italic, underline, strikethrough |
| `setTextBoxBackground` | `{ elementId, backgroundColor: string }` | ✅ Working | Box fill color |

### Font & Text - Needs Implementation

| Command | Parameters | Priority | Description |
|---------|------------|----------|-------------|
| `setTextHighlightColor` | `{ elementId, color: string }` | 🔴 High | **Inline text highlight** - applies background to selected text only (like a highlighter pen). Different from box background. |
| `setTextBoxFontWeight` | `{ elementId, fontWeight: string }` | 🔴 High | Font weight dropdown (400/500/600/700) |

### Alignment - Working

| Command | Parameters | Status | Notes |
|---------|------------|--------|-------|
| `setTextBoxAlignment` | `{ elementId, alignment: string }` | ✅ Working | left, center, right, justify |

### Alignment - Needs Implementation

| Command | Parameters | Priority | Description |
|---------|------------|----------|-------------|
| `setTextBoxVerticalAlignment` | `{ elementId, verticalAlignment: string }` | 🔴 High | top, middle, bottom |

### Spacing - Working

| Command | Parameters | Status | Notes |
|---------|------------|--------|-------|
| `setTextBoxLineHeight` | `{ elementId, lineHeight: string }` | ✅ Working | Line height (0.8, 1.0, 1.15, 1.5, 2.0) |

### Spacing - Needs Implementation

| Command | Parameters | Priority | Description |
|---------|------------|----------|-------------|
| `setTextBoxParagraphSpacing` | `{ elementId, marginTop, marginBottom }` | 🟡 Medium | Before/After paragraph spacing |

### Box Styling - All Working

| Command | Parameters | Status | Notes |
|---------|------------|--------|-------|
| `setTextBoxPadding` | `{ elementId, padding: string }` | ✅ Working | Space between border and text |
| `setTextBoxBorder` | `{ elementId, borderStyle, borderWidth, borderColor, borderRadius }` | ✅ Working | Border style, color, width, rounded corners |
| `setTextBoxBackground` | `{ elementId, backgroundColor: string }` | ✅ Working | Box fill color |

---

## AI Tab Commands

| Command | Parameters | Status | Notes |
|---------|------------|--------|-------|
| `generateTextBoxContent` | `{ elementId, action?, prompt?, tone?, style?, presentationId, slideIndex }` | ⚠️ Partial | Basic generation may work, full action/tone/style support needed |

### Quick Actions Needed
- `shorten` - Make text shorter
- `expand` - Make text longer
- `grammar` - Fix grammar
- `bulletize` - Convert to bullet points
- `simplify` - Simplify language
- `professional` - Make more professional

### Tone/Style Options
- Tone: professional, casual, persuasive, technical
- Style: expand, summarize, rewrite

---

## Command Implementation Guide

### 1. setTextHighlightColor (Priority: HIGH)

**Frontend sends:**
```typescript
await onSendCommand('setTextHighlightColor', { elementId, color: '#ffff00' })
```

**Expected behavior:**
- Apply background color to **selected text only** (inline highlight)
- Different from `setTextBoxBackground` which colors the entire box
- Works like a highlighter pen
- Support 'transparent' value to remove highlight
- Persist in presentation model

**Implementation hint:**
- Use `document.execCommand('hiliteColor', false, color)` for contenteditable
- Or wrap selected text in `<span style="background-color: ${color}">...</span>`

---

### 2. setTextBoxFontWeight (Priority: HIGH)

**Frontend sends:**
```typescript
await onSendCommand('setTextBoxFontWeight', { elementId, fontWeight: '700' })
```

**Expected behavior:**
- Apply font-weight CSS to text box content
- Values: '400' (Regular), '500' (Medium), '600' (Semibold), '700' (Bold)
- Persist in presentation model

---

### 3. setTextBoxVerticalAlignment (Priority: HIGH)

**Frontend sends:**
```typescript
await onSendCommand('setTextBoxVerticalAlignment', { elementId, verticalAlignment: 'middle' })
```

**Expected behavior:**
- Align text vertically within the text box
- Values: 'top', 'middle', 'bottom'
- Persist in presentation model

**Implementation hint:** CSS flexbox with `align-items` or `vertical-align` on table-cell

---

### 4. setTextBoxParagraphSpacing (Priority: MEDIUM)

**Frontend sends:**
```typescript
await onSendCommand('setTextBoxParagraphSpacing', {
  elementId,
  marginTop: '10pt',
  marginBottom: '10pt'
})
```

**Expected behavior:**
- Apply margin to paragraph elements within text box
- Persist in presentation model

---

## Testing Checklist

After Layout Service implements each command:

- [ ] Select text, apply highlight color → Only selected text gets background → Reload → Persists
- [ ] Change font weight → Reload → Font weight persists
- [ ] Click vertical align middle → Text centers vertically → Reload → Persists
- [ ] Set paragraph spacing → Reload → Spacing persists
- [ ] Set box padding → Reload → Persists
- [ ] Set box border (style, color, width, rounded) → Reload → Persists
- [ ] Set box fill color → Reload → Persists

---

## Summary

The frontend TextBoxFormatPanel has been simplified to a single Style tab (plus AI). Commands needed from Layout Service:

| Priority | Commands |
|----------|----------|
| 🔴 HIGH | `setTextHighlightColor`, `setTextBoxFontWeight`, `setTextBoxVerticalAlignment` |
| 🟡 MEDIUM | `setTextBoxParagraphSpacing` |
| ⚠️ ENHANCE | `generateTextBoxContent` (full action/tone/style support) |

### Features Removed (No Longer Needed):
- ~~Columns~~ (`setTextBoxColumns`)
- ~~Autosize Text~~ (`setTextBoxAutosize`)
- ~~Indents~~ (`setTextBoxIndents`)
- ~~Border Positions~~ (`setTextBoxBorderPositions`)
- ~~Border Offset~~ (`setTextBoxBorderOffset`)

### Working Features:
- Font family, font size, text color
- Horizontal alignment, line height
- Bold/italic/underline/strikethrough
- Box padding, border (style/color/width/rounded), fill color
