# Content Directory

This directory contains template and example data for the Deckster frontend.

## Files

- **`templates.ts`** - Template gallery data (currently 15 placeholders)
- **`examples.ts`** - Example showcase data (currently 8 placeholders)

## How to Add Real Content

### Quick Steps:

1. **For Templates:**
   - Edit `templates.ts` - add new object to the `templates` array
   - Add image to `public/templates/thumbnails/[template-id].jpg`

2. **For Examples:**
   - Edit `examples.ts` - add new object to the `examples` array
   - Add image to `public/examples/thumbnails/[example-id].jpg`

### Full Documentation

See: [`../CONTENT_GUIDE.md`](../CONTENT_GUIDE.md) (quick reference)

Or: [`../docs/ADDING_CONTENT.md`](../docs/ADDING_CONTENT.md) (complete guide)

## Current Status

Both files contain placeholder data with sample content. Replace with real presentation data when available.

Images: Currently using gradient placeholders. Add real 1200x675px thumbnails to replace them automatically.
