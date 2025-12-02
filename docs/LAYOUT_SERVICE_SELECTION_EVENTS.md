# Layout Service: Selection Events Requirement

## Problem

When a user clicks on an existing text box in the slide (after page reload or after deselecting), the TextBoxFormatPanel does not appear. The panel only appears when inserting a NEW text box.

## Root Cause

The Layout Service (iframe) is NOT emitting `postMessage` events when the user clicks on existing text boxes. The frontend is already listening for these events at `presentation-viewer.tsx:1236-1260`.

## Solution

The Layout Service must emit `postMessage` events to the parent window whenever element selection changes.

---

## Required Events

### Text Box Selected

```javascript
window.parent.postMessage({
  type: 'textBoxSelected',
  elementId: string,
  formatting: {
    fontFamily: string,
    fontSize: number,
    fontWeight: string,
    fontStyle: string,
    textDecoration: string,
    color: string,
    backgroundColor: string,
    textAlign: string,
    lineHeight: string,
    padding: object,
    border: object,
    borderRadius: object
  } | null
}, '*')
```

### Text Box Deselected

```javascript
window.parent.postMessage({
  type: 'textBoxDeselected'
}, '*')
```

### Element Selected (Image, Table, Chart, Infographic, Diagram)

```javascript
window.parent.postMessage({
  type: 'elementSelected',
  elementId: string,
  elementType: 'image' | 'table' | 'chart' | 'infographic' | 'diagram',
  properties: {
    position: { x: number, y: number },
    size: { width: number, height: number },
    rotation: number,
    locked: boolean,
    zIndex: number
  }
}, '*')
```

### Element Deselected

```javascript
window.parent.postMessage({
  type: 'elementDeselected',
  elementId: string
}, '*')
```

---

## When to Emit

| Trigger | Event to Emit |
|---------|---------------|
| Click on text box | `textBoxSelected` |
| Double-click on text box (edit mode) | `textBoxSelected` |
| Click on other element | `elementSelected` |
| Click on empty slide area | `textBoxDeselected` or `elementDeselected` |
| Press Escape | Deselection event |

---

## Checklist

- [ ] Add click listener to text box elements → emit `textBoxSelected`
- [ ] Add click listener to slide background → emit `textBoxDeselected`
- [ ] Add click listener to other elements → emit `elementSelected`
- [ ] On formatting change while selected → emit updated `textBoxSelected`

---

## Testing

1. Add a text box → Panel appears (already works)
2. Click elsewhere → Panel hides
3. **Click on text box again → Panel should re-appear** (THE FIX)
4. **Reload page → Click saved text box → Panel should appear** (THE FIX)
