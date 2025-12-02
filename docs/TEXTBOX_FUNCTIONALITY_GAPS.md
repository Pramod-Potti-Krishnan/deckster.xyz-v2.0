# TextBox Functionality Gaps Analysis

This document provides a complete analysis of all TextBox formatting commands sent by the frontend LHS Panel vs. what the Layout Service backend currently supports.

**Document Date:** 2024-12-02
**Frontend Component:** `components/textbox-format-panel/` (style-tab, layout-tab, ai-tab)

---

## IMPORTANT: Recent Bug Fix (2024-12-02)

**Issue:** Commands were being sent WITHOUT `elementId`, causing the Layout Service to not know which element to apply formatting to.

**Fix:** All commands now include `elementId` in their parameters:
```typescript
// Before (broken)
await onSendCommand('setTextBoxColor', { color })

// After (fixed)
await onSendCommand('setTextBoxColor', { elementId, color })
```

**Files fixed:**
- `components/textbox-format-panel/style-tab.tsx`
- `components/textbox-format-panel/layout-tab.tsx`

**Layout Service requirement:** All commands now send `elementId`. The Layout Service handlers MUST use `elementId` to identify the target element.

---

## Overview

| Tab | Total Commands | Working | Needs Implementation |
|-----|----------------|---------|----------------------|
| Style Tab | 13 | 7 | 6 |
| Layout Tab | 8 | 3 | 5 |
| AI Tab | 1 | Partial | Enhanced version needed |
| **Total** | **22** | **10** | **12** |

---

## Style Tab Commands

### Working Commands

| Command | Parameters | Status | Notes |
|---------|------------|--------|-------|
| `setTextBoxFont` | `{ elementId, fontFamily: string }` | ✅ Working | Font family dropdown |
| `setTextBoxFontSize` | `{ elementId, fontSize: string }` (e.g., "16pt") | ✅ Working | Font size input/dropdown |
| `setTextBoxColor` | `{ elementId, color: string }` (hex) | ✅ Working | Text color picker |
| `setTextBoxBackgroundColor` | `{ elementId, backgroundColor: string }` | ✅ Working | Highlight/text background |
| `setTextBoxAlignment` | `{ elementId, alignment: 'left'|'center'|'right'|'justify' }` | ✅ Working | Horizontal alignment |
| `setTextBoxLineHeight` | `{ elementId, lineHeight: string }` (e.g., "1.5") | ✅ Working | Line spacing dropdown |
| `applyTextFormatCommand` | `{ elementId, command: string }` | ✅ Working | bold, italic, underline, strikethrough |

### Commands Needing Implementation

| Command | Parameters | Priority | Description |
|---------|------------|----------|-------------|
| `setTextHighlightColor` | `{ elementId, color: string }` | 🔴 High | **Inline text highlight** - applies background color to selected text only (like a highlighter pen), NOT the entire text box. Different from `setTextBoxBackground` which colors the whole box. |
| `setTextBoxFontWeight` | `{ elementId, fontWeight: string }` | 🔴 High | Font weight dropdown (400/500/600/700). Currently sends command but Layout Service doesn't process it. |
| `setTextBoxVerticalAlignment` | `{ elementId, verticalAlignment: 'top'|'middle'|'bottom' }` | 🔴 High | Vertical text alignment buttons. Very common need. |
| `setTextBoxParagraphSpacing` | `{ elementId, marginTop: string, marginBottom: string }` | 🟡 Medium | Before/After Paragraph inputs in Spacing section. |
| `insertUnorderedList` | via `applyTextFormatCommand` | 🟡 Medium | Bullet list button - may or may not work via execCommand |
| `insertOrderedList` | via `applyTextFormatCommand` | 🟡 Medium | Numbered list button - may or may not work via execCommand |

---

## Layout Tab Commands

### Working Commands

| Command | Parameters | Status | Notes |
|---------|------------|--------|-------|
| `setTextBoxPadding` | `{ elementId, padding: string }` (e.g., "5pt") | ✅ Working | Text Inset control |
| `setTextBoxBorder` | `{ elementId, borderStyle, borderWidth, borderColor, borderRadius }` | ✅ Working | Border style/color/width/rounded |
| `setTextBoxBackground` | `{ elementId, backgroundColor: string }` | ✅ Working | Paragraph Background picker |

### Commands Needing Implementation

| Command | Parameters | Priority | Description |
|---------|------------|----------|-------------|
| `setTextBoxColumns` | `{ elementId, columns: number }` (1-4) | 🔴 High | Columns stepper control. Uses CSS `column-count`. |
| `setTextBoxAutosize` | `{ elementId, autosize: boolean }` | 🟡 Medium | Toggle for auto-sizing text box height to content. |
| `setTextBoxIndents` | `{ elementId, firstIndent, leftIndent, rightIndent }` | 🟡 Medium | Indents section - First/Left/Right inputs. |
| `setTextBoxBorderPositions` | `{ elementId, positions: string[] }` | 🟡 Medium | L/T/R/B/All buttons for selective borders. |
| `setTextBoxBorderOffset` | `{ elementId, offset: string }` | 🟢 Low | Border Offset input - space between border and content. |

---

## AI Tab Commands

### Current Command

| Command | Parameters | Status | Notes |
|---------|------------|--------|-------|
| `generateTextBoxContent` | `{ action?, prompt?, tone?, style?, elementId, presentationId, slideIndex }` | ⚠️ Partial | Basic generation works, but quick actions and full parameter set may not be supported. |

### Enhancement Needed

The frontend sends these action types via `generateTextBoxContent`:

**Quick Actions (transform existing text):**
- `shorten` - Make text shorter
- `expand` - Make text longer
- `grammar` - Fix grammar
- `bulletize` - Convert to bullet points
- `simplify` - Simplify language
- `professional` - Make more professional

**Prompt-based parameters:**
- `prompt` - Custom generation prompt
- `tone` - `'professional'|'casual'|'persuasive'|'technical'`
- `style` - `'expand'|'summarize'|'rewrite'`

**Required response format:**
```typescript
{
  success: boolean,
  error?: string,
  content?: {
    html: string,
    css?: string,
    js?: string
  },
  injected?: boolean
}
```

---

## Command-by-Command Implementation Guide

### 1. setTextHighlightColor (Priority: HIGH) ⭐ NEW

**Frontend sends:**
```typescript
await onSendCommand('setTextHighlightColor', { elementId, color: '#ffff00' })
```

**Expected Layout Service behavior:**
- Apply background color to **selected text only** (inline highlight)
- This is different from `setTextBoxBackground` which colors the entire text box
- Works like a highlighter pen - only the selected/current text gets the background
- Support 'transparent' or 'none' value to remove highlight
- Persist in presentation model

**Implementation hint:**
- Use `document.execCommand('hiliteColor', false, color)` for contenteditable
- Or wrap selected text in `<span style="background-color: ${color}">...</span>`
- Similar to how bold/italic works but applies background-color instead

**Use case:** User selects a word or sentence and wants to highlight just that text, not the entire text box.

---

### 2. setTextBoxFontWeight (Priority: HIGH)

**Frontend sends:**
```typescript
await onSendCommand('setTextBoxFontWeight', { elementId, fontWeight: '700' })
```

**Expected Layout Service behavior:**
- Apply `font-weight` CSS to text box content
- Values: '400' (Regular), '500' (Medium), '600' (Semibold), '700' (Bold)
- Persist in presentation model

**Implementation hint:** CSS `font-weight` property on contenteditable element

---

### 3. setTextBoxVerticalAlignment (Priority: HIGH)

**Frontend sends:**
```typescript
await onSendCommand('setTextBoxVerticalAlignment', { verticalAlignment: 'middle' })
```

**Expected Layout Service behavior:**
- Align text content vertically within the text box
- Values: 'top', 'middle', 'bottom'
- Persist in presentation model

**Implementation hint:** Use CSS flexbox with `align-items` or `vertical-align` on table-cell display

---

### 3. setTextBoxColumns (Priority: HIGH)

**Frontend sends:**
```typescript
await onSendCommand('setTextBoxColumns', { columns: 2 })
```

**Expected Layout Service behavior:**
- Split text content into multiple columns
- Values: 1-4
- Persist in presentation model

**Implementation hint:** CSS `column-count` property

---

### 4. setTextBoxParagraphSpacing (Priority: MEDIUM)

**Frontend sends:**
```typescript
await onSendCommand('setTextBoxParagraphSpacing', {
  marginTop: '10pt',
  marginBottom: '10pt'
})
```

**Expected Layout Service behavior:**
- Apply margin to paragraph elements within text box
- Persist in presentation model

**Implementation hint:** Apply to `<p>` tags or set CSS custom properties

---

### 5. setTextBoxAutosize (Priority: MEDIUM)

**Frontend sends:**
```typescript
await onSendCommand('setTextBoxAutosize', { autosize: true })
```

**Expected Layout Service behavior:**
- When true: text box height auto-adjusts to content
- When false: fixed height, content clips or scrolls
- Persist in presentation model

**Implementation hint:** CSS `height: auto` vs fixed height

---

### 6. setTextBoxIndents (Priority: MEDIUM)

**Frontend sends:**
```typescript
await onSendCommand('setTextBoxIndents', {
  firstIndent: '20pt',
  leftIndent: '10pt',
  rightIndent: '10pt'
})
```

**Expected Layout Service behavior:**
- Apply text indentation
- First = first line indent
- Left/Right = margin indents
- Persist in presentation model

**Implementation hint:** CSS `text-indent` for first line, `padding-left/right` for left/right

---

### 7. setTextBoxBorderPositions (Priority: MEDIUM)

**Frontend sends:**
```typescript
await onSendCommand('setTextBoxBorderPositions', {
  positions: ['top', 'bottom']
})
```

**Expected Layout Service behavior:**
- Apply borders only to specified sides
- Works with existing `setTextBoxBorder` for style/color/width
- Persist in presentation model

**Implementation hint:** Set individual `border-top`, `border-right`, etc. based on positions array

---

### 8. setTextBoxBorderOffset (Priority: LOW)

**Frontend sends:**
```typescript
await onSendCommand('setTextBoxBorderOffset', { offset: '6pt' })
```

**Expected Layout Service behavior:**
- Space between content and border
- Separate from text inset (padding)
- Persist in presentation model

**Implementation hint:** Could be additional padding when border is active, or CSS `outline-offset`

---

## Testing Checklist

After Layout Service implements each command:

### Style Tab Tests
- [ ] Select text, apply highlight color → Only selected text gets background color → Reload → Persists
- [ ] Change font weight → Reload → Font weight persists
- [ ] Click vertical align middle → Text centers vertically → Reload → Persists
- [ ] Set paragraph spacing → Reload → Spacing persists
- [ ] Insert bullet list → List renders correctly → Reload → Persists
- [ ] Insert numbered list → List renders correctly → Reload → Persists

### Layout Tab Tests
- [ ] Set columns to 2 → Text splits into 2 columns → Reload → Persists
- [ ] Toggle autosize → Text box resizes → Reload → Persists
- [ ] Set first indent → First line indents → Reload → Persists
- [ ] Set left/right indent → Margins apply → Reload → Persists
- [ ] Select border positions (e.g., top only) → Only top border shows → Reload → Persists
- [ ] Set border offset → Gap appears between content and border → Reload → Persists

### AI Tab Tests
- [ ] Click "Make shorter" → Text shortens
- [ ] Click "Add bullets" → Text converts to bullet list
- [ ] Enter prompt with tone/style → Content generates correctly
- [ ] Generated content injects into text box

---

## Summary

The frontend TextBoxFormatPanel is fully implemented and sends all commands correctly. The gaps are entirely on the Layout Service side:

| Priority | Commands Needed |
|----------|----------------|
| 🔴 HIGH | `setTextHighlightColor` ⭐, `setTextBoxFontWeight`, `setTextBoxVerticalAlignment`, `setTextBoxColumns` |
| 🟡 MEDIUM | `setTextBoxParagraphSpacing`, `setTextBoxAutosize`, `setTextBoxIndents`, `setTextBoxBorderPositions` |
| 🟢 LOW | `setTextBoxBorderOffset` |
| ⚠️ ENHANCEMENT | `generateTextBoxContent` (full action/tone/style support) |

⭐ **NEW: `setTextHighlightColor`** - Inline text highlighting (like a highlighter pen). Different from `setTextBoxBackground` which colors the entire text box.

Once these are implemented, users will have full PowerPoint/Keynote-equivalent text formatting capabilities.
