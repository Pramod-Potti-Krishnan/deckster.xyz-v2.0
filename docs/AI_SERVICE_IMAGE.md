# AI Service: Image

This document specifies the Image AI Service requirements for generating AI images within presentations. The service uses generative AI models to create images based on user prompts with style and aspect ratio controls.

---

## Service Overview

The Image Service generates AI images using various models and providers:

| Feature | Description |
|---------|-------------|
| **Styles** | 5 visual styles: realistic, illustration, abstract, minimal, photo |
| **Aspect Ratios** | 5 presets: 16:9, 4:3, 1:1, 9:16, custom |
| **Providers** | DALL-E 3, Stable Diffusion, Midjourney API |
| **Output** | High-resolution images optimized for presentations |

---

## Service Endpoints

### Base URL
```
POST /api/ai/image/*
```

---

## Image Generation

### 1. Generate Image

```
POST /api/ai/image/generate
```

#### Request Schema

```typescript
interface ImageGenerateRequest {
  // Required
  prompt: string                    // Description of desired image
  presentationId: string
  slideId: string
  elementId: string

  // Context
  context: {
    presentationTitle: string
    presentationTheme?: string
    slideTitle?: string
    slideIndex: number
    brandColors?: string[]          // For style consistency
    existingImages?: string[]       // URLs of other images in deck
  }

  // Image configuration
  config: {
    style: ImageStyle               // Visual style
    aspectRatio: AspectRatio        // Dimensions
    quality: ImageQuality           // Resolution tier
  }

  // Element constraints
  constraints: {
    gridWidth: number               // Element width in grid units (1-12)
    gridHeight: number              // Element height in grid units (1-8)
  }

  // Advanced options
  options?: {
    negativePrompt?: string         // What to avoid
    seed?: number                   // For reproducibility
    guidanceScale?: number          // Prompt adherence (1-20)
    provider?: ImageProvider        // Specific AI provider
    colorScheme?: 'warm' | 'cool' | 'neutral' | 'vibrant'
    lighting?: 'natural' | 'studio' | 'dramatic' | 'soft'
  }
}

type ImageStyle =
  | 'realistic'     // Photorealistic imagery
  | 'illustration'  // Digital art / illustration style
  | 'abstract'      // Abstract, artistic interpretation
  | 'minimal'       // Clean, minimalist design
  | 'photo'         // Stock photo style

type AspectRatio =
  | '16:9'          // Widescreen (1920x1080)
  | '4:3'           // Standard (1600x1200)
  | '1:1'           // Square (1024x1024)
  | '9:16'          // Portrait/vertical (1080x1920)
  | 'custom'        // Custom dimensions

type ImageQuality =
  | 'draft'         // Fast, lower quality (512px)
  | 'standard'      // Balanced (1024px)
  | 'high'          // High quality (1536px)
  | 'ultra'         // Maximum quality (2048px+)

type ImageProvider =
  | 'dalle3'        // OpenAI DALL-E 3
  | 'sdxl'          // Stable Diffusion XL
  | 'midjourney'    // Midjourney via API
  | 'auto'          // Best available provider
```

#### Response Schema

```typescript
interface ImageGenerateResponse {
  success: boolean
  data?: {
    generationId: string            // UUID for tracking/regeneration

    // Generated images
    images: GeneratedImage[]

    // Generation metadata
    metadata: {
      prompt: string                // Final prompt sent to model
      style: ImageStyle
      aspectRatio: AspectRatio
      dimensions: {
        width: number
        height: number
      }
      provider: ImageProvider
      model: string                 // Specific model version
      seed: number
      generationTime: number        // Milliseconds
    }

    // Usage info
    usage: {
      creditsUsed: number
      creditsRemaining: number
    }
  }
  error?: {
    code: ImageErrorCode
    message: string
    retryable: boolean
    contentPolicyViolation?: boolean
  }
}

interface GeneratedImage {
  id: string
  url: string                       // CDN URL to full image
  thumbnailUrl: string              // Smaller preview (256px)
  width: number
  height: number
  format: 'png' | 'jpeg' | 'webp'
  sizeBytes: number
  expiresAt?: string                // URL expiration (if temporary)
}

type ImageErrorCode =
  | 'INVALID_PROMPT'
  | 'CONTENT_POLICY'
  | 'GENERATION_FAILED'
  | 'PROVIDER_UNAVAILABLE'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'INVALID_DIMENSIONS'
  | 'SERVICE_UNAVAILABLE'
```

---

## Image Styles

### Style Definitions

```typescript
const STYLE_DEFINITIONS: Record<ImageStyle, StyleConfig> = {
  realistic: {
    name: 'Realistic',
    description: 'Photorealistic imagery with natural lighting and textures',
    promptModifiers: [
      'photorealistic',
      'highly detailed',
      'professional photography',
      'natural lighting'
    ],
    negativePrompts: [
      'cartoon',
      'illustration',
      'anime',
      'drawing',
      'artistic'
    ],
    bestProviders: ['dalle3', 'sdxl'],
    guidanceScale: 7.5
  },

  illustration: {
    name: 'Illustration',
    description: 'Digital art and illustration style',
    promptModifiers: [
      'digital illustration',
      'vector art style',
      'clean lines',
      'vibrant colors'
    ],
    negativePrompts: [
      'photograph',
      'realistic',
      'photo',
      '3d render'
    ],
    bestProviders: ['midjourney', 'sdxl'],
    guidanceScale: 8.0
  },

  abstract: {
    name: 'Abstract',
    description: 'Artistic, abstract interpretation of concepts',
    promptModifiers: [
      'abstract art',
      'artistic interpretation',
      'creative visualization',
      'conceptual art'
    ],
    negativePrompts: [
      'realistic',
      'photograph',
      'detailed'
    ],
    bestProviders: ['midjourney', 'dalle3'],
    guidanceScale: 6.0
  },

  minimal: {
    name: 'Minimal',
    description: 'Clean, minimalist design with simple shapes',
    promptModifiers: [
      'minimalist design',
      'simple shapes',
      'clean composition',
      'negative space',
      'flat design'
    ],
    negativePrompts: [
      'complex',
      'detailed',
      'busy',
      'cluttered',
      'realistic'
    ],
    bestProviders: ['dalle3', 'sdxl'],
    guidanceScale: 9.0
  },

  photo: {
    name: 'Photo',
    description: 'Stock photography style for business presentations',
    promptModifiers: [
      'professional stock photo',
      'business photography',
      'clean background',
      'high quality',
      'commercial photography'
    ],
    negativePrompts: [
      'amateur',
      'low quality',
      'blurry',
      'artistic',
      'illustration'
    ],
    bestProviders: ['dalle3', 'sdxl'],
    guidanceScale: 7.0
  }
}

interface StyleConfig {
  name: string
  description: string
  promptModifiers: string[]
  negativePrompts: string[]
  bestProviders: ImageProvider[]
  guidanceScale: number
}
```

---

## Aspect Ratio Configuration

### Dimension Calculations

```typescript
const ASPECT_RATIOS: Record<AspectRatio, AspectRatioConfig> = {
  '16:9': {
    ratio: 16 / 9,
    dimensions: {
      draft: { width: 896, height: 504 },
      standard: { width: 1792, height: 1008 },
      high: { width: 2560, height: 1440 },
      ultra: { width: 3840, height: 2160 }
    },
    useCases: ['Slide backgrounds', 'Wide images', 'Video thumbnails']
  },

  '4:3': {
    ratio: 4 / 3,
    dimensions: {
      draft: { width: 768, height: 576 },
      standard: { width: 1536, height: 1152 },
      high: { width: 2048, height: 1536 },
      ultra: { width: 3072, height: 2304 }
    },
    useCases: ['Standard images', 'Document images', 'Classic format']
  },

  '1:1': {
    ratio: 1,
    dimensions: {
      draft: { width: 512, height: 512 },
      standard: { width: 1024, height: 1024 },
      high: { width: 1536, height: 1536 },
      ultra: { width: 2048, height: 2048 }
    },
    useCases: ['Icons', 'Profile images', 'Centered graphics']
  },

  '9:16': {
    ratio: 9 / 16,
    dimensions: {
      draft: { width: 504, height: 896 },
      standard: { width: 1008, height: 1792 },
      high: { width: 1440, height: 2560 },
      ultra: { width: 2160, height: 3840 }
    },
    useCases: ['Portrait images', 'Mobile-first', 'Vertical banners']
  },

  'custom': {
    ratio: null,  // Calculated from grid dimensions
    dimensions: null,
    useCases: ['Custom element sizes', 'Specific requirements']
  }
}

interface AspectRatioConfig {
  ratio: number | null
  dimensions: Record<ImageQuality, { width: number, height: number }> | null
  useCases: string[]
}

// Calculate custom dimensions from grid size
function calculateCustomDimensions(
  gridWidth: number,
  gridHeight: number,
  quality: ImageQuality
): { width: number, height: number } {
  const gridRatio = gridWidth / gridHeight

  // Base resolution for quality tier
  const baseResolutions: Record<ImageQuality, number> = {
    draft: 512,
    standard: 1024,
    high: 1536,
    ultra: 2048
  }

  const baseSize = baseResolutions[quality]

  if (gridRatio >= 1) {
    // Wider than tall
    return {
      width: baseSize,
      height: Math.round(baseSize / gridRatio)
    }
  } else {
    // Taller than wide
    return {
      width: Math.round(baseSize * gridRatio),
      height: baseSize
    }
  }
}
```

---

## Prompt Engineering

### Prompt Construction

```typescript
interface PromptBuilder {
  // Build final prompt from user input and style
  buildPrompt(request: ImageGenerateRequest): string

  // Add style-specific modifiers
  addStyleModifiers(prompt: string, style: ImageStyle): string

  // Add context from presentation
  addContextModifiers(prompt: string, context: ImageContext): string

  // Build negative prompt
  buildNegativePrompt(style: ImageStyle, userNegative?: string): string
}

function buildFinalPrompt(request: ImageGenerateRequest): string {
  const style = STYLE_DEFINITIONS[request.config.style]

  let prompt = request.prompt

  // Add style modifiers
  prompt = `${prompt}, ${style.promptModifiers.join(', ')}`

  // Add color scheme if specified
  if (request.options?.colorScheme) {
    const colorModifiers = {
      warm: 'warm color palette, golden tones',
      cool: 'cool color palette, blue tones',
      neutral: 'neutral colors, balanced tones',
      vibrant: 'vibrant colors, saturated'
    }
    prompt = `${prompt}, ${colorModifiers[request.options.colorScheme]}`
  }

  // Add lighting if specified
  if (request.options?.lighting) {
    const lightingModifiers = {
      natural: 'natural daylight, outdoor lighting',
      studio: 'studio lighting, controlled environment',
      dramatic: 'dramatic lighting, high contrast, shadows',
      soft: 'soft diffused lighting, gentle shadows'
    }
    prompt = `${prompt}, ${lightingModifiers[request.options.lighting]}`
  }

  // Add brand context
  if (request.context.brandColors?.length) {
    prompt = `${prompt}, incorporating ${request.context.brandColors.slice(0, 2).join(' and ')} color accents`
  }

  return prompt
}

function buildNegativePrompt(
  style: ImageStyle,
  userNegative?: string
): string {
  const styleNegative = STYLE_DEFINITIONS[style].negativePrompts

  // Standard negative prompts for quality
  const qualityNegative = [
    'low quality',
    'blurry',
    'distorted',
    'watermark',
    'text',
    'logo',
    'signature',
    'artifacts',
    'noise',
    'grain'
  ]

  const allNegatives = [
    ...styleNegative,
    ...qualityNegative,
    ...(userNegative ? [userNegative] : [])
  ]

  return allNegatives.join(', ')
}
```

---

## Transform Operations

### 2. Regenerate Image

```
POST /api/ai/image/regenerate
```

#### Request Schema

```typescript
interface ImageRegenerateRequest {
  presentationId: string
  slideId: string
  elementId: string
  generationId: string              // Original generation to regenerate

  // Options
  options?: {
    newSeed?: boolean               // Use new random seed
    sameStyle?: boolean             // Keep same style
    sameAspectRatio?: boolean       // Keep same dimensions
    modifiedPrompt?: string         // Optional prompt changes
  }
}
```

### 3. Upscale Image

```
POST /api/ai/image/upscale
```

#### Request Schema

```typescript
interface ImageUpscaleRequest {
  presentationId: string
  slideId: string
  elementId: string
  imageId: string

  targetQuality: ImageQuality       // Target resolution tier
  enhanceDetails?: boolean          // Add detail enhancement
  denoise?: boolean                 // Reduce noise
}
```

### 4. Edit Image (Inpainting)

```
POST /api/ai/image/edit
```

#### Request Schema

```typescript
interface ImageEditRequest {
  presentationId: string
  slideId: string
  elementId: string
  imageId: string

  // Edit specification
  edit: {
    type: 'inpaint' | 'outpaint' | 'variation'
    mask?: string                   // Base64 mask for inpainting
    prompt?: string                 // Description of edit
    strength?: number               // Edit strength (0-1)
  }
}
```

### 5. Remove Background

```
POST /api/ai/image/remove-background
```

#### Request Schema

```typescript
interface RemoveBackgroundRequest {
  presentationId: string
  slideId: string
  elementId: string
  imageId: string

  options?: {
    refineMask?: boolean            // Refine edges
    preserveShadow?: boolean        // Keep soft shadows
    outputFormat?: 'png' | 'webp'   // Transparent output format
  }
}
```

---

## Provider Configuration

### Provider-Specific Settings

```typescript
interface ProviderConfig {
  name: ImageProvider
  endpoint: string
  models: ProviderModel[]
  capabilities: ProviderCapabilities
  pricing: ProviderPricing
  limits: ProviderLimits
}

interface ProviderModel {
  id: string
  name: string
  version: string
  maxDimension: number
  supportedStyles: ImageStyle[]
  costMultiplier: number
}

interface ProviderCapabilities {
  inpainting: boolean
  outpainting: boolean
  upscaling: boolean
  variations: boolean
  backgroundRemoval: boolean
  batchGeneration: boolean
}

interface ProviderPricing {
  baseCreditsPerImage: number
  qualityMultiplier: Record<ImageQuality, number>
}

interface ProviderLimits {
  maxConcurrent: number
  maxDimension: number
  maxPromptLength: number
  timeoutMs: number
}

const PROVIDERS: Record<ImageProvider, ProviderConfig> = {
  dalle3: {
    name: 'dalle3',
    endpoint: 'https://api.openai.com/v1/images/generations',
    models: [
      {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        version: '3.0',
        maxDimension: 1792,
        supportedStyles: ['realistic', 'illustration', 'abstract', 'minimal', 'photo'],
        costMultiplier: 1.0
      }
    ],
    capabilities: {
      inpainting: false,
      outpainting: false,
      upscaling: false,
      variations: true,
      backgroundRemoval: false,
      batchGeneration: false
    },
    pricing: {
      baseCreditsPerImage: 1,
      qualityMultiplier: {
        draft: 0.5,
        standard: 1.0,
        high: 1.5,
        ultra: 2.0
      }
    },
    limits: {
      maxConcurrent: 5,
      maxDimension: 1792,
      maxPromptLength: 4000,
      timeoutMs: 60000
    }
  },

  sdxl: {
    name: 'sdxl',
    endpoint: 'https://api.stability.ai/v1/generation',
    models: [
      {
        id: 'stable-diffusion-xl-1024-v1-0',
        name: 'Stable Diffusion XL',
        version: '1.0',
        maxDimension: 1024,
        supportedStyles: ['realistic', 'illustration', 'abstract', 'minimal', 'photo'],
        costMultiplier: 0.8
      }
    ],
    capabilities: {
      inpainting: true,
      outpainting: true,
      upscaling: true,
      variations: true,
      backgroundRemoval: false,
      batchGeneration: true
    },
    pricing: {
      baseCreditsPerImage: 0.8,
      qualityMultiplier: {
        draft: 0.3,
        standard: 0.8,
        high: 1.2,
        ultra: 1.8
      }
    },
    limits: {
      maxConcurrent: 10,
      maxDimension: 1536,
      maxPromptLength: 2000,
      timeoutMs: 45000
    }
  },

  midjourney: {
    name: 'midjourney',
    endpoint: 'https://api.midjourney.com/v1/imagine',
    models: [
      {
        id: 'midjourney-v6',
        name: 'Midjourney v6',
        version: '6.0',
        maxDimension: 2048,
        supportedStyles: ['illustration', 'abstract', 'minimal'],
        costMultiplier: 1.2
      }
    ],
    capabilities: {
      inpainting: false,
      outpainting: false,
      upscaling: true,
      variations: true,
      backgroundRemoval: false,
      batchGeneration: false
    },
    pricing: {
      baseCreditsPerImage: 1.2,
      qualityMultiplier: {
        draft: 0.5,
        standard: 1.0,
        high: 1.5,
        ultra: 2.5
      }
    },
    limits: {
      maxConcurrent: 3,
      maxDimension: 2048,
      maxPromptLength: 1500,
      timeoutMs: 120000
    }
  }
}
```

---

## Content Policy

### Safety Checks

```typescript
interface ContentPolicyCheck {
  // Check prompt before generation
  preCheck: {
    prohibited: string[]            // Banned terms
    flagged: string[]               // Terms that trigger review
    categories: ProhibitedCategory[]
  }

  // Check generated image
  postCheck: {
    nsfwDetection: boolean
    violenceDetection: boolean
    copyrightDetection: boolean
    watermarkDetection: boolean
  }
}

type ProhibitedCategory =
  | 'adult_content'
  | 'violence'
  | 'hate_speech'
  | 'illegal_activity'
  | 'personal_info'
  | 'copyrighted_content'
  | 'political_content'
  | 'celebrity_likeness'

const CONTENT_POLICY: ContentPolicyCheck = {
  preCheck: {
    prohibited: [
      // List of prohibited terms
    ],
    flagged: [
      // Terms that trigger manual review
    ],
    categories: [
      'adult_content',
      'violence',
      'hate_speech',
      'illegal_activity',
      'celebrity_likeness'
    ]
  },
  postCheck: {
    nsfwDetection: true,
    violenceDetection: true,
    copyrightDetection: true,
    watermarkDetection: true
  }
}

// Content policy violation response
interface ContentPolicyViolation {
  violated: boolean
  categories: ProhibitedCategory[]
  message: string
  suggestion?: string
}
```

---

## Image Storage

### Storage Configuration

```typescript
interface StorageConfig {
  // Primary storage (CDN)
  primary: {
    provider: 'cloudflare' | 'aws' | 'gcp'
    bucket: string
    region: string
    cdnDomain: string
  }

  // Image optimization
  optimization: {
    formats: ('webp' | 'avif' | 'jpeg' | 'png')[]
    qualityLevels: number[]         // e.g., [80, 60, 40]
    generateThumbnails: boolean
    thumbnailSizes: number[]        // e.g., [128, 256, 512]
  }

  // Retention
  retention: {
    generatedImages: number         // Days to keep (30)
    thumbnails: number              // Days to keep (90)
    orphanedImages: number          // Days before cleanup (7)
  }
}

// Image URL structure
interface ImageUrls {
  original: string                  // Full resolution
  optimized: string                 // WebP/AVIF version
  thumbnail: string                 // 256px preview
  placeholder: string               // Tiny blur placeholder
}

function getImageUrls(
  generationId: string,
  imageId: string
): ImageUrls {
  const basePath = `images/${generationId}/${imageId}`

  return {
    original: `https://cdn.example.com/${basePath}/original.png`,
    optimized: `https://cdn.example.com/${basePath}/optimized.webp`,
    thumbnail: `https://cdn.example.com/${basePath}/thumb-256.webp`,
    placeholder: `https://cdn.example.com/${basePath}/placeholder.webp`
  }
}
```

---

## Progress Updates

### WebSocket Progress Events

For long-running image generation, send progress updates:

```typescript
interface ImageProgressEvent {
  type: 'IMAGE_GENERATION_PROGRESS'
  data: {
    generationId: string
    elementId: string
    status: ImageGenerationStatus
    progress: number                // 0-100
    stage: ImageGenerationStage
    estimatedTimeRemaining?: number // Seconds
    preview?: string                // Partial preview URL
  }
}

type ImageGenerationStatus =
  | 'queued'
  | 'processing'
  | 'generating'
  | 'post_processing'
  | 'uploading'
  | 'complete'
  | 'failed'

type ImageGenerationStage =
  | 'prompt_processing'
  | 'model_inference'
  | 'upscaling'
  | 'optimization'
  | 'storage'

// Progress timeline example
const PROGRESS_TIMELINE = {
  queued: { progress: 0, stage: 'prompt_processing' },
  prompt_processed: { progress: 10, stage: 'prompt_processing' },
  generation_started: { progress: 20, stage: 'model_inference' },
  generation_50: { progress: 50, stage: 'model_inference' },
  generation_complete: { progress: 70, stage: 'model_inference' },
  post_processing: { progress: 80, stage: 'optimization' },
  uploading: { progress: 90, stage: 'storage' },
  complete: { progress: 100, stage: 'storage' }
}
```

---

## Rate Limiting

```typescript
const RATE_LIMITS = {
  generate: {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    requestsPerDay: 500
  },
  regenerate: {
    requestsPerMinute: 15,
    requestsPerHour: 150
  },
  transform: {
    requestsPerMinute: 20,
    requestsPerHour: 200
  }
}

// Quality-based credit costs
const CREDIT_COSTS: Record<ImageQuality, number> = {
  draft: 0.5,
  standard: 1.0,
  high: 2.0,
  ultra: 4.0
}
```

---

## Integration with Layout Service

### Orchestration Flow

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Frontend   │────▶│  Layout Service  │────▶│   Image AI       │
│   Panel      │     │  Orchestrator    │     │    Service       │
└──────────────┘     └──────────────────┘     └──────────────────┘
       │                      │                        │
       │  1. User prompt      │                        │
       │  2. Style selection  │                        │
       │  3. Aspect ratio     │                        │
       │                      │  4. Add context        │
       │                      │  5. Calculate size     │
       │                      │  6. Select provider    │
       │                      │                        │
       │                      │────────────────────────▶
       │                      │  7. Generate request   │
       │                      │                        │
       │◀─────────────────────│  8. Progress events   │
       │  (WebSocket)         │     (forwarded)        │
       │                      │                        │
       │                      │◀────────────────────────
       │                      │  9. Image URLs        │
       │                      │                        │
       │◀─────────────────────│ 10. Update element   │
       │ 11. Display image    │                        │
```

### Layout Service Responsibilities

1. **Calculate Optimal Size**: Based on grid dimensions
2. **Select Best Provider**: Based on style and availability
3. **Forward Progress Events**: Stream to frontend
4. **Store Image References**: Save URLs in element content
5. **Handle Caching**: Cache generated images
6. **Export Support**: Ensure high-res for PDF export

---

## Error Handling

### Error Responses

```typescript
interface ImageError {
  code: ImageErrorCode
  message: string
  details?: {
    provider?: string
    reason?: string
    suggestion?: string
    contentPolicy?: ContentPolicyViolation
  }
  retryable: boolean
  retryAfter?: number               // Seconds
}

const ERROR_EXAMPLES = {
  CONTENT_POLICY: {
    code: 'CONTENT_POLICY',
    message: 'Image generation blocked by content policy',
    details: {
      contentPolicy: {
        violated: true,
        categories: ['celebrity_likeness'],
        message: 'Cannot generate images of real people',
        suggestion: 'Try describing a fictional character instead'
      }
    },
    retryable: false
  },

  QUOTA_EXCEEDED: {
    code: 'QUOTA_EXCEEDED',
    message: 'Image generation quota exceeded',
    details: {
      reason: 'Daily limit of 500 images reached',
      suggestion: 'Quota resets at midnight UTC'
    },
    retryable: false,
    retryAfter: 28800  // 8 hours
  },

  PROVIDER_UNAVAILABLE: {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'Image generation provider temporarily unavailable',
    details: {
      provider: 'dalle3',
      reason: 'Provider API timeout',
      suggestion: 'Trying alternative provider'
    },
    retryable: true,
    retryAfter: 30
  }
}
```

---

## Implementation Notes

### Performance Optimization

```typescript
const PERFORMANCE_CONFIG = {
  // Parallel generation
  maxConcurrentGenerations: 3,

  // Queue management
  queuePriority: {
    interactive: 1,                 // User waiting
    background: 2,                  // Batch operations
    prefetch: 3                     // Predictive generation
  },

  // Caching
  promptCacheTTL: 3600,             // 1 hour
  imageCacheTTL: 86400 * 30,        // 30 days

  // Timeouts
  generationTimeout: 60000,         // 60 seconds
  uploadTimeout: 30000              // 30 seconds
}
```

### Fallback Strategy

```typescript
// Provider fallback order
const FALLBACK_ORDER: ImageProvider[] = [
  'dalle3',
  'sdxl',
  'midjourney'
]

async function generateWithFallback(
  request: ImageGenerateRequest
): Promise<ImageGenerateResponse> {
  for (const provider of FALLBACK_ORDER) {
    try {
      return await generateImage(request, provider)
    } catch (error) {
      if (!isRetryable(error)) throw error
      continue
    }
  }
  throw new Error('All providers failed')
}
```

### Cost Tracking

```typescript
interface UsageTracking {
  userId: string
  presentationId: string

  // Per-generation tracking
  generations: {
    generationId: string
    timestamp: Date
    provider: ImageProvider
    quality: ImageQuality
    creditsUsed: number
    success: boolean
  }[]

  // Aggregates
  totalCredits: number
  remainingCredits: number
  resetDate: Date
}
```
