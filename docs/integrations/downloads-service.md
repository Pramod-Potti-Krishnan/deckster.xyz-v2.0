# v7.5 Downloads Service - Frontend Integration Guide

**Service URL**: `https://web-production-4908a.up.railway.app`

This guide shows how to integrate the v7.5 Downloads Service into your frontend application (React, Next.js, Vue, etc.) to enable PDF and PPTX downloads.

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [API Endpoints](#api-endpoints)
3. [Request Examples](#request-examples)
4. [Response Handling](#response-handling)
5. [Error Handling](#error-handling)
6. [Frontend Integration Patterns](#frontend-integration-patterns)
7. [Best Practices](#best-practices)

---

## Quick Start

### Install Dependencies
```bash
# If using fetch (built-in)
# No installation needed

# Or using axios
npm install axios
```

### Basic Usage
```typescript
// Download PDF
const response = await fetch('https://web-production-4908a.up.railway.app/convert/pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    presentation_url: 'https://v75-main.railway.app/p/abc123',
    quality: 'high'
  })
});

const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'presentation.pdf';
a.click();
```

---

## API Endpoints

### 1. Health Check
**GET** `/health`

Check if the service is operational.

**Response:**
```json
{
  "status": "healthy",
  "playwright": "ready",
  "converters": {
    "pdf": "operational",
    "pptx": "operational"
  }
}
```

### 2. Service Info
**GET** `/`

Get service information and available endpoints.

**Response:**
```json
{
  "service": "v7.5 Download Service",
  "version": "1.0.0",
  "status": "operational",
  "capabilities": ["pdf", "pptx"],
  "endpoints": {
    "health": "GET /health",
    "convert_pdf": "POST /convert/pdf",
    "convert_pptx": "POST /convert/pptx"
  }
}
```

### 3. Convert to PDF
**POST** `/convert/pdf`

Convert a presentation to PDF format.

**Request Body:**
```typescript
interface PDFConversionRequest {
  presentation_url: string;        // Required: Full URL to presentation
  landscape?: boolean;             // Optional: Use landscape orientation (default: true)
  print_background?: boolean;      // Optional: Include backgrounds (default: true)
  quality?: 'high' | 'medium' | 'low';  // Optional: Quality level (default: 'high')
}
```

**Example:**
```json
{
  "presentation_url": "https://v75-main.railway.app/p/abc123",
  "landscape": true,
  "print_background": true,
  "quality": "high"
}
```

**Response:**
- **Content-Type**: `application/pdf`
- **Content-Disposition**: `attachment; filename="presentation-{id}.pdf"`
- **Body**: PDF file bytes

**Quality Settings:**
- `high`: Full resolution (1920×1080), larger file size
- `medium`: Good quality (85% scale), balanced
- `low`: Compressed (70% scale), smaller file size

### 4. Convert to PPTX
**POST** `/convert/pptx`

Convert a presentation to PowerPoint format.

**Request Body:**
```typescript
interface PPTXConversionRequest {
  presentation_url: string;        // Required: Full URL to presentation
  slide_count: number;             // Required: Number of slides (must be > 0)
  aspect_ratio?: '16:9' | '4:3';   // Optional: Slide aspect ratio (default: '16:9')
  quality?: 'high' | 'medium' | 'low';  // Optional: Image quality (default: 'high')
}
```

**Example:**
```json
{
  "presentation_url": "https://v75-main.railway.app/p/abc123",
  "slide_count": 7,
  "aspect_ratio": "16:9",
  "quality": "high"
}
```

**Response:**
- **Content-Type**: `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- **Content-Disposition**: `attachment; filename="presentation-{id}.pptx"`
- **Body**: PPTX file bytes

**Quality Settings:**
- `high`: 1920×1080 screenshots (~3-5MB per deck)
- `medium`: 1440×810 screenshots (~2-3MB per deck)
- `low`: 960×540 screenshots (~1-2MB per deck)

---

## Request Examples

### Using Fetch API (JavaScript/TypeScript)

#### PDF Download
```typescript
async function downloadPDF(presentationUrl: string) {
  try {
    const response = await fetch('https://web-production-4908a.up.railway.app/convert/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        presentation_url: presentationUrl,
        quality: 'high',
        landscape: true,
        print_background: true
      })
    });

    if (!response.ok) {
      throw new Error(`PDF conversion failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presentation.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Cleanup
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error('PDF download failed:', error);
    return { success: false, error: error.message };
  }
}

// Usage
await downloadPDF('https://v75-main.railway.app/p/abc123');
```

#### PPTX Download
```typescript
async function downloadPPTX(presentationUrl: string, slideCount: number) {
  try {
    const response = await fetch('https://web-production-4908a.up.railway.app/convert/pptx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        presentation_url: presentationUrl,
        slide_count: slideCount,
        aspect_ratio: '16:9',
        quality: 'high'
      })
    });

    if (!response.ok) {
      throw new Error(`PPTX conversion failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presentation.pptx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Cleanup
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error('PPTX download failed:', error);
    return { success: false, error: error.message };
  }
}

// Usage
await downloadPPTX('https://v75-main.railway.app/p/abc123', 7);
```

### Using Axios

```typescript
import axios from 'axios';

async function downloadPDFWithAxios(presentationUrl: string) {
  try {
    const response = await axios.post(
      'https://web-production-4908a.up.railway.app/convert/pdf',
      {
        presentation_url: presentationUrl,
        quality: 'high'
      },
      {
        responseType: 'blob',  // Important: Tell axios to expect binary data
        timeout: 60000  // 60 second timeout
      }
    );

    // Create download link
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presentation.pdf';
    a.click();
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error('Download failed:', error);
    return { success: false, error: error.message };
  }
}
```

---

## Response Handling

### Progress Tracking

Since conversions can take 5-15 seconds, show loading state:

```typescript
import { useState } from 'react';

function DownloadButton({ presentationUrl, slideCount }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const handleDownload = async (format: 'pdf' | 'pptx') => {
    setLoading(true);
    setProgress(`Converting to ${format.toUpperCase()}...`);

    try {
      if (format === 'pdf') {
        await downloadPDF(presentationUrl);
      } else {
        await downloadPPTX(presentationUrl, slideCount);
      }
      setProgress('Download complete!');
    } catch (error) {
      setProgress(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={() => handleDownload('pdf')} disabled={loading}>
        Download PDF
      </button>
      <button onClick={() => handleDownload('pptx')} disabled={loading}>
        Download PPTX
      </button>
      {loading && <p>{progress}</p>}
    </div>
  );
}
```

### File Size Estimation

Estimate download size before conversion:

```typescript
function estimateFileSize(slideCount: number, format: 'pdf' | 'pptx', quality: string) {
  const sizePerSlide = {
    pdf: {
      high: 600,    // ~600KB per slide
      medium: 400,
      low: 300
    },
    pptx: {
      high: 500,    // ~500KB per slide
      medium: 350,
      low: 200
    }
  };

  const totalKB = slideCount * sizePerSlide[format][quality];
  const totalMB = (totalKB / 1024).toFixed(1);

  return `~${totalMB} MB`;
}

// Usage
console.log(estimateFileSize(10, 'pdf', 'high'));  // "~5.9 MB"
```

---

## Error Handling

### Error Response Format

When an error occurs, the API returns:

```json
{
  "detail": "PDF conversion failed: Failed to load presentation: abc123"
}
```

### HTTP Status Codes

- **200 OK**: Success, file returned
- **422 Unprocessable Entity**: Invalid request parameters
- **500 Internal Server Error**: Conversion failed
- **503 Service Unavailable**: Playwright not ready

### Comprehensive Error Handling

```typescript
async function downloadWithErrorHandling(
  presentationUrl: string,
  format: 'pdf' | 'pptx',
  slideCount?: number
) {
  try {
    const endpoint = format === 'pdf' ? '/convert/pdf' : '/convert/pptx';
    const body = format === 'pdf'
      ? { presentation_url: presentationUrl, quality: 'high' }
      : { presentation_url: presentationUrl, slide_count: slideCount, quality: 'high' };

    const response = await fetch(`https://web-production-4908a.up.railway.app${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      // Parse error response
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || response.statusText;

      // Handle specific error codes
      switch (response.status) {
        case 422:
          throw new Error(`Invalid request: ${errorMessage}`);
        case 500:
          throw new Error(`Conversion failed: ${errorMessage}`);
        case 503:
          throw new Error('Service temporarily unavailable. Please try again.');
        default:
          throw new Error(`Download failed: ${errorMessage}`);
      }
    }

    // Success - handle file download
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presentation.${format}`;
    a.click();
    URL.revokeObjectURL(url);

    return { success: true };

  } catch (error) {
    console.error(`${format.toUpperCase()} download error:`, error);

    // User-friendly error messages
    let userMessage = 'Download failed. Please try again.';

    if (error.message.includes('Failed to load presentation')) {
      userMessage = 'Presentation not found. Please check the URL.';
    } else if (error.message.includes('network')) {
      userMessage = 'Network error. Please check your connection.';
    }

    return { success: false, error: userMessage };
  }
}
```

---

## Frontend Integration Patterns

### React Component Example

```typescript
import React, { useState } from 'react';

interface DownloadServiceProps {
  presentationId: string;
  presentationUrl: string;
  slideCount: number;
}

export function DownloadService({
  presentationId,
  presentationUrl,
  slideCount
}: DownloadServiceProps) {
  const [loading, setLoading] = useState<'pdf' | 'pptx' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (format: 'pdf' | 'pptx') => {
    setLoading(format);
    setError(null);

    const endpoint = format === 'pdf' ? '/convert/pdf' : '/convert/pptx';
    const body = format === 'pdf'
      ? { presentation_url: presentationUrl, quality: 'high' }
      : { presentation_url: presentationUrl, slide_count: slideCount, quality: 'high' };

    try {
      const response = await fetch(
        `https://web-production-4908a.up.railway.app${endpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Download failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${presentationId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="download-service">
      <h3>Download Presentation</h3>

      <div className="download-buttons">
        <button
          onClick={() => handleDownload('pdf')}
          disabled={loading !== null}
        >
          {loading === 'pdf' ? 'Converting...' : 'Download PDF'}
        </button>

        <button
          onClick={() => handleDownload('pptx')}
          disabled={loading !== null}
        >
          {loading === 'pptx' ? 'Converting...' : 'Download PPTX'}
        </button>
      </div>

      {loading && (
        <div className="loading">
          Converting to {loading.toUpperCase()}...
          <div className="spinner" />
        </div>
      )}

      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}
    </div>
  );
}
```

### Next.js API Route (Server-Side Proxy)

If you want to hide the download service URL or add authentication:

```typescript
// pages/api/download/[format].ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { format } = req.query;
  const { presentation_url, slide_count, quality } = req.body;

  // Optional: Add authentication check here
  // const user = await validateAuth(req);
  // if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const endpoint = format === 'pdf' ? '/convert/pdf' : '/convert/pptx';
    const body = format === 'pdf'
      ? { presentation_url, quality: quality || 'high' }
      : { presentation_url, slide_count, quality: quality || 'high' };

    const response = await fetch(
      `https://web-production-4908a.up.railway.app${endpoint}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    // Stream the file back to client
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type');
    const contentDisposition = response.headers.get('content-disposition');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', contentDisposition);
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Download proxy error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
}

// Client-side usage:
// await fetch('/api/download/pdf', {
//   method: 'POST',
//   body: JSON.stringify({ presentation_url, quality: 'high' })
// });
```

### Vue 3 Composition API Example

```typescript
<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  presentationUrl: string;
  slideCount: number;
}

const props = defineProps<Props>();
const loading = ref<'pdf' | 'pptx' | null>(null);
const error = ref<string | null>(null);

async function downloadFile(format: 'pdf' | 'pptx') {
  loading.value = format;
  error.value = null;

  const endpoint = format === 'pdf' ? '/convert/pdf' : '/convert/pptx';
  const body = format === 'pdf'
    ? { presentation_url: props.presentationUrl, quality: 'high' }
    : {
        presentation_url: props.presentationUrl,
        slide_count: props.slideCount,
        quality: 'high'
      };

  try {
    const response = await fetch(
      `https://web-production-4908a.up.railway.app${endpoint}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Download failed');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presentation.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = null;
  }
}
</script>

<template>
  <div class="download-buttons">
    <button @click="downloadFile('pdf')" :disabled="loading !== null">
      {{ loading === 'pdf' ? 'Converting...' : 'Download PDF' }}
    </button>
    <button @click="downloadFile('pptx')" :disabled="loading !== null">
      {{ loading === 'pptx' ? 'Converting...' : 'Download PPTX' }}
    </button>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>
```

---

## Best Practices

### 1. **Timeout Configuration**
Conversions can take 5-15 seconds. Set appropriate timeouts:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

try {
  const response = await fetch(url, {
    signal: controller.signal,
    // ... other options
  });
} finally {
  clearTimeout(timeoutId);
}
```

### 2. **Quality Selection**
Offer users quality options based on use case:

```typescript
const qualityOptions = {
  high: {
    label: 'High Quality',
    description: 'Best for printing (larger file)',
    recommended: 'Print'
  },
  medium: {
    label: 'Medium Quality',
    description: 'Balanced size and quality',
    recommended: 'Email'
  },
  low: {
    label: 'Low Quality',
    description: 'Smallest file size',
    recommended: 'Quick preview'
  }
};
```

### 3. **Prevent Multiple Simultaneous Downloads**
```typescript
let downloadInProgress = false;

async function safeDownload(format: 'pdf' | 'pptx') {
  if (downloadInProgress) {
    alert('Please wait for the current download to complete');
    return;
  }

  downloadInProgress = true;
  try {
    await downloadFile(format);
  } finally {
    downloadInProgress = false;
  }
}
```

### 4. **CORS Considerations**
The service has CORS enabled for all origins (`*`). For production, you may want to:
- Configure specific allowed origins in Railway environment
- Use server-side proxy (Next.js API route example above)

### 5. **Analytics Tracking**
Track download events:

```typescript
async function downloadWithTracking(format: 'pdf' | 'pptx') {
  // Track start
  analytics.track('Download Started', { format, quality: 'high' });

  const startTime = Date.now();

  try {
    await downloadFile(format);

    // Track success
    analytics.track('Download Completed', {
      format,
      duration: Date.now() - startTime
    });
  } catch (error) {
    // Track failure
    analytics.track('Download Failed', {
      format,
      error: error.message
    });
  }
}
```

### 6. **User Feedback**
Always show loading state with estimated time:

```typescript
function LoadingIndicator({ format }: { format: 'pdf' | 'pptx' }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const estimatedTime = format === 'pdf' ? '5-10' : '10-15';

  return (
    <div>
      <Spinner />
      <p>Converting to {format.toUpperCase()}...</p>
      <p>Elapsed: {elapsed}s (estimated: {estimatedTime}s)</p>
    </div>
  );
}
```

---

## Testing

### Test Health Check
```bash
curl https://web-production-4908a.up.railway.app/health
```

### Test PDF Conversion
```bash
curl -X POST https://web-production-4908a.up.railway.app/convert/pdf \
  -H "Content-Type: application/json" \
  -d '{
    "presentation_url": "https://v75-main.railway.app/p/test-id",
    "quality": "high"
  }' \
  -o test.pdf
```

### Test PPTX Conversion
```bash
curl -X POST https://web-production-4908a.up.railway.app/convert/pptx \
  -H "Content-Type: application/json" \
  -d '{
    "presentation_url": "https://v75-main.railway.app/p/test-id",
    "slide_count": 5,
    "quality": "high"
  }' \
  -o test.pptx
```

---

## Support

**Service URL**: https://web-production-4908a.up.railway.app
**API Documentation**: https://web-production-4908a.up.railway.app/docs (FastAPI auto-generated)

For issues or questions, contact the development team.
