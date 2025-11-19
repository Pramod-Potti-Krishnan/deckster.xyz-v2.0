# v7.5-main API Reference

**Version**: 7.5.0
**Base URL**: `http://localhost:8504` (or your deployed URL)
**API Type**: REST
**Content-Type**: `application/json`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
   - [Presentations](#presentations)
   - [Downloads & Exports](#downloads--exports)
4. [Data Models](#data-models)
5. [Error Handling](#error-handling)
6. [Rate Limits](#rate-limits)
7. [Examples](#examples)

---

## Overview

The v7.5-main API provides a simplified presentation builder with two layouts (L25 and L29) and powerful export capabilities. This API enables you to:

- ✅ Create presentations with rich HTML content
- ✅ Retrieve and manage presentations
- ✅ Export presentations as PDF or PowerPoint (PPTX)
- ✅ View presentations in a web-based viewer

**Key Features**:
- **Simple Architecture**: Only 2 layouts for maximum flexibility
- **Full Creative Control**: Text Service owns content areas
- **High-Fidelity Exports**: PDF and PPTX with perfect visual preservation
- **RESTful Design**: Standard HTTP methods and status codes

---

## Authentication

**Current Version**: No authentication required (internal use)

For production deployments, consider adding:
- API key authentication (`X-API-Key` header)
- OAuth 2.0 for user-specific operations
- Rate limiting per API key

---

## API Endpoints

### Presentations

#### 1. Create Presentation

Create a new presentation with slides.

**Endpoint**: `POST /api/presentations`

**Request Body**:
```json
{
  "title": "Presentation Title",
  "slides": [
    {
      "layout": "L29",
      "content": {
        "hero_content": "<div>...</div>"
      }
    },
    {
      "layout": "L25",
      "content": {
        "slide_title": "Slide Title",
        "subtitle": "Optional Subtitle",
        "rich_content": "<div>...</div>",
        "presentation_name": "Optional Footer Text",
        "company_logo": "Optional Logo HTML"
      }
    }
  ]
}
```

**Response**: `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "/p/550e8400-e29b-41d4-a716-446655440000",
  "message": "Presentation 'Presentation Title' created successfully"
}
```

**Validation**:
- `title`: Required, max 200 characters
- `slides`: Required, minimum 1 slide
- `layout`: Must be "L25" or "L29"
- L25 `slide_title`: Max 80 characters
- L25 `subtitle`: Max 120 characters

**Example**:
```bash
curl -X POST http://localhost:8504/api/presentations \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Q4 Business Review",
    "slides": [
      {
        "layout": "L29",
        "content": {
          "hero_content": "<div style=\"width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center;\"><h1 style=\"font-size: 96px; color: white;\">Q4 Results</h1></div>"
        }
      }
    ]
  }'
```

---

#### 2. Get Presentation Data

Retrieve presentation data as JSON.

**Endpoint**: `GET /api/presentations/{id}`

**Path Parameters**:
- `id` (string, required): Presentation UUID

**Response**: `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Q4 Business Review",
  "slides": [...],
  "created_at": "2025-01-09T12:00:00Z"
}
```

**Error Responses**:
- `404 Not Found`: Presentation does not exist

**Example**:
```bash
curl http://localhost:8504/api/presentations/550e8400-e29b-41d4-a716-446655440000
```

---

#### 3. List All Presentations

Get a list of all presentations.

**Endpoint**: `GET /api/presentations`

**Response**: `200 OK`
```json
{
  "count": 15,
  "presentations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Q4 Business Review",
      "created_at": "2025-01-09T12:00:00Z",
      "slide_count": 10
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Product Launch",
      "created_at": "2025-01-08T10:30:00Z",
      "slide_count": 15
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:8504/api/presentations
```

---

#### 4. View Presentation

View presentation in web-based viewer (returns HTML).

**Endpoint**: `GET /p/{id}`

**Path Parameters**:
- `id` (string, required): Presentation UUID

**Response**: `200 OK` (HTML content)

Opens an interactive Reveal.js-based presentation viewer.

**Features**:
- Arrow key navigation
- Keyboard shortcuts (G for grid, B for borders)
- Responsive design
- Full-screen support

**Example**:
```bash
# Open in browser
open http://localhost:8504/p/550e8400-e29b-41d4-a716-446655440000
```

---

#### 5. Delete Presentation

Delete a presentation by ID.

**Endpoint**: `DELETE /api/presentations/{id}`

**Path Parameters**:
- `id` (string, required): Presentation UUID

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Presentation 550e8400-e29b-41d4-a716-446655440000 deleted"
}
```

**Error Responses**:
- `404 Not Found`: Presentation does not exist

**Example**:
```bash
curl -X DELETE http://localhost:8504/api/presentations/550e8400-e29b-41d4-a716-446655440000
```

---

### Downloads & Exports

#### 6. Download as PDF

Export presentation as a PDF file.

**Endpoint**: `GET /api/presentations/{id}/download/pdf`

**Path Parameters**:
- `id` (string, required): Presentation UUID

**Query Parameters**:
- `landscape` (boolean, default: `true`): Use landscape orientation
- `print_background` (boolean, default: `true`): Include background graphics
- `quality` (string, default: `"high"`): Quality level - `"high"`, `"medium"`, or `"low"`

**Response**: `200 OK` (PDF file download)

**Headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="presentation-title.pdf"
```

**Quality Settings**:
| Quality | Resolution | Use Case |
|---------|-----------|----------|
| `high` | 1920×1080 | Final deliverables, printing |
| `medium` | 1440×810 | Quick reviews, email sharing |
| `low` | 960×540 | Draft versions, fast downloads |

**Features**:
- ✅ Preserves all CSS styling and gradients
- ✅ High-fidelity rendering via Playwright
- ✅ Multi-page PDF with proper dimensions
- ✅ Filename derived from presentation title

**Example**:
```bash
# High quality PDF
curl "http://localhost:8504/api/presentations/550e8400-e29b-41d4-a716-446655440000/download/pdf?quality=high" \
  -o presentation.pdf

# Medium quality, portrait orientation
curl "http://localhost:8504/api/presentations/550e8400-e29b-41d4-a716-446655440000/download/pdf?landscape=false&quality=medium" \
  -o presentation.pdf
```

**Browser Usage**:
```
http://localhost:8504/api/presentations/{id}/download/pdf
```

---

#### 7. Download as PPTX

Export presentation as a PowerPoint (PPTX) file.

**Endpoint**: `GET /api/presentations/{id}/download/pptx`

**Path Parameters**:
- `id` (string, required): Presentation UUID

**Query Parameters**:
- `aspect_ratio` (string, default: `"16:9"`): Slide aspect ratio - `"16:9"` or `"4:3"`
- `quality` (string, default: `"high"`): Image quality - `"high"`, `"medium"`, or `"low"`

**Response**: `200 OK` (PPTX file download)

**Headers**:
```
Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation
Content-Disposition: attachment; filename="presentation-title.pptx"
```

**Aspect Ratio Options**:
- `16:9`: Widescreen (10" × 5.625") - Standard for modern presentations
- `4:3`: Traditional (10" × 7.5") - Legacy format

**Quality Settings**:
| Quality | Resolution | File Size | Use Case |
|---------|-----------|-----------|----------|
| `high` | 1920×1080 | ~3-5MB | Final deliverables |
| `medium` | 1440×810 | ~2-3MB | Email-friendly |
| `low` | 960×540 | ~1-2MB | Quick sharing |

**Features**:
- ✅ Screenshot-based slides for perfect visual fidelity
- ✅ Compatible with PowerPoint, Keynote, Google Slides
- ✅ Preserves all styling, gradients, and custom fonts
- ⚠️ Text not editable (slides are images)

**Example**:
```bash
# High quality, 16:9 aspect ratio
curl "http://localhost:8504/api/presentations/550e8400-e29b-41d4-a716-446655440000/download/pptx?quality=high" \
  -o presentation.pptx

# 4:3 aspect ratio, medium quality
curl "http://localhost:8504/api/presentations/550e8400-e29b-41d4-a716-446655440000/download/pptx?aspect_ratio=4:3&quality=medium" \
  -o presentation.pptx
```

**Browser Usage**:
```
http://localhost:8504/api/presentations/{id}/download/pptx
```

---

## Data Models

### Presentation

```typescript
interface Presentation {
  title: string;           // Max 200 characters
  slides: Slide[];         // Minimum 1 slide
}
```

### Slide

```typescript
interface Slide {
  layout: "L25" | "L29";
  content: L25Content | L29Content;
}
```

### L25Content (Main Content Shell)

```typescript
interface L25Content {
  slide_title: string;          // Required, max 80 chars
  subtitle?: string;            // Optional, max 120 chars
  rich_content: string;         // Required, HTML string
  presentation_name?: string;   // Optional footer text
  company_logo?: string;        // Optional logo HTML
}
```

**Content Area**: 1800px × 720px
**Format Owner**: Text Service (rich_content)
**Use Case**: 80% of slides - main content

### L29Content (Hero Full-Bleed)

```typescript
interface L29Content {
  hero_content: string;   // Required, full HTML string
}
```

**Content Area**: 1920px × 1080px (full slide)
**Format Owner**: Text Service (complete control)
**Use Cases**: Title slides, section dividers, hero moments, ending slides

### PresentationResponse

```typescript
interface PresentationResponse {
  id: string;      // UUID
  url: string;     // Viewer URL path
  message: string; // Success message
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "detail": "Error description"
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `200` | OK | Request successful |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid request data or parameters |
| `404` | Not Found | Resource does not exist |
| `500` | Internal Server Error | Server-side error occurred |

### Common Errors

**400 Bad Request**:
```json
{
  "detail": "Invalid layout 'L99'. Valid layouts: ['L25', 'L29']"
}
```

**404 Not Found**:
```json
{
  "detail": "Presentation not found"
}
```

**500 Internal Server Error**:
```json
{
  "detail": "Error generating PDF: Browser automation failed"
}
```

---

## Rate Limits

**Current**: No rate limiting (internal use)

**Recommended for Production**:
- 100 requests per minute per IP
- 1000 requests per hour per API key
- Download endpoints: 10 concurrent requests maximum

**Headers** (future implementation):
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

---

## Examples

### Complete Workflow Example

```bash
#!/bin/bash

# 1. Create a presentation
RESPONSE=$(curl -s -X POST http://localhost:8504/api/presentations \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Product Launch 2025",
    "slides": [
      {
        "layout": "L29",
        "content": {
          "hero_content": "<div style=\"width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; flex-direction: column; align-items: center; justify-content: center;\"><h1 style=\"font-size: 96px; color: white; font-weight: 900;\">Product Launch</h1><p style=\"font-size: 42px; color: rgba(255,255,255,0.9); margin-top: 32px;\">Revolutionizing the Industry</p></div>"
        }
      },
      {
        "layout": "L25",
        "content": {
          "slide_title": "Key Features",
          "subtitle": "What makes us different",
          "rich_content": "<div style=\"padding: 40px;\"><ul style=\"font-size: 32px; line-height: 2;\"><li>AI-Powered Analytics</li><li>Real-time Collaboration</li><li>Enterprise Security</li></ul></div>"
        }
      },
      {
        "layout": "L29",
        "content": {
          "hero_content": "<div style=\"width: 100%; height: 100%; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); display: flex; flex-direction: column; align-items: center; justify-content: center;\"><h1 style=\"font-size: 96px; color: white; font-weight: 900;\">Thank You</h1></div>"
        }
      }
    ]
  }')

# Extract presentation ID
PRES_ID=$(echo $RESPONSE | jq -r '.id')
echo "Created presentation: $PRES_ID"

# 2. View in browser
echo "View at: http://localhost:8504/p/$PRES_ID"

# 3. Download as PDF
curl "http://localhost:8504/api/presentations/$PRES_ID/download/pdf?quality=high" \
  -o "product-launch.pdf"
echo "PDF saved: product-launch.pdf"

# 4. Download as PPTX
curl "http://localhost:8504/api/presentations/$PRES_ID/download/pptx?quality=high" \
  -o "product-launch.pptx"
echo "PPTX saved: product-launch.pptx"

# 5. List all presentations
curl http://localhost:8504/api/presentations | jq '.presentations[] | {id, title}'

# 6. Get specific presentation data
curl http://localhost:8504/api/presentations/$PRES_ID | jq '.'
```

### Python Integration Example

```python
import requests
import json

BASE_URL = "http://localhost:8504"

def create_presentation(title, slides):
    """Create a new presentation."""
    response = requests.post(
        f"{BASE_URL}/api/presentations",
        json={"title": title, "slides": slides}
    )
    response.raise_for_status()
    return response.json()

def download_pdf(presentation_id, output_path, quality="high"):
    """Download presentation as PDF."""
    response = requests.get(
        f"{BASE_URL}/api/presentations/{presentation_id}/download/pdf",
        params={"quality": quality, "landscape": True}
    )
    response.raise_for_status()

    with open(output_path, 'wb') as f:
        f.write(response.content)

    return output_path

def download_pptx(presentation_id, output_path, quality="high"):
    """Download presentation as PPTX."""
    response = requests.get(
        f"{BASE_URL}/api/presentations/{presentation_id}/download/pptx",
        params={"quality": quality, "aspect_ratio": "16:9"}
    )
    response.raise_for_status()

    with open(output_path, 'wb') as f:
        f.write(response.content)

    return output_path

# Usage
slides = [
    {
        "layout": "L29",
        "content": {
            "hero_content": "<div style='...'>Title Slide</div>"
        }
    },
    {
        "layout": "L25",
        "content": {
            "slide_title": "Content Slide",
            "rich_content": "<div>Content here</div>"
        }
    }
]

result = create_presentation("My Presentation", slides)
pres_id = result["id"]

# Download both formats
download_pdf(pres_id, "output.pdf", quality="high")
download_pptx(pres_id, "output.pptx", quality="high")
```

### JavaScript/Node.js Example

```javascript
const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:8504';

async function createPresentation(title, slides) {
  const response = await axios.post(`${BASE_URL}/api/presentations`, {
    title,
    slides
  });
  return response.data;
}

async function downloadPDF(presentationId, outputPath, quality = 'high') {
  const response = await axios.get(
    `${BASE_URL}/api/presentations/${presentationId}/download/pdf`,
    {
      params: { quality, landscape: true },
      responseType: 'arraybuffer'
    }
  );

  fs.writeFileSync(outputPath, response.data);
  return outputPath;
}

async function downloadPPTX(presentationId, outputPath, quality = 'high') {
  const response = await axios.get(
    `${BASE_URL}/api/presentations/${presentationId}/download/pptx`,
    {
      params: { quality, aspect_ratio: '16:9' },
      responseType: 'arraybuffer'
    }
  );

  fs.writeFileSync(outputPath, response.data);
  return outputPath;
}

// Usage
async function main() {
  const slides = [
    {
      layout: 'L29',
      content: {
        hero_content: '<div style="...">Title Slide</div>'
      }
    },
    {
      layout: 'L25',
      content: {
        slide_title: 'Content Slide',
        rich_content: '<div>Content here</div>'
      }
    }
  ];

  const result = await createPresentation('My Presentation', slides);
  const presId = result.id;

  await downloadPDF(presId, 'output.pdf', 'high');
  await downloadPPTX(presId, 'output.pptx', 'high');

  console.log('Downloads complete!');
}

main();
```

---

## OpenAPI Specification

Interactive API documentation available at:

```
http://localhost:8504/docs
```

Features:
- Try out endpoints directly
- View request/response schemas
- Download OpenAPI JSON spec
- Swagger UI interface

---

## Support & Contact

- **Documentation**: `/docs/` directory
- **Interactive Docs**: `http://localhost:8504/docs`
- **GitHub**: https://github.com/Pramod-Potti-Krishnan/deck-builder-7.5
- **Issues**: Create a GitHub issue

---

## Changelog

### v7.5.0 (2025-01-09)

**Added**:
- ✨ PDF download endpoint with quality settings
- ✨ PPTX download endpoint with aspect ratio options
- ✨ Screenshot-based export with perfect visual fidelity
- 📚 Comprehensive API documentation

**Improved**:
- 🚀 Configurable port via PORT environment variable
- 🎨 Enhanced L29 hero content centering

**Fixed**:
- 🐛 System indicator badge removed from viewer

---

## License

Internal use only - Deckster project

---

**Ready to build amazing presentations!** 🚀

For detailed content generation guidelines, see [CONTENT_GENERATION_GUIDE.md](CONTENT_GENERATION_GUIDE.md).
