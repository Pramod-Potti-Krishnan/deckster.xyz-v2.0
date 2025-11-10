# Quick Content Guide

**Looking to add real templates or examples? Read this!**

Full detailed guide: [`docs/ADDING_CONTENT.md`](./docs/ADDING_CONTENT.md)

---

## Quick Start

### Adding a Template

1. **Edit:** `content/templates.ts` - Add your template data
2. **Image:** `public/templates/thumbnails/[template-id].jpg` - Add 1200x675px thumbnail
3. **Test:** Visit `http://localhost:3002/templates`

### Adding an Example

1. **Edit:** `content/examples.ts` - Add your example data
2. **Image:** `public/examples/thumbnails/[example-id].jpg` - Add 1200x675px thumbnail
3. **Test:** Visit `http://localhost:3002/examples`

### Adding a Blog Article

1. **Edit:** `content/articles.ts` - Add your article data with full markdown content
2. **Image:** `public/articles/[article-id].jpg` - Add 1200x630px cover image (optional)
3. **Test:** Visit `http://localhost:3002/resources`

---

## File Locations

```
deckster-frontend/
├── content/
│   ├── templates.ts       ← Add template data here
│   ├── examples.ts        ← Add example data here
│   └── articles.ts        ← Add blog article data here
│
└── public/
    ├── templates/
    │   └── thumbnails/    ← Add template images here
    ├── examples/
    │   └── thumbnails/    ← Add example images here
    └── articles/          ← Add article cover images here (optional)
```

---

## Template Data Format

```typescript
{
  id: 'my-template',
  title: 'My Template Name',
  description: 'What this template is for...',
  category: 'business',  // business|sales|marketing|startup|education|creative
  complexity: 'intermediate',  // basic|intermediate|advanced
  slideCount: 12,
  thumbnail: '/templates/thumbnails/my-template.jpg',
  agents: ['director', 'scripter'],
  tags: ['business', 'report'],
  createdAt: '2025-01-15'
}
```

---

## Example Data Format

```typescript
{
  id: 'my-example',
  title: 'My Example Name',
  description: 'What this presentation is about...',
  story: 'Real-world context and results...',
  industry: 'technology',  // technology|marketing|sales|education|analytics|creative|non-profit
  useCase: 'startup-pitch',  // startup-pitch|business-reporting|strategy|training|academic|portfolio|data-reporting|fundraising
  complexity: 'advanced',
  slideCount: 14,
  thumbnail: '/examples/thumbnails/my-example.jpg',
  agents: ['director', 'scripter', 'graphic-artist', 'data-visualizer'],
  tags: ['startup', 'pitch'],
  createdAt: '2025-01-20',
  viewCount: 1250
}
```

---

## Article Data Format

```typescript
{
  id: 'my-article-slug',
  title: 'My Article Title',
  excerpt: 'A short summary of the article...',
  content: `# My Article Title

Full markdown content here...

## Section 1
Content...
`,
  category: 'tutorials',  // tutorials|ai-insights|best-practices|product-updates|customer-stories
  author: {
    name: 'Author Name',
    role: 'Position',
    avatar: '/avatars/author.jpg'  // optional
  },
  publishedAt: '2025-01-20',
  readTime: 5,  // in minutes
  featured: true,  // optional
  tags: ['tag1', 'tag2'],
  coverImage: '/articles/my-article-slug.jpg'
}
```

---

## Current Status

✅ **Templates:** 15 placeholders with gradient backgrounds
✅ **Examples:** 8 placeholders with gradient backgrounds
✅ **Blog Articles:** 6 articles with full content

🔄 **To Replace Placeholders:**
- Add real thumbnail images to the directories above
- Images will automatically replace gradients
- Add real blog article cover images to `public/articles/`
- No code changes needed!

---

See [`docs/ADDING_CONTENT.md`](./docs/ADDING_CONTENT.md) for complete documentation.
