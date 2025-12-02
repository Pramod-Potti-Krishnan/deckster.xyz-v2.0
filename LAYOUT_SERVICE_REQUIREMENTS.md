# Layout Service Requirements for TextBoxFormatPanel

This document compares the frontend panel requirements with the existing Layout Service API.

**Reference:** `/agents/layout_builder_main/v7.5-main/docs/TEXTBOX_API_REFERENCE.md`

---

## Already Implemented ✅

These commands are already available in the Layout Service:

| Command | Description | Status |
|---------|-------------|--------|
| `insertTextBox` | Create new text box | ✅ Working |
| `deleteTextBox` | Delete text box | ✅ Working |
| `updateTextBoxContent` | Update HTML content | ✅ Working |
| `getTextBoxContent` | Get HTML content | ✅ Working |
| `getTextBoxFormatting` | Get all formatting props | ✅ Working |
| `applyTextFormatCommand` | Bold, italic, underline, strikethrough, lists | ✅ Working |
| `setTextBoxFont` | Set font family | ✅ Working |
| `setTextBoxFontSize` | Set font size | ✅ Working |
| `setTextBoxColor` | Set text color | ✅ Working |
| `setTextBoxAlignment` | Horizontal alignment (left/center/right/justify) | ✅ Working |
| `setTextBoxLineHeight` | Set line height | ✅ Working |
| `setTextBoxBackground` | Set background color/gradient | ✅ Working |
| `setTextBoxBorder` | Set border (width, color, style, radius) | ✅ Working |
| `setTextBoxPadding` | Set internal padding | ✅ Working |
| `generateTextBoxContent` | Basic AI generation (prompt, style, maxLength) | ✅ Basic |

---

## Needs to be Built 🔨

### 1. setTextBoxFontWeight
Set the font weight for the entire text box.

```typescript
Input: {
  elementId: string,
  fontWeight: string  // '400', '500', '600', '700' or 'normal', 'bold'
}
Output: { success: boolean, error?: string }
```

**Use case:** Font weight dropdown in Style tab (Regular, Medium, Semibold, Bold)

---

### 2. setTextBoxVerticalAlignment
Set vertical text alignment within the text box.

```typescript
Input: {
  elementId: string,
  verticalAlignment: 'top' | 'middle' | 'bottom'
}
Output: { success: boolean, error?: string }
```

**Use case:** Vertical alignment buttons in Style tab (align content to top, middle, or bottom of text box)

**Implementation hint:** CSS `display: flex` + `align-items` or `vertical-align` depending on approach

---

### 3. setTextBoxParagraphSpacing
Set spacing before and after paragraphs.

```typescript
Input: {
  elementId: string,
  marginTop: string,     // e.g., "10pt", "12px"
  marginBottom: string   // e.g., "10pt", "12px"
}
Output: { success: boolean, error?: string }
```

**Use case:** Spacing section in Style tab (Before Paragraph / After Paragraph inputs)

**Implementation hint:** Apply to `<p>` elements or set CSS custom properties

---

### 4. setTextBoxColumns
Set the number of text columns.

```typescript
Input: {
  elementId: string,
  columns: number  // 1-4
}
Output: { success: boolean, error?: string }
```

**Use case:** Columns stepper in Layout tab

**Implementation hint:** CSS `column-count` property

---

### 5. setTextBoxAutosize
Enable/disable automatic text box sizing.

```typescript
Input: {
  elementId: string,
  autosize: boolean
}
Output: { success: boolean, error?: string }
```

**Use case:** Autosize Text toggle in Layout tab

**Implementation hint:** When enabled, text box height adjusts to content; when disabled, content scrolls/clips

---

### 6. setTextBoxIndents
Set text indentation.

```typescript
Input: {
  elementId: string,
  firstIndent: string,   // First line indent, e.g., "20pt"
  leftIndent: string,    // Left margin, e.g., "10pt"
  rightIndent: string    // Right margin, e.g., "10pt"
}
Output: { success: boolean, error?: string }
```

**Use case:** Indents section in Layout tab (First/Left/Right inputs)

**Implementation hint:** CSS `text-indent` for first line, `padding-left/right` or `margin` for left/right

---

### 7. setTextBoxBorderPositions
Set which sides have borders (individual border control).

```typescript
Input: {
  elementId: string,
  positions: ('top' | 'right' | 'bottom' | 'left')[]
}
Output: { success: boolean, error?: string }
```

**Use case:** Border position buttons in Layout tab (L/T/R/B/All)

**Implementation hint:** Set individual `border-top`, `border-right`, etc. Use existing `setTextBoxBorder` for style/color/width, this just controls which sides

---

### 8. setTextBoxBorderOffset
Set the border offset from text (space between content and border).

```typescript
Input: {
  elementId: string,
  offset: string  // e.g., "6pt"
}
Output: { success: boolean, error?: string }
```

**Use case:** Border Offset input in Layout tab

**Implementation hint:** This is essentially padding, but separate from text inset. Could use CSS `outline-offset` or adjust padding when border is active.

---

## AI Content Generation - Enhancement Needed 🔧

The existing `generateTextBoxContent` supports basic generation. We need to extend it:

### Current API:
```typescript
Input: {
  prompt: string,
  elementId?: string,
  style?: 'professional' | 'casual' | 'creative',
  maxLength?: number
}
```

### Enhanced API Needed:
```typescript
Input: {
  elementId: string,
  presentationId?: string,
  slideIndex?: number,

  // Option 1: Quick actions (transform existing text)
  action?: 'shorten' | 'expand' | 'grammar' | 'bulletize' | 'simplify' | 'professional',

  // Option 2: Prompt-based generation
  prompt?: string,
  tone?: 'professional' | 'casual' | 'persuasive' | 'technical',
  style?: 'expand' | 'summarize' | 'rewrite'
}

Output: {
  success: boolean,
  error?: string,
  content?: {
    html: string,      // Generated HTML content
    css?: string,      // Optional inline styles
    js?: string        // Optional JavaScript (for animations, etc.)
  },
  injected?: boolean   // Whether content was auto-injected into elementId
}
```

**Use cases:**
- Quick action chips: "Make shorter", "Fix grammar", "Add bullets", etc.
- Tone selection: Professional, Casual, Persuasive, Technical
- Style selection: Expand, Summarize, Rewrite

**Note:** The Text Service outputs HTML/CSS/JS, which should be injected into the text box.

---

## Summary

| Category | Already Done | Needs Building |
|----------|--------------|----------------|
| Text Styling | 6 commands | 2 commands |
| Box Styling | 4 commands | 0 commands |
| Layout | 1 command | 4 commands |
| AI Generation | Basic | Enhanced version |

### Priority Order (suggested):
1. **setTextBoxVerticalAlignment** - High impact, commonly needed
2. **setTextBoxFontWeight** - Simple addition
3. **setTextBoxColumns** - CSS column-count
4. **setTextBoxIndents** - CSS text-indent + margins
5. **setTextBoxParagraphSpacing** - CSS margins on paragraphs
6. **setTextBoxAutosize** - More complex, affects layout
7. **setTextBoxBorderPositions** - Individual borders
8. **setTextBoxBorderOffset** - Minor feature
9. **Enhanced AI generation** - Integration with Text Service

---

## Notes

1. All commands should follow existing pattern: `{ success: boolean, error?: string }`
2. The `elementId` is the unique identifier of the text box
3. Size values use CSS units: `pt`, `px`, `em`, etc.
4. Color values are hex codes (e.g., `#ffffff`) or CSS color names
5. Frontend will call these via `onSendCommand()` which wraps postMessage
