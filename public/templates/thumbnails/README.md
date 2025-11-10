# Template Thumbnails

Add template thumbnail images here.

## Naming Convention

Use the template ID as the filename:
- Template ID: `business-quarterly-review`
- Filename: `business-quarterly-review.jpg`

## Image Specifications

- **Format:** JPG or PNG
- **Size:** 1200x675px (16:9 aspect ratio)
- **File Size:** Under 200KB for optimal performance
- **Quality:** 80-90% JPG compression

## How Images Are Used

Template thumbnails are displayed on:
- `/templates` page (gallery grid)
- Template preview modals
- Search results

## Current Status

Currently showing gradient placeholders. Add real images here to replace them automatically.

## Reference Path

Images are referenced in `content/templates.ts` as:
```typescript
thumbnail: '/templates/thumbnails/[template-id].jpg'
```

## Example

If your template ID is `executive-summary-2025`, save the image as:
```
executive-summary-2025.jpg
```

The system will automatically load this image on the templates page.
