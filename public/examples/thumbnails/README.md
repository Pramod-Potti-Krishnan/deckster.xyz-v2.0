# Example Thumbnails

Add example presentation thumbnail images here.

## Naming Convention

Use the example ID as the filename:
- Example ID: `saas-startup-pitch`
- Filename: `saas-startup-pitch.jpg`

## Image Specifications

- **Format:** JPG or PNG
- **Size:** 1200x675px (16:9 aspect ratio)
- **File Size:** Under 200KB for optimal performance
- **Quality:** 80-90% JPG compression

## How Images Are Used

Example thumbnails are displayed on:
- `/examples` page (showcase grid)
- Example preview/detail pages
- Featured examples sections

## Current Status

Currently showing gradient placeholders with industry color coding. Add real images here to replace them automatically.

## Reference Path

Images are referenced in `content/examples.ts` as:
```typescript
thumbnail: '/examples/thumbnails/[example-id].jpg'
```

## Example

If your example ID is `fintech-series-b-pitch`, save the image as:
```
fintech-series-b-pitch.jpg
```

The system will automatically load this image on the examples page.

## Tips

- Use actual slide screenshots from the presentation
- First slide or most visually appealing slide works well
- Ensure text is readable at thumbnail size
- Maintain consistent visual quality across all examples
