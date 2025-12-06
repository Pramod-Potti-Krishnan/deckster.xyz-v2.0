# Elementor Backend Integration Issues

**Date:** December 4, 2024
**Reported By:** Deckster Frontend Team
**Elementor Production URL:** `https://web-production-3b42.up.railway.app`

---

## Overview

We conducted integration testing of the Elementor API endpoints and found that **all 6 generation endpoints are failing**. The orchestrator service itself is healthy, but the backend AI services it routes to are returning errors.

---

## Issue Summary

| Backend Service | Endpoint Called by Orchestrator | Error | Status |
|-----------------|--------------------------------|-------|--------|
| Chart | `analytics-v30-production.up.railway.app/api/ai/chart/generate` | 404 Not Found | DOWN |
| Diagram | `web-production-e0ad0.up.railway.app/api/ai/diagram/generate` | 422 Unprocessable Entity | ERROR |
| Image | `web-production-1b5df.up.railway.app/api/ai/image/generate` | 422 Unprocessable Entity | ERROR |
| Infographic | `illustrator-v10-production.up.railway.app/api/ai/illustrator/generate` | 502 Bad Gateway | DOWN |
| Table | `web-production-5daf.up.railway.app/api/ai/table/generate` | 422 Unprocessable Entity | ERROR |
| Text | `web-production-5daf.up.railway.app/api/ai/text/generate` | 422 Unprocessable Entity | ERROR |

---

## Detailed Issues

### Issue 1: Chart Service - 404 Not Found

**Orchestrator Endpoint:** `POST /api/generate/chart`
**Backend URL:** `https://analytics-v30-production.up.railway.app/api/ai/chart/generate`

**Request Payload Sent:**
```json
{
  "element_id": "test-chart-001",
  "context": {
    "presentation_id": "test-pres-001",
    "presentation_title": "API Test",
    "slide_id": "test-slide-001",
    "slide_index": 0
  },
  "position": {
    "grid_row": "5 / 17",
    "grid_column": "2 / 32"
  },
  "prompt": "Quarterly sales: Q1 100k, Q2 150k, Q3 200k, Q4 250k",
  "chart_type": "bar",
  "generate_data": true
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "HTTP_404",
    "message": "Client error '404 Not Found' for url 'https://analytics-v30-production.up.railway.app/api/ai/chart/generate'"
  }
}
```

**Questions:**
1. Is the Chart service deployed at `analytics-v30-production.up.railway.app`?
2. What is the correct endpoint path for chart generation?
3. Is this service actively maintained?

---

### Issue 2: Diagram Service - 422 Unprocessable Entity

**Orchestrator Endpoint:** `POST /api/generate/diagram`
**Backend URL:** `https://web-production-e0ad0.up.railway.app/api/ai/diagram/generate`

**Request Payload Sent:**
```json
{
  "element_id": "test-diagram-001",
  "context": {
    "presentation_id": "test-pres-001",
    "presentation_title": "API Test",
    "slide_id": "test-slide-001",
    "slide_index": 0
  },
  "position": {
    "grid_row": "5 / 17",
    "grid_column": "2 / 32"
  },
  "prompt": "User login flow: Start -> Enter credentials -> Validate -> Success or Error",
  "diagram_type": "flowchart",
  "direction": "TB",
  "theme": "default",
  "complexity": "simple"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "HTTP_422",
    "message": "Client error '422 Unprocessable Entity' for url 'https://web-production-e0ad0.up.railway.app/api/ai/diagram/generate'"
  }
}
```

**Questions:**
1. What is the expected request schema for the Diagram backend?
2. Which fields are required vs optional?
3. Is there a schema mismatch between the orchestrator and backend?

---

### Issue 3: Image Service - 422 Unprocessable Entity

**Orchestrator Endpoint:** `POST /api/generate/image`
**Backend URL:** `https://web-production-1b5df.up.railway.app/api/ai/image/generate`

**Request Payload Sent:**
```json
{
  "element_id": "test-image-001",
  "context": {
    "presentation_id": "test-pres-001",
    "presentation_title": "API Test",
    "slide_id": "test-slide-001",
    "slide_index": 0
  },
  "position": {
    "grid_row": "5 / 17",
    "grid_column": "2 / 32"
  },
  "prompt": "A modern office building with glass windows at sunset",
  "style": "realistic",
  "aspect_ratio": "16:9"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "HTTP_422",
    "message": "Client error '422 Unprocessable Entity' for url 'https://web-production-1b5df.up.railway.app/api/ai/image/generate'"
  }
}
```

**Questions:**
1. What is the expected request schema for the Image backend?
2. Are there required fields missing from our request?

---

### Issue 4: Infographic Service - 502 Bad Gateway

**Orchestrator Endpoint:** `POST /api/generate/infographic`
**Backend URL:** `https://illustrator-v10-production.up.railway.app/api/ai/illustrator/generate`

**Request Payload Sent:**
```json
{
  "element_id": "test-infographic-001",
  "context": {
    "presentation_id": "test-pres-001",
    "presentation_title": "API Test",
    "slide_id": "test-slide-001",
    "slide_index": 0
  },
  "position": {
    "grid_row": "5 / 17",
    "grid_column": "2 / 32"
  },
  "prompt": "Company milestones: 2020 Founded, 2021 First Product, 2022 Series A, 2023 Global Expansion",
  "infographic_type": "timeline",
  "item_count": 4
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "HTTP_502",
    "message": "Server error '502 Bad Gateway' for url 'https://illustrator-v10-production.up.railway.app/api/ai/illustrator/generate'",
    "retryable": true
  }
}
```

**Questions:**
1. Is the Illustrator service running?
2. Can you check Railway deployment logs for crashes?

---

### Issue 5: Table Service - 422 Unprocessable Entity

**Orchestrator Endpoint:** `POST /api/generate/table`
**Backend URL:** `https://web-production-5daf.up.railway.app/api/ai/table/generate`

**Request Payload Sent:**
```json
{
  "element_id": "test-table-001",
  "context": {
    "presentation_id": "test-pres-001",
    "presentation_title": "API Test",
    "slide_id": "test-slide-001",
    "slide_index": 0
  },
  "position": {
    "grid_row": "5 / 17",
    "grid_column": "2 / 32"
  },
  "prompt": "Comparison table of AWS, Azure, GCP with pricing, regions, and features",
  "rows": 4,
  "columns": 4,
  "has_header": true,
  "table_style": "striped"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "HTTP_422",
    "message": "Client error '422 Unprocessable Entity' for url 'https://web-production-5daf.up.railway.app/api/ai/table/generate'"
  }
}
```

---

### Issue 6: Text Service - 422 Unprocessable Entity

**Orchestrator Endpoint:** `POST /api/generate/text`
**Backend URL:** `https://web-production-5daf.up.railway.app/api/ai/text/generate`

**Request Payload Sent:**
```json
{
  "element_id": "test-text-001",
  "context": {
    "presentation_id": "test-pres-001",
    "presentation_title": "API Test",
    "slide_id": "test-slide-001",
    "slide_index": 0
  },
  "position": {
    "grid_row": "5 / 17",
    "grid_column": "2 / 32"
  },
  "prompt": "Write 3 key benefits of cloud computing for enterprise businesses",
  "format": "bullets",
  "tone": "professional"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "HTTP_422",
    "message": "Client error '422 Unprocessable Entity' for url 'https://web-production-5daf.up.railway.app/api/ai/text/generate'"
  }
}
```

---

## Additional Questions

### Missing Endpoints

We expected these endpoints based on earlier discussions, but they return 404 from the orchestrator itself:

1. **`POST /api/generate/hero`** - For generating hero/title slides
2. **`POST /api/slide/background`** - For generating slide backgrounds

**Questions:**
- Are these endpoints planned for implementation?
- If not, what is the alternative approach for hero slides and backgrounds?

---

## What We Need

To unblock our frontend integration, we need:

1. **Working endpoints** - All 6 generation endpoints returning successful responses
2. **Schema documentation** - The exact request/response schemas for each backend service
3. **Error details** - For 422 errors, which specific fields are failing validation?
4. **Service status** - Confirmation that all backend services are deployed and running
5. **Timeline** - Expected timeline for fixes

---

## Working Endpoints (For Reference)

These orchestrator endpoints are working correctly:

| Endpoint | Response |
|----------|----------|
| `GET /health` | Returns healthy status |
| `GET /api/generate/chart/palettes` | Returns 5 palettes |
| `GET /api/generate/diagram/types` | Returns 11 diagram types |
| `GET /api/generate/image/styles` | Returns 5 image styles |
| `GET /api/generate/infographic/types` | Returns 14 infographic types |
| `GET /api/generate/table/presets` | Returns 6 table presets |

---

## Contact

Please reach out if you need any additional information or want to schedule a call to discuss these issues.

**Deckster Frontend Team**
