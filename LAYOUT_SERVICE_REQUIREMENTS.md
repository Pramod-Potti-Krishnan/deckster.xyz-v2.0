# Layout Service Requirements for Text Formatting

This document describes all the commands the Layout Service needs to implement to support the TextBoxFormatPanel features.

---

## Text Styling Commands

### setTextBoxColor
Applies text color to selected text or entire element.
```typescript
Input: { elementId: string, color: string }  // color is hex, e.g., "#ff0000"
Output: { success: boolean, error?: string }
```

### setTextBoxFont
Sets the font family.
```typescript
Input: { elementId: string, fontFamily: string }  // e.g., "Inter", "Arial"
Output: { success: boolean, error?: string }
```

### setTextBoxFontSize
Sets the font size.
```typescript
Input: { elementId: string, fontSize: string }  // e.g., "24pt", "16px"
Output: { success: boolean, error?: string }
```

### setTextBoxFontWeight
Sets the font weight.
```typescript
Input: { elementId: string, fontWeight: string }  // "400", "500", "600", "700"
Output: { success: boolean, error?: string }
```

### applyTextFormatCommand
Applies text formatting commands (bold, italic, underline, etc.).
```typescript
Input: { command: string }
// Commands: 'bold', 'italic', 'underline', 'strikethrough',
//           'insertUnorderedList', 'insertOrderedList'
Output: { success: boolean, error?: string }
```

---

## Alignment Commands

### setTextBoxAlignment
Sets horizontal text alignment.
```typescript
Input: { elementId: string, alignment: 'left' | 'center' | 'right' | 'justify' }
Output: { success: boolean, error?: string }
```

### setTextBoxVerticalAlignment
Sets vertical text alignment within the text box.
```typescript
Input: { elementId: string, verticalAlignment: 'top' | 'middle' | 'bottom' }
Output: { success: boolean, error?: string }
```

---

## Spacing Commands

### setTextBoxLineHeight
Sets the line height.
```typescript
Input: { elementId: string, lineHeight: string }  // e.g., "1.5", "2"
Output: { success: boolean, error?: string }
```

### setTextBoxParagraphSpacing
Sets spacing before and after paragraphs.
```typescript
Input: { elementId: string, marginTop: string, marginBottom: string }  // e.g., "10pt"
Output: { success: boolean, error?: string }
```

---

## Layout Commands

### setTextBoxColumns
Sets the number of text columns.
```typescript
Input: { elementId: string, columns: number }  // 1-4
Output: { success: boolean, error?: string }
```

### setTextBoxPadding
Sets the text inset/padding.
```typescript
Input: { elementId: string, padding: string }  // e.g., "10pt"
Output: { success: boolean, error?: string }
```

### setTextBoxAutosize
Enables/disables text autosize.
```typescript
Input: { elementId: string, autosize: boolean }
Output: { success: boolean, error?: string }
```

### setTextBoxIndents
Sets text indentation.
```typescript
Input: {
  elementId: string,
  firstIndent: string,   // First line indent, e.g., "20pt"
  leftIndent: string,    // Left margin
  rightIndent: string    // Right margin
}
Output: { success: boolean, error?: string }
```

---

## Border Commands

### setTextBoxBorder
Sets the border style, width, color, and radius.
```typescript
Input: {
  elementId: string,
  borderStyle: 'none' | 'solid',
  borderWidth: string,    // e.g., "1pt"
  borderColor: string,    // hex, e.g., "#000000"
  borderRadius: string    // e.g., "4px", "0px"
}
Output: { success: boolean, error?: string }
```

### setTextBoxBorderPositions
Sets which sides have borders.
```typescript
Input: { elementId: string, positions: ('top' | 'right' | 'bottom' | 'left')[] }
Output: { success: boolean, error?: string }
```

### setTextBoxBorderOffset
Sets the border offset from text.
```typescript
Input: { elementId: string, offset: string }  // e.g., "6pt"
Output: { success: boolean, error?: string }
```

---

## Background Commands

### setTextBoxBackground
Sets the background color.
```typescript
Input: { elementId: string, backgroundColor: string }  // hex or "transparent"
Output: { success: boolean, error?: string }
```

---

## AI Content Commands

### generateTextBoxContent
Generates or transforms text content using AI.
```typescript
Input: {
  elementId: string,
  presentationId?: string,
  slideIndex?: number,

  // For quick actions (on existing text)
  action?: 'shorten' | 'expand' | 'grammar' | 'bulletize' | 'simplify' | 'professional',

  // For prompt-based generation
  prompt?: string,
  tone?: 'professional' | 'casual' | 'persuasive' | 'technical',
  style?: 'expand' | 'summarize' | 'rewrite'
}

Output: {
  success: boolean,
  error?: string,
  content?: {
    html: string,      // Generated HTML content
    css?: string,      // Optional CSS styles
    js?: string        // Optional JavaScript
  }
}
```

---

## Summary of All Commands

| Category | Command | Description |
|----------|---------|-------------|
| Text Styling | setTextBoxColor | Set text color |
| Text Styling | setTextBoxFont | Set font family |
| Text Styling | setTextBoxFontSize | Set font size |
| Text Styling | setTextBoxFontWeight | Set font weight |
| Text Styling | applyTextFormatCommand | Bold, italic, underline, lists |
| Alignment | setTextBoxAlignment | Horizontal alignment |
| Alignment | setTextBoxVerticalAlignment | Vertical alignment |
| Spacing | setTextBoxLineHeight | Line height |
| Spacing | setTextBoxParagraphSpacing | Paragraph spacing |
| Layout | setTextBoxColumns | Number of columns |
| Layout | setTextBoxPadding | Text inset |
| Layout | setTextBoxAutosize | Enable autosize |
| Layout | setTextBoxIndents | Text indentation |
| Border | setTextBoxBorder | Border style/width/color |
| Border | setTextBoxBorderPositions | Border sides |
| Border | setTextBoxBorderOffset | Border offset |
| Background | setTextBoxBackground | Background color |
| AI | generateTextBoxContent | AI text generation |

---

## Notes

1. All commands should return `{ success: boolean, error?: string }` at minimum
2. The `elementId` is the unique identifier of the text box element
3. Size values use CSS units: `pt`, `px`, `em`, etc.
4. Color values are hex codes (e.g., `#ffffff`) or `transparent`
5. AI content generation returns HTML/CSS/JS that gets injected into the text box
