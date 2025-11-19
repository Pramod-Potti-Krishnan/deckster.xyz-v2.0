# Adding Templates and Examples to Deckster

This guide explains how to add real presentation content (templates and examples) to replace the current placeholders.

---

## Table of Contents

1. [Adding Templates](#adding-templates)
2. [Adding Examples](#adding-examples)
3. [Adding Images/Thumbnails](#adding-imagesthumbnails)
4. [Quick Reference](#quick-reference)

---

## Adding Templates

### Step 1: Locate the Template Data File

File: `content/templates.ts`

### Step 2: Add Your Template Data

Add a new object to the `templates` array following this structure:

```typescript
{
  id: 'unique-template-id',                    // Kebab-case, unique identifier
  title: 'Template Title',                      // Display name
  description: 'Full description of what this template includes and who it\'s for.',
  category: 'business',                         // Options: business, sales, marketing, startup, education, creative
  complexity: 'intermediate',                   // Options: basic, intermediate, advanced
  slideCount: 12,                               // Number of slides
  thumbnail: '/templates/thumbnails/unique-template-id.jpg',  // Path to thumbnail image
  agents: ['director', 'scripter', 'graphic-artist'],  // Which AI agents are used
  featured: true,                               // Optional: show in featured section
  popular: false,                               // Optional: show in popular section
  new: false,                                   // Optional: show "New" badge
  tags: ['quarterly', 'business', 'metrics'],   // Search tags
  createdAt: '2025-01-15'                       // ISO date format
}
```

### Example:

```typescript
{
  id: 'executive-summary-2025',
  title: 'Executive Summary 2025',
  description: 'Comprehensive executive summary template with KPI dashboard, strategic initiatives, and board presentation format.',
  category: 'business',
  complexity: 'advanced',
  slideCount: 18,
  thumbnail: '/templates/thumbnails/executive-summary-2025.jpg',
  agents: ['director', 'scripter', 'data-visualizer'],
  featured: true,
  popular: true,
  tags: ['executive', 'summary', 'board', 'kpi', 'strategy'],
  createdAt: '2025-02-01'
}
```

### Available Categories:
- `business` - Business/corporate presentations
- `sales` - Sales pitches and proposals
- `marketing` - Marketing campaigns and reports
- `startup` - Startup pitches and planning
- `education` - Educational and training content
- `creative` - Creative portfolios and showcases

### Available Agents:
- `director` - Orchestration & planning
- `scripter` - Content & copywriting
- `graphic-artist` - Visual design & layout
- `data-visualizer` - Charts & data insights

---

## Adding Examples

### Step 1: Locate the Example Data File

File: `content/examples.ts`

### Step 2: Add Your Example Data

Add a new object to the `examples` array:

```typescript
{
  id: 'unique-example-id',                      // Kebab-case, unique identifier
  title: 'Example Title',                       // Display name
  description: 'What this presentation is about and what it includes.',
  story: 'The real-world context and results. E.g., "Helped Company X raise $5M Series A"',
  industry: 'technology',                       // See industries below
  useCase: 'startup-pitch',                     // See use cases below
  complexity: 'advanced',                       // Options: basic, intermediate, advanced
  slideCount: 14,                               // Number of slides
  thumbnail: '/examples/thumbnails/unique-example-id.jpg',  // Path to thumbnail
  agents: ['director', 'scripter', 'graphic-artist', 'data-visualizer'],
  featured: true,                               // Optional: highlight this example
  tags: ['startup', 'fundraising', 'ai'],       // Search tags
  createdAt: '2025-01-20',                      // ISO date format
  viewCount: 1250                               // Optional: view count
}
```

### Example:

```typescript
{
  id: 'fintech-series-b-pitch',
  title: 'Fintech Startup Series B Pitch',
  description: 'Series B funding pitch for a payment processing fintech. Includes traction metrics, unit economics, and expansion strategy.',
  story: 'PayFlow presented this deck to close their $15M Series B round led by Sequoia Capital.',
  industry: 'technology',
  useCase: 'startup-pitch',
  complexity: 'advanced',
  slideCount: 16,
  thumbnail: '/examples/thumbnails/fintech-series-b-pitch.jpg',
  agents: ['director', 'scripter', 'graphic-artist', 'data-visualizer'],
  featured: true,
  tags: ['fintech', 'series-b', 'fundraising', 'payments'],
  createdAt: '2025-02-01',
  viewCount: 2500
}
```

### Available Industries:
- `technology` - Tech companies and software
- `marketing` - Marketing agencies and campaigns
- `sales` - Sales teams and proposals
- `education` - Schools, courses, training
- `analytics` - Data science and analytics
- `creative` - Design and creative agencies
- `non-profit` - Non-profit organizations

### Available Use Cases:
- `startup-pitch` - Startup funding pitches
- `business-reporting` - Business reports and reviews
- `strategy` - Strategic planning and roadmaps
- `training` - Training and onboarding
- `academic` - Academic lectures and courses
- `portfolio` - Creative portfolios
- `data-reporting` - Data analysis reports
- `fundraising` - Fundraising campaigns

---

## Adding Images/Thumbnails

### For Templates:

1. **Location:** `public/templates/thumbnails/`
2. **Naming:** Use the template ID as filename (e.g., `executive-summary-2025.jpg`)
3. **Format:** JPG or PNG
4. **Recommended Size:** 1200x675px (16:9 aspect ratio)
5. **File Size:** Keep under 200KB for performance

### For Examples:

1. **Location:** `public/examples/thumbnails/`
2. **Naming:** Use the example ID as filename (e.g., `fintech-series-b-pitch.jpg`)
3. **Format:** JPG or PNG
4. **Recommended Size:** 1200x675px (16:9 aspect ratio)
5. **File Size:** Keep under 200KB for performance

### Creating Thumbnails:

**Option 1: Screenshot from actual presentation**
- Export first slide or most representative slide
- Resize to 1200x675px
- Save as JPG at 80-90% quality

**Option 2: Create custom thumbnail**
- Use Figma, Canva, or Photoshop
- 1200x675px canvas
- Include: presentation title, visual preview, category/industry
- Export as JPG

**Option 3: Use placeholder (current approach)**
- Currently using gradient backgrounds with icons
- Will automatically be replaced when you add real images

### Current Placeholder System:

Templates and examples currently show gradient placeholders. When you add a real image:

1. Place the image file in the correct directory
2. The component will automatically load it instead of showing the placeholder
3. No code changes needed - just add the image file!

---

## Quick Reference

### File Locations

| Content Type | Data File | Image Directory |
|--------------|-----------|-----------------|
| Templates | `content/templates.ts` | `public/templates/thumbnails/` |
| Examples | `content/examples.ts` | `public/examples/thumbnails/` |

### Adding Content Checklist

**For Templates:**
- [ ] Add template object to `content/templates.ts`
- [ ] Create 1200x675px thumbnail
- [ ] Place thumbnail in `public/templates/thumbnails/[template-id].jpg`
- [ ] Test: Visit `/templates` and find your new template
- [ ] Verify: Search, filter, and preview all work

**For Examples:**
- [ ] Add example object to `content/examples.ts`
- [ ] Create 1200x675px thumbnail
- [ ] Place thumbnail in `public/examples/thumbnails/[example-id].jpg`
- [ ] Test: Visit `/examples` and find your new example
- [ ] Verify: Search, filter, and view count display correctly

### Testing Your Changes

After adding new content:

1. **Start dev server:** `npm run dev`
2. **Visit pages:**
   - Templates: `http://localhost:3002/templates`
   - Examples: `http://localhost:3002/examples`
3. **Test features:**
   - Search for your new content
   - Filter by category/industry
   - Click "Preview" or "View Full"
   - Check responsive design (mobile/tablet)

### Common Issues

**Image not showing?**
- Check file path matches exactly: `/templates/thumbnails/[id].jpg`
- Ensure image is in `public/` directory (not `src/`)
- Refresh browser cache (Cmd+Shift+R / Ctrl+Shift+R)
- Check browser console for 404 errors

**Template/Example not appearing?**
- Verify you added it to the array in the correct file
- Check for syntax errors (commas, brackets)
- Ensure `id` is unique
- Restart dev server if hot reload doesn't work

**Search not finding content?**
- Add relevant keywords to `tags` array
- Include searchable terms in `title` and `description`
- Tags are case-insensitive and partial-match

---

## Advanced: Connecting to Real Presentation Data

Currently templates and examples are static data structures. To connect them to actual presentation files:

### Future Enhancement Options:

1. **Store presentation JSON:**
   ```
   public/templates/data/[template-id].json
   ```

2. **Preview functionality:**
   - Load presentation data when user clicks "Preview"
   - Show actual slides in a carousel/viewer
   - Allow inline editing before using as template

3. **Template → Builder integration:**
   - When user clicks "Use Template", load the template data
   - Pre-populate the builder with template content
   - User can modify and generate with AI agents

4. **Example → Template conversion:**
   - Add "Use as Template" button
   - Convert example to editable template
   - Preserve structure but allow customization

### Data Structure (Future):

```json
{
  "id": "template-id",
  "slides": [
    {
      "id": "slide-1",
      "title": "Title Slide",
      "content": "Slide content here",
      "layout": "title-center",
      "notes": "Speaker notes"
    },
    // ... more slides
  ],
  "metadata": {
    "theme": "professional",
    "colors": ["#6366f1", "#3b82f6"],
    "fonts": ["Inter", "Roboto"]
  }
}
```

---

## Need Help?

If you need assistance adding content:

1. Check this guide first
2. Look at existing entries in `content/templates.ts` or `content/examples.ts`
3. Ensure file paths and naming conventions match exactly
4. Test one template/example first before adding many
5. Check browser console for errors

---

## Summary

**To add a template:**
1. Edit `content/templates.ts`
2. Add thumbnail to `public/templates/thumbnails/`
3. Test at `/templates`

**To add an example:**
1. Edit `content/examples.ts`
2. Add thumbnail to `public/examples/thumbnails/`
3. Test at `/examples`

That's it! The system will automatically display your new content with filtering, search, and all features working out of the box.
