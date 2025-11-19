# Vibe Decker API Documentation - Phase 2: Conversational Strawman Generation

## Executive Summary

Vibe Decker Phase 2 provides a conversational AI interface for creating presentation strawmans (structured outlines with meta-content) through natural language interaction. Frontend applications can integrate with our WebSocket API to enable users to build presentations through chat-like conversations, receiving structured JSON data optimized for rich UI display.

## Overview

The Phase 2 API focuses on the **conversational strawman generation** workflow:
1. **Discovery Phase**: Natural conversation to understand requirements
2. **Structure Generation**: AI creates basic slide structure
3. **Enhancement**: Adds narrative purpose, engagement hooks, and visual suggestions
4. **Iterative Refinement**: Users can modify and improve through conversation

The system provides structured JSON responses that frontend applications can render in various ways while maintaining a natural conversational experience.

## Base URLs

- **Production**: `https://vibe-decker-agents-mvp10-production.up.railway.app`
- **WebSocket**: `wss://vibe-decker-agents-mvp10-production.up.railway.app`
- **Local Development**: `http://localhost:8000` / `ws://localhost:8000`

## Authentication

Currently, the API does not require authentication. Each presentation session is identified by a unique UUID.

## Key Concepts for Frontend Integration

### 1. Conversational Flow
Unlike traditional form-based APIs, Vibe Decker uses natural language processing to understand user intent. Your frontend should:
- Provide a chat-like interface for user input
- Display AI responses as conversational messages
- Show generated structures and content in dedicated UI components

### 2. Progressive Enhancement
The presentation is built progressively:
- **Phase 1**: Basic structure (slide titles and descriptions)
- **Phase 2**: Enhanced structure (adds narrative purpose, hooks, visuals)
- **Phase 3**: HTML layout generation (browser-ready HTML slides)
- **Phase 4**: Content generation (future - detailed slide content)

### 3. Structured Data Output
While the interaction is conversational, the output is highly structured JSON, allowing you to:
- Display slides in various layouts (grid, carousel, list)
- Show meta-content in organized sections
- Implement rich preview functionality

## WebSocket API - Conversational Interface

### Primary Endpoint: Interactive Conversation

**URL Pattern**: `/ws/presentations/{presentation_id}/interactive`

**Full WebSocket URL**: `wss://vibe-decker-agents-mvp10-production.up.railway.app/ws/presentations/{presentation_id}/interactive`

- `presentation_id`: UUID (generate client-side or let server assign)
- Purpose: Enables natural language conversation for presentation building

### Connection Flow

1. **Client connects** to WebSocket endpoint with a presentation ID
2. **Server sends** `connected` message with capabilities
3. **Client initiates** conversation with `start_discovery` command
4. **Natural conversation** begins - user describes their needs
5. **AI generates** structure and enhancements progressively
6. **Client displays** both chat messages and structured data

### Initial Connection

```javascript
// Connect to WebSocket
const ws = new WebSocket('wss://vibe-decker-agents-mvp10-production.up.railway.app/ws/presentations/YOUR-UUID-HERE/interactive');

// Send initial command to start conversation
ws.onopen = () => {
  ws.send(JSON.stringify({
    command_type: "start_discovery",
    command: "Start chat mode",
    context: { 
      topic: "Initial topic if known",
      chat_mode: true  // Important: enables conversational mode
    }
  }));
};
```

## Message Formats

### Client → Server Messages

#### 1. Start Discovery (Initialize Conversation)
```json
{
  "command_type": "start_discovery",
  "command": "Start chat mode",
  "context": {
    "topic": "optional initial topic",
    "chat_mode": true
  }
}
```

#### 2. Chat Message (Natural Language)
```json
{
  "type": "chat_message",
  "content": "I need a presentation about renewable energy for executives, 30 minutes long"
}
```

#### 3. Direct Command (Button/Action Triggers)
```json
{
  "command_type": "generate_html_layouts",
  "command": "Generate HTML layouts",
  "context": {
    "phase": 3,
    "presentation_id": "82ba77c9-8f17-4183-a0e6-a6da1a3ae830"
  }
}
```

The AI understands various natural language patterns:
- **Topic specification**: "I want to create a presentation about X"
- **Requirements**: "for executives", "30 minutes", "educational focus"
- **Modifications**: "add more technical details", "make it shorter"
- **Approval**: "looks good", "proceed", "continue"
- **Content requests**: "create slides", "generate content"
- **HTML generation**: "generate HTML layouts", "create web slides", "make browser-ready slides"
### Server → Client Messages

#### 1. Connected Message
Sent immediately upon WebSocket connection.
```json
{
  "type": "connected",
  "presentation_id": "82ba77c9-8f17-4183-a0e6-a6da1a3ae830",
  "timestamp": "2025-06-28T16:49:06.409Z",
  "capabilities": [
    "conversational_workflow",
    "discovery_phase",
    "structure_generation",
    "content_expansion",
    "refinement",
    "version_control",
    "real_time_preview",
    "memory_persistence",
    "chat_interface"
  ],
  "current_phase": 0,
  "workflow_mode": "conversational",
  "has_memory": false,
  "artifacts_generated": {
    "structure": false,
    "layout": false,
    "content": false,
    "structure_data": null,
    "content_data": null
  }
}
```

#### 2. Assistant Message (Chat Response)
AI's conversational responses to guide the user.
```json
{
  "type": "assistant_message",
  "content": "I'd love to help you create a presentation on renewable energy! To get started, could you tell me more about your target audience, how long the presentation should be, and what your main goals are?"
}
```

#### 3. Status Message (Loading States)
Indicates AI is processing.
```json
{
  "type": "status",
  "status": "thinking",
  "message": "Creating your presentation structure..."
}
```

#### 4. Structure Generated (Phase 2 Strawman)
The main deliverable - a complete presentation strawman with enhanced meta-content.
```json
{
  "type": "structure_generated",
  "structure": {
    "title": "Exploring the Beauty of Indian Temples",
    "total_slides": 10,
    "estimated_duration": "30 min",
    "target_audience": "family and friends",
    "presentation_goal": "education",
    "slides": [
      {
        "id": 1,
        "title": "Introduction to Indian Temples",
        "description": "Temples are integral to Indian culture, reflecting the diverse spiritual practices and community life. They act as focal points for gatherings, celebrations, and rituals, promoting a sense of belonging.",
        "narrative_purpose": "This slide sets the foundation for understanding the cultural and spiritual significance of temples in India.",
        "engagement_hook": "Did you know that temples in India serve as not just places of worship but as cultural hubs?",
        "suggested_visuals": [
          {
            "type": "image",
            "description": "Collage of different Indian temples",
            "purpose": "Showcase the diversity of temple architecture"
          },
          {
            "type": "infographic",
            "description": "Overview of temple roles in community life",
            "purpose": "Visualize the multifaceted nature of temples"
          }
        ]
      }
      // ... more slides
    ]
  },
  "phase": 2
}
```

### Strawman Structure Fields Explained

#### Top-Level Structure
- `title`: Main presentation title
- `total_slides`: Number of slides in the presentation
- `estimated_duration`: Suggested presentation length
- `target_audience`: Who the presentation is for
- `presentation_goal`: Primary objective (education, persuasion, etc.)

#### Individual Slide Fields
- `id`: Slide number (1-based)
- `title`: Slide heading
- `description`: Detailed explanation of slide content (2-4 sentences)
- `narrative_purpose`: How this slide advances the story (meta-content)
- `engagement_hook`: Question or statement to grab attention (meta-content)
- `suggested_visuals`: Array of visual element suggestions

#### Visual Suggestion Format
```json
{
  "type": "image|infographic|chart|video|diagram",
  "description": "What the visual should show",
  "purpose": "Why this visual is important"
}
```

Note: Some responses may have suggested_visuals as simple strings. Your frontend should handle both formats:
- String: `"Collage of different temples"`
- Object: `{"type": "image", "description": "...", "purpose": "..."}`

#### 5. HTML Layouts Generation Messages (Phase 3)

##### HTML Generation Started
Indicates HTML layout generation has begun.
```json
{
  "type": "html_generation_started",
  "message": "Generating HTML layouts..."
}
```

##### HTML Layouts Generated (Single Message)
For smaller presentations, all HTML layouts are sent in one message.
```json
{
  "type": "html_layouts_generated",
  "success": true,
  "html_layouts": {
    "1": "<div class=\"slide\" style=\"width: 1920px; height: 1080px;\">...</div>",
    "2": "<div class=\"slide\" style=\"width: 1920px; height: 1080px;\">...</div>",
    // ... more slides
  },
  "total_slides": 10,
  "message": "Generated HTML layouts for 10 slides"
}
```

##### HTML Layouts Chunked Transfer (Large Presentations)
For presentations with large HTML content (>50KB), layouts are sent in chunks to avoid WebSocket size limits.

**Start Message:**
```json
{
  "type": "html_layouts_start",
  "success": true,
  "total_slides": 10,
  "message": "Sending HTML layouts for 10 slides in chunks..."
}
```

**Individual Chunk:**
```json
{
  "type": "html_layout_chunk",
  "slide_id": "1",
  "html": "<div class=\"slide\" style=\"width: 1920px; height: 1080px;\">...</div>",
  "size": 4567
}
```

**Completion Message:**
```json
{
  "type": "html_layouts_complete",
  "success": true,
  "total_slides": 10,
  "message": "Successfully sent all 10 HTML layouts"
}
```

### HTML Layout Structure
Each HTML layout is a self-contained slide with:
- Fixed dimensions: 1920x1080px (16:9 aspect ratio)
- Embedded CSS styles
- Professional typography and colors
- Placeholder elements for visuals
- Responsive scaling capabilities

Example HTML structure:
```html
<div class="slide" style="width: 1920px; height: 1080px; position: relative; overflow: hidden; background: #ffffff;">
  <div style="position: absolute; top: 100px; left: 100px; right: 100px;">
    <h1 style="font-size: 72px; color: #1a1a1a;">Slide Title</h1>
    <p style="font-size: 36px; color: #4a4a4a;">Content goes here...</p>
  </div>
</div>
```

## Complete Workflow Example

### Step-by-Step Integration Guide

#### 1. Initial Setup
```javascript
// Generate or use existing presentation ID
const presentationId = crypto.randomUUID();
const wsUrl = `wss://vibe-decker-agents-mvp10-production.up.railway.app/ws/presentations/${presentationId}/interactive`;

// State management for your frontend
let conversationHistory = [];
let currentStructure = null;
let currentPhase = 0;
```

#### 2. WebSocket Connection
```javascript
const ws = new WebSocket(wsUrl);

ws.onopen = () => {
  // Start discovery phase
  ws.send(JSON.stringify({
    command_type: "start_discovery",
    command: "Start chat mode",
    context: { chat_mode: true }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleServerMessage(message);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  // Implement reconnection logic
};
```

#### 3. Message Handler
```javascript
// Global storage for HTML layouts
let htmlLayouts = {};
let htmlChunkCount = 0;
let expectedChunkCount = 0;

function handleServerMessage(message) {
  switch (message.type) {
    case 'connected':
      console.log('Connected to Vibe Decker');
      updateUICapabilities(message.capabilities);
      break;
      
    case 'assistant_message':
      // Display in chat UI
      addChatMessage(message.content, 'assistant');
      conversationHistory.push({
        role: 'assistant',
        content: message.content,
        timestamp: new Date()
      });
      break;
      
    case 'status':
      if (message.status === 'thinking') {
        showLoadingIndicator(message.message);
      }
      break;
      
    case 'structure_generated':
      // This is the key message with strawman data
      currentStructure = message.structure;
      currentPhase = message.phase;
      
      // Update UI with structure
      displayPresentationStructure(message.structure);
      
      // Show appropriate UI based on phase
      if (message.phase === 2) {
        enableStructureView();
        showSlidesPreviews();
      }
      break;
      
    case 'html_generation_started':
      showLoadingIndicator('Generating HTML layouts...');
      break;
      
    case 'html_layouts_generated':
      // Single message with all HTML layouts
      htmlLayouts = message.html_layouts;
      displayHtmlLayouts(htmlLayouts);
      hideLoadingIndicator();
      break;
      
    case 'html_layouts_start':
      // Starting chunked transfer
      htmlLayouts = {};
      htmlChunkCount = 0;
      expectedChunkCount = message.total_slides;
      showLoadingIndicator('Receiving HTML layouts...');
      break;
      
    case 'html_layout_chunk':
      // Receiving individual chunk
      htmlLayouts[message.slide_id] = message.html;
      htmlChunkCount++;
      updateLoadingProgress(`Receiving HTML layouts... (${htmlChunkCount}/${expectedChunkCount})`);
      break;
      
    case 'html_layouts_complete':
      // All chunks received
      displayHtmlLayouts(htmlLayouts);
      hideLoadingIndicator();
      break;
      
    case 'error':
      handleError(message);
      break;
  }
}
```

#### 4. User Input Handler
```javascript
function sendUserMessage(content) {
  // Add to chat UI
  addChatMessage(content, 'user');
  
  // Add to history
  conversationHistory.push({
    role: 'user',
    content: content,
    timestamp: new Date()
  });
  
  // Send to server
  ws.send(JSON.stringify({
    type: 'chat_message',
    content: content
  }));
}
```

### Typical Conversation Flow

1. **User**: "I need a presentation about sustainable architecture"
2. **AI**: "I'd be happy to help you create a presentation on sustainable architecture! To make it perfect for your needs, could you tell me: Who is your target audience? How long should the presentation be? What's your main goal?"
3. **User**: "It's for architecture students, 45 minutes, educational"
4. **AI**: Creates structure → "I've created a 12-slide structure for your presentation. You can review the slide titles and order in the Structure tab. Would you like me to adjust the structure or proceed to enhance it with narrative purpose and engagement hooks?"
5. **User**: "looks good"
6. **AI**: Enhances structure → "Perfect! I've enhanced your presentation structure with narrative purpose, engagement hooks, enhanced descriptions, and visual suggestions. You can now see the complete strawman in the Slides tab."
7. **User**: "generate HTML layouts" or "create web slides"
8. **AI**: Generates HTML → "Perfect! I've generated HTML layouts for all 12 slides. You can view them in the **HTML View tab**. These are browser-ready slides with proper dimensions (1920x1080px) and professional styling. You can download individual slides or view them full-screen."

## Frontend Display Recommendations

### 1. Dual-Panel Layout
```
┌─────────────────┬────────────────────────────┐
│   Chat Panel    │   Presentation Display     │
│                 │                            │
│ • Natural       │ • Structure View           │
│   conversation  │ • Slide Previews           │
│ • AI responses  │ • Meta-content Display     │
│                 │ • Visual Suggestions       │
└─────────────────┴────────────────────────────┘
```

### 2. Structure Display Components

#### Slide Card Component
```javascript
function SlideCard({ slide }) {
  return (
    <div className="slide-card">
      <div className="slide-number">Slide {slide.id}</div>
      <h3 className="slide-title">{slide.title}</h3>
      
      <div className="meta-content">
        <div className="narrative-section">
          <h4>Narrative Purpose</h4>
          <p>{slide.narrative_purpose}</p>
        </div>
        
        <div className="hook-section">
          <h4>Engagement Hook</h4>
          <p className="hook-text">{slide.engagement_hook}</p>
        </div>
        
        <div className="description-section">
          <p>{slide.description}</p>
        </div>
        
        <div className="visuals-section">
          <h4>Suggested Visuals</h4>
          {slide.suggested_visuals.map((visual, index) => (
            <VisualSuggestion key={index} visual={visual} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

#### Visual Suggestion Handler
```javascript
function VisualSuggestion({ visual }) {
  // Handle both string and object formats
  if (typeof visual === 'string') {
    return (
      <div className="visual-item">
        <span className="visual-type">Visual</span>
        <span className="visual-desc">{visual}</span>
      </div>
    );
  }
  
  return (
    <div className="visual-item">
      <span className="visual-type">{visual.type}</span>
      <span className="visual-desc">{visual.description}</span>
      {visual.purpose && (
        <span className="visual-purpose">{visual.purpose}</span>
      )}
    </div>
  );
}
```

#### HTML Layout Display Component
```javascript
function HtmlSlideDisplay({ slideId, htmlContent }) {
  // Create a scaled preview (30% size)
  const scaleRatio = 0.3;
  
  return (
    <div className="html-slide-container">
      <div className="slide-controls">
        <h4>Slide {slideId} - HTML Preview</h4>
        <button onClick={() => downloadHtml(slideId, htmlContent)}>
          Download HTML
        </button>
        <button onClick={() => openFullscreen(slideId, htmlContent)}>
          View Full Size
        </button>
      </div>
      
      <div className="slide-preview" style={{
        transform: `scale(${scaleRatio})`,
        transformOrigin: 'top left',
        width: `${100 / scaleRatio}%`,
        height: `${1080 * scaleRatio}px`,
        overflow: 'hidden'
      }}>
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </div>
    </div>
  );
}

function downloadHtml(slideId, htmlContent) {
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `slide_${slideId}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function openFullscreen(slideId, htmlContent) {
  const newWindow = window.open('', `slide_${slideId}`, 'width=1920,height=1080');
  newWindow.document.write(htmlContent);
  newWindow.document.close();
}
```

## Best Practices for Frontend Integration

### 1. State Management
- Maintain conversation history for context
- Store current structure separately from chat messages
- Track current phase to show appropriate UI elements
- Cache generated structures for offline viewing

### 2. Error Handling
```javascript
function handleError(error) {
  if (error.message.includes('response size')) {
    showUserMessage("The presentation is quite detailed. Generating a simplified version...");
    // Retry logic
  } else if (error.message.includes('Failed to parse message')) {
    showUserMessage("HTML content was too large or complex. Retrying with chunked transfer...");
    // The backend will automatically retry with chunks
  } else {
    showUserMessage("Something went wrong. Please try again.");
  }
}
```

### 3. HTML Layout Handling
- **Chunked Transfer**: Be prepared to handle both single message and chunked HTML transfer
- **Storage**: Store HTML layouts with string keys (slide IDs are sent as strings)
- **Memory Management**: Clear HTML layouts when switching presentations to avoid memory issues
- **Scaling**: Use CSS transforms for preview scaling to maintain quality
- **Download**: Provide individual slide download and full presentation export options

### 4. Loading States
- Show typing indicators during AI processing
- Display progress messages for long operations
- Provide clear feedback when structure is being generated
- Show chunk progress for HTML layout transfer (e.g., "Receiving 5/10 slides...")

### 5. Responsive Design
- Chat panel should be collapsible on mobile
- Slide previews should adapt to screen size
- Meta-content should be expandable/collapsible
- HTML previews should scale responsively

### 6. Accessibility
- Ensure all content is keyboard navigable
- Provide clear ARIA labels for dynamic content
- Support screen readers for chat interface

## API Commitments and Guarantees

### What We Guarantee:
1. **Structured JSON Output**: Always returns well-formed JSON with consistent field structure
2. **Natural Language Understanding**: Handles various phrasings and intents
3. **Progressive Enhancement**: Basic structure → Enhanced structure → HTML layouts → Future content
4. **Error Recovery**: Graceful fallbacks for large presentations
5. **Conversational Context**: Maintains conversation history within session
6. **HTML Generation**: Browser-ready HTML slides with fixed dimensions (1920x1080px)
7. **Chunked Transfer**: Automatic chunking for large HTML payloads to avoid size limits

### Response Time Expectations:
- Initial connection: < 1 second
- Simple queries: 2-5 seconds
- Structure generation: 10-15 seconds
- Enhancement: 15-25 seconds
- HTML layout generation: 20-30 seconds
- Error recovery: Additional 10-15 seconds

### Limitations:
- Maximum 20 slides per presentation
- Session timeout after 5 minutes of inactivity
- Token limits may cause truncation (handled automatically)
- No persistent storage (implement client-side caching)

## Testing Your Integration

### Test Scenarios:
1. **Basic Flow**: "Create a presentation about X" → structure → "looks good" → enhanced structure
2. **Detailed Requirements**: Include audience, duration, goals in first message
3. **Modifications**: "Change slide 3 to focus on Y" after structure generation
4. **Error Handling**: Request 20+ slides to test truncation handling
5. **Natural Language**: Use various phrasings to test understanding

### Sample Test Script:
```javascript
// Test 1: Basic flow
await sendUserMessage("I want to create a presentation about AI in healthcare");
// Wait for response...
await sendUserMessage("For doctors, 20 minutes, educational");
// Wait for structure...
await sendUserMessage("looks good");

// Test 2: Direct requirements
await sendUserMessage("Create a 10-slide presentation on climate change for high school students, 30 minutes, to raise awareness");

// Test 3: Modifications
await sendUserMessage("Can you add a slide about renewable energy solutions after slide 5?");
```

## Support and Troubleshooting

### Common Issues:

1. **No structure_generated message**
   - Check WebSocket connection is open
   - Ensure initial command includes `chat_mode: true`
   - Verify conversation flow (topic → requirements → approval)

2. **Truncated responses**
   - Normal for presentations >12 slides
   - System automatically retries with simplified approach
   - Frontend should handle partial data gracefully

3. **WebSocket disconnection**
   - Implement automatic reconnection
   - Save presentation ID to resume session
   - Cache generated structures locally

### Debug Logging:
```javascript
// Enable detailed logging
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('[Vibe Decker]', message.type, message);
  handleServerMessage(message);
};
```

## Next Steps

After successfully implementing Phase 2 and Phase 3:
1. **Phase 4**: Content generation (detailed slide content with speaker notes)
2. **Phase 5**: Export capabilities (PowerPoint, PDF)
3. **Phase 6**: Collaboration features
4. **Phase 7**: Real-time visual generation with AI

For questions or issues, contact the Vibe Decker team or submit issues to our GitHub repository.

response = requests.post(
    "https://vibe-decker-agents-mvp10-production.up.railway.app/api/v1/presentations/generate",
    json={
        "topic": "Python Best Practices",
        "key_points": ["Code Style", "Testing", "Documentation"],
        "slide_count": 5,
        "style": "technical"
    }
)

data = response.json()
print(f"Presentation ID: {data['presentation_id']}")
print(f"Connect to: wss://vibe-decker-agents-mvp10-production.up.railway.app{data['websocket_url']}")
```

### 2. Get Presentation Status

Check the status of a presentation.

**Endpoint**: `GET /api/v1/presentations/{presentation_id}`

**Response (when available)**:
```json
{
  "presentation_id": "92354059-804a-497e-b6cf-9317395415ac",
  "status": "completed",        // "unknown", "processing", "completed", "failed"
  "created_at": "2025-06-27T02:07:25.391169+00:00",
  "message": "Use /content endpoint to get full presentation data"
}
```

**Response (when not found)**:
```json
{
  "presentation_id": "92354059-804a-497e-b6cf-9317395415ac",
  "status": "unknown",
  "message": "Presentation not found or still processing"
}
```

### 3. Get Presentation Content

Retrieve the full presentation data (requires deployed cache feature).

**Endpoint**: `GET /api/v1/presentations/{presentation_id}/content`

**Response**:
```json
{
  "presentation_id": "92354059-804a-497e-b6cf-9317395415ac",
  "status": "completed",
  "created_at": "2025-06-27T02:07:25.391169+00:00",
  "request": {
    "topic": "Future of Renewable Energy",
    "key_points": ["Solar Power", "Wind Energy", "Energy Storage"],
    "slide_count": 8,
    "style": "modern",
    "fast_mode": true
  },
  "result": {
    "presentation_id": "92354059-804a-497e-b6cf-9317395415ac",
    "presentation": {
      "title": "Future of Renewable Energy",
      "topic": "Future of Renewable Energy",
      "slides": [
        {
          "order": 1,
          "type": "title",
          "title": "Future of Renewable Energy",
          "content": [
            {
              "type": "text",
              "text": "Exploring Solar, Wind, and Energy Storage Solutions"
            }
          ]
        },
        {
          "order": 2,
          "type": "content",
          "title": "Solar Power Revolution",
          "content": [
            {
              "type": "header",
              "text": "Current State of Solar Technology"
            },
            {
              "type": "bullet",
              "points": [
                "Photovoltaic efficiency reaching 26%",
                "Cost reduction of 90% since 2010",
                "Grid parity achieved in 140+ countries"
              ]
            }
          ],
          "speaker_notes": "Emphasize the rapid cost reduction and efficiency improvements"
        }
      ],
      "metadata": {
        "style": "modern",
        "generation_mode": "fast",
        "key_points": ["Solar Power", "Wind Energy", "Energy Storage"]
      }
    },
    "quality_report": {
      "overall_score": 0.85,
      "checks": [],
      "skipped": true,
      "reason": "fast_mode"
    },
    "completion_status": {
      "content": "complete",
      "layout": "skipped",
      "quality": "skipped",
      "reason": "fast_mode"
    },
    "interactions_used": 8
  }
}
```

**Error Responses**:
- `404 Not Found`: Presentation ID doesn't exist
- `500 Internal Server Error`: Generation failed
- `202 Accepted`: Still processing

### 4. Health Check

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy",
  "version": "3.0.0",
  "timestamp": "2025-06-27T02:07:25.391169+00:00"
}
```

### 5. Debug Configuration

**Endpoint**: `GET /debug/config`

**Response**:
```json
{
  "openai_configured": true,
  "anthropic_configured": true,
  "openai_key_length": 51,
  "anthropic_key_length": 58,
  "environment": "production",
  "fast_mode_enabled": true,
  "max_interactions": 20
}
```

## WebSocket Connection

### Connection Flow

1. Client calls `POST /api/v1/presentations/generate`
2. Server returns `presentation_id` and `websocket_url`
3. Client immediately connects to WebSocket URL
4. Server sends real-time updates during generation
5. Server sends final presentation in `complete` message
6. Connection closes

### WebSocket Endpoints

#### 1. Standard Generation Endpoint

**URL Pattern**: `/ws/presentations/{presentation_id}`

**Full URL**: `wss://vibe-decker-agents-mvp10-production.up.railway.app/ws/presentations/{presentation_id}`

Used for receiving real-time updates during standard presentation generation.

#### 2. Interactive Conversation Endpoint

**URL Pattern**: `/ws/presentations/{presentation_id}/interactive`

**Full URL**: `wss://vibe-decker-agents-mvp10-production.up.railway.app/ws/presentations/{presentation_id}/interactive`

Used for conversational, iterative presentation building with natural language commands.

### Message Types (Server → Client)

#### 1. Connected Message
Sent immediately upon connection establishment.
```json
{
  "type": "connected",
  "presentation_id": "92354059-804a-497e-b6cf-9317395415ac",
  "timestamp": "2025-06-27T02:07:25.391169+00:00"
}
```

#### 2. Status Message
General status updates.
```json
{
  "type": "status",
  "status": "started",
  "timestamp": "2025-06-27T02:07:25.391169+00:00"
}
```

#### 3. Progress Message
Generation progress updates.
```json
{
  "type": "progress",
  "stage": "content_generation",
  "progress": 33,
  "message": "Creating slide layouts",
  "mode": "fast",
  "max_interactions": 20
}
```

**Stages**:
- `content_generation`: 0-33%
- `layout_generation`: 33-66%
- `quality_check`: 66-100%
- `completed`: 100%

#### 4. Outline Preview
Early preview of presentation structure (sent within 5-10 seconds).
```json
{
  "type": "outline_preview",
  "outline": {
    "title": "Future of Renewable Energy Presentation",
    "planned_slides": [
      "Title Slide",
      "Solar Power Revolution",
      "Wind Energy Advances",
      "Energy Storage Solutions",
      "Grid Integration",
      "Economic Impact",
      "Future Outlook",
      "Conclusion & Q&A"
    ],
    "estimated_time": "30-60 seconds"
  }
}
```

#### 5. Slide Preview
Individual slide preview as it's generated.
```json
{
  "type": "slide_preview",
  "slide": {
    "order": 2,
    "title": "Solar Power Revolution",
    "preview": "Slide 2 ready: Solar Power Revolution",
    "content_preview": "[{\"type\": \"header\", \"text\": \"Current State\"}, {\"type\": \"bullet\", \"points\": [\"Efficiency improvements\", \"Cost reduction\"]}]..."
  }
}
```

#### 6. Complete Message
Final presentation data.
```json
{
  "type": "complete",
  "presentation": {
    "presentation_id": "92354059-804a-497e-b6cf-9317395415ac",
    "presentation": {
      "title": "Future of Renewable Energy",
      "topic": "Future of Renewable Energy",
      "slides": [...],
      "metadata": {...}
    },
    "quality_report": {
      "overall_score": 0.85,
      "checks": [],
      "skipped": true,
      "reason": "fast_mode"
    },
    "status": "completed",
    "completion_status": {
      "content": "complete",
      "layout": "skipped",
      "quality": "skipped",
      "reason": "fast_mode"
    },
    "interactions_used": 8
  },
  "timestamp": "2025-06-27T02:07:28.851000+00:00"
}
```

#### 7. Error Message
Error notification with context.
```json
{
  "type": "error",
  "error": "Content generation timed out",
  "message": "Content generation timed out. Please try with fewer slides or a simpler topic.",
  "stage_failed": "content_generation",
  "interactions_used": 5,
  "partial_completion": {
    "content": "timeout",
    "layout": "pending",
    "quality": "pending"
  },
  "timestamp": "2025-06-27T02:07:25.391169+00:00"
}
```

### Client → Server Messages (Standard Endpoint)

#### Ping Message
Keep connection alive (send every 30 seconds).
```text
ping
```

Server responds with:
```json
{
  "type": "pong",
  "timestamp": "2025-06-27T02:07:25.391169+00:00"
}
```

## Interactive WebSocket API

The interactive endpoint (`/ws/presentations/{presentation_id}/interactive`) enables conversational presentation building through natural language commands.

### Connection Flow

1. Connect to the interactive WebSocket endpoint
2. Receive connected message with capabilities
3. Send natural language commands
4. Receive structured responses with previews and suggestions
5. Continue iterating until satisfied

### Interactive Message Format (Client → Server)

```json
{
  "command_type": "structure|expand|refine|revert|query",
  "command": "Natural language command describing what you want",
  "context": {
    "selected_slides": [1, 2, 3],     // Optional: specific slides to operate on
    "current_slide": 5,               // Optional: currently focused slide
    "topic": "AI in Healthcare"       // Optional: presentation topic
  }
}
```

### Command Types

#### 1. Structure Commands
Create or modify presentation structure.

```json
{
  "command_type": "structure",
  "command": "Create a presentation about renewable energy with 10 slides",
  "context": {"topic": "Renewable Energy"}
}
```

Examples:
- "Create a presentation about X with Y slides"
- "Add a slide about ROI after slide 3"
- "Remove the technical details slide"
- "Reorder slides to put examples before theory"
- "Split slide 5 into two separate slides"

#### 2. Expand Commands
Add detailed content to slides.

```json
{
  "command_type": "expand",
  "command": "Add real-world examples and case studies to slides 3 and 4",
  "context": {"selected_slides": [3, 4]}
}
```

Examples:
- "Expand slide 3 with detailed examples"
- "Add statistics and data to the market analysis slide"
- "Create a compelling narrative for the introduction"
- "Include case studies in slides 5-7"

#### 3. Refine Commands
Improve existing content.

```json
{
  "command_type": "refine",
  "command": "Make the language more engaging and add emotional appeal",
  "context": {}
}
```

Examples:
- "Simplify the technical language in slide 4"
- "Make the conclusion more impactful"
- "Add more professional terminology"
- "Improve the flow between slides 3 and 4"

#### 4. Revert Commands
Undo changes or go back to previous versions.

```json
{
  "command_type": "revert",
  "command": "Go back to the structure we had 5 minutes ago",
  "context": {}
}
```

Examples:
- "Undo the last change"
- "Revert to the previous version"
- "Go back to before we added the ROI slide"
- "Restore the original structure"

#### 5. Query Commands
Ask questions about the presentation.

```json
{
  "command_type": "query",
  "command": "What's the total word count?",
  "context": {}
}
```

Examples:
- "How many words are in slide 5?"
- "Which slides still need content?"
- "What's the estimated presentation duration?"
- "Show me all slides about implementation"

### Interactive Response Types (Server → Client)

#### 1. Connected Response
Sent immediately upon connection.

```json
{
  "type": "connected",
  "presentation_id": "92354059-804a-497e-b6cf-9317395415ac",
  "timestamp": "2025-06-27T10:15:30.123Z",
  "capabilities": [
    "structure_generation",
    "content_expansion",
    "refinement",
    "version_control",
    "real_time_preview"
  ]
}
```

#### 2. Structure Update
Sent when structure is created or modified.

```json
{
  "type": "structure_update",
  "structure": {
    "title": "Renewable Energy: The Future is Now",
    "total_slides": 10,
    "estimated_duration": "15 minutes",
    "slides": [
      {
        "id": 1,
        "title": "The Energy Revolution",
        "description": "Opening slide that captures the urgency and opportunity of renewable energy transition. Sets the stage with compelling statistics about climate change and energy demand.",
        "key_points": [
          "Global energy demand increasing 28% by 2040",
          "Renewable capacity additions hit record 295 GW in 2022",
          "Cost of solar dropped 89% in last decade",
          "Climate goals require 11,000 GW renewable capacity by 2030",
          "Clean energy creating 13 million jobs globally"
        ],
        "suggested_visuals": ["Global heat map", "Renewable growth chart", "Cost curve graphic"],
        "speaking_time": "2 minutes",
        "content_depth": "overview"
      }
    ]
  },
  "changes": {
    "action": "created",
    "slides_added": 10
  },
  "preview": {
    "title": "Renewable Energy: The Future is Now",
    "total_slides": 10,
    "duration": "15 minutes",
    "slide_titles": ["The Energy Revolution", "Solar Power Dominance", "Wind Energy Scale", "Energy Storage Solutions", "Grid Modernization"]
  },
  "suggestions": [
    "Expand slide 3 with specific wind farm examples",
    "Add cost comparison data to slide 5",
    "Include regional case studies",
    "Strengthen the call-to-action in conclusion"
  ]
}
```

#### 3. Content Update
Sent when slide content is expanded or modified.

```json
{
  "type": "content_update",
  "slide_id": 3,
  "content": {
    "content": [
      {
        "type": "opening",
        "text": "Wind energy has emerged as a cornerstone of the renewable revolution, with offshore wind farms now powering entire cities and onshore installations transforming rural economies across the globe."
      },
      {
        "type": "main_content",
        "sections": [
          {
            "header": "Offshore Wind Transformation",
            "text": "The Hornsea 2 project off the UK coast generates 1.3 GW of clean energy, enough to power 1.3 million homes. With turbines reaching 200 meters tall and blades spanning 120 meters, these engineering marvels capture winds that blow more consistently and powerfully than onshore sites.",
            "data_point": {
              "value": "480 GW",
              "context": "Global offshore wind capacity potential by 2050"
            }
          },
          {
            "header": "Economic Impact on Communities",
            "text": "In Texas, wind energy has revitalized rural communities, generating $1.6 billion in annual land lease payments to farmers and ranchers. The American Clean Power Association reports that counties with wind projects see average property tax revenues increase by $1.8 million annually.",
            "example": "Nolan County, Texas transformed from struggling agricultural community to energy powerhouse, with wind farms contributing 40% of county's tax revenue"
          }
        ]
      },
      {
        "type": "supporting_points",
        "points": [
          {
            "point": "Wind power costs declined 69% between 2009-2019",
            "elaboration": "Making it cheaper than coal in most markets worldwide"
          },
          {
            "point": "Global wind capacity reached 1,021 GW in 2023",
            "elaboration": "China alone added 75 GW, equivalent to France's entire power capacity"
          }
        ]
      }
    ],
    "speaker_notes": "Emphasize the scale comparison - one offshore turbine can power 16,000 homes. If time allows, mention the innovative floating wind platforms enabling deeper water installations.",
    "word_count": 245
  },
  "preview": {
    "slide_id": 3,
    "title": "Wind Energy Scale",
    "has_content": true,
    "preview_text": "Wind energy has emerged as a cornerstone of the renewable revolution, with offshore wind farms now powering entire cities...",
    "word_count": 245
  },
  "word_count": 245
}
```

#### 4. Progress Update
Sent during longer operations.

```json
{
  "type": "progress",
  "stage": "content_expansion",
  "message": "Expanding content for 3 slides",
  "affected_slides": [3, 4, 5]
}
```

#### 5. Status Update
General status messages and thinking indicators.

```json
{
  "type": "status",
  "status": "thinking",
  "message": "Analyzing structure requirements..."
}
```

#### 6. Query Response
Response to user questions.

```json
{
  "type": "query_response",
  "question": "What's the total word count?",
  "answer": "The presentation currently has 1,847 words across 10 slides, averaging 185 words per slide. Slides 3, 4, and 7 have the most detailed content with over 250 words each.",
  "related_slides": [3, 4, 7],
  "suggestions": [
    "Expand slides 2 and 5 to match content depth",
    "Add speaker notes to remaining slides",
    "Consider adding an executive summary slide"
  ]
}
```

#### 7. Suggestions
Proactive AI suggestions for next steps.

```json
{
  "type": "suggestions",
  "suggestions": [
    "Add a compelling story to slide 1 to grab attention",
    "Include ROI calculations in the business case section",
    "Expand technical slides with implementation details",
    "Strengthen the conclusion with a clear call-to-action"
  ]
}
```

#### 8. State Update
Sent after revert operations.

```json
{
  "type": "state_update",
  "reverted_to": "Before ROI slide addition",
  "structure": {...},
  "content": {...},
  "message": "Reverted to: Before ROI slide addition"
}
```

#### 9. Clarification Request
When the system needs more information.

```json
{
  "type": "clarification_request",
  "message": "I'm not sure which slides you want to expand. Could you clarify?",
  "options": [
    "Expand all slides with basic content",
    "Expand only the introduction slides (1-3)",
    "Expand the technical slides (4-7)",
    "Let me specify which slides"
  ]
}
```

### Natural Language Processing

The system understands natural, conversational commands without rigid syntax:

- **Context-aware**: "Make this slide more detailed" (knows current slide)
- **Relative references**: "Add a slide after this one"
- **Bulk operations**: "Expand all technical slides with examples"
- **Time-based**: "Go back to 10 minutes ago"
- **Descriptive**: "The slide about cost savings needs more data"

## Content Structure

### Slide Types
- `title`: Title slide (always first)
- `content`: Regular content slide
- `section`: Section divider (future)
- `conclusion`: Conclusion slide (future)

### Content Element Types

#### Text Element
```json
{
  "type": "text",
  "text": "Plain paragraph text"
}
```

#### Header Element
```json
{
  "type": "header",
  "text": "Section Header"
}
```

#### Bullet Points
```json
{
  "type": "bullet",
  "points": [
    "First point",
    "Second point",
    "Third point"
  ]
}
```

#### Alternative Bullet Format
```json
{
  "type": "bullet_list",
  "items": [
    "First item",
    "Second item"
  ]
}
```

#### Image Element (future)
```json
{
  "type": "image",
  "url": "https://example.com/image.jpg",
  "caption": "Image description"
}
```

## Complete Integration Examples

### JavaScript/TypeScript (Full Implementation)
```javascript
class VibeDecker {
  constructor(baseUrl = 'https://vibe-decker-agents-mvp10-production.up.railway.app') {
    this.baseUrl = baseUrl;
    this.ws = null;
    this.callbacks = {
      onProgress: null,
      onOutline: null,
      onSlidePreview: null,
      onComplete: null,
      onError: null
    };
  }

  async generatePresentation(params) {
    // 1. Start generation
    const response = await fetch(`${this.baseUrl}/api/v1/presentations/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`Generation failed: ${response.statusText}`);
    }

    const { presentation_id, websocket_url } = await response.json();

    // 2. Connect to WebSocket
    return new Promise((resolve, reject) => {
      const wsUrl = this.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
      this.ws = new WebSocket(`${wsUrl}${websocket_url}`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        // Keep alive
        this.pingInterval = setInterval(() => {
          if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send('ping');
          }
        }, 30000);
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'connected':
            console.log('Connected to presentation:', message.presentation_id);
            break;
            
          case 'progress':
            this.callbacks.onProgress?.(message.progress, message.message, message.stage);
            break;
            
          case 'outline_preview':
            this.callbacks.onOutline?.(message.outline);
            break;
            
          case 'slide_preview':
            this.callbacks.onSlidePreview?.(message.slide);
            break;
            
          case 'complete':
            this.cleanup();
            resolve(message.presentation);
            this.callbacks.onComplete?.(message.presentation);
            break;
            
          case 'error':
            this.cleanup();
            const error = new Error(message.error || message.message);
            error.stage = message.stage_failed;
            reject(error);
            this.callbacks.onError?.(error);
            break;
        }
      };

      this.ws.onerror = (error) => {
        this.cleanup();
        reject(error);
      };

      this.ws.onclose = (event) => {
        if (!event.wasClean) {
          this.cleanup();
          reject(new Error('Connection lost'));
        }
      };
    });
  }

  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Callback setters
  onProgress(callback) {
    this.callbacks.onProgress = callback;
    return this;
  }

  onOutline(callback) {
    this.callbacks.onOutline = callback;
    return this;
  }

  onSlidePreview(callback) {
    this.callbacks.onSlidePreview = callback;
    return this;
  }

  onComplete(callback) {
    this.callbacks.onComplete = callback;
    return this;
  }

  onError(callback) {
    this.callbacks.onError = callback;
    return this;
  }
}

// Usage Example
const vibe = new VibeDecker();

vibe
  .onProgress((progress, message, stage) => {
    console.log(`[${stage}] ${progress}% - ${message}`);
  })
  .onOutline((outline) => {
    console.log('Presentation outline:', outline.planned_slides);
  })
  .onSlidePreview((slide) => {
    console.log(`Preview: Slide ${slide.order} - ${slide.title}`);
  })
  .onComplete((presentation) => {
    console.log('Presentation complete!');
    console.log(`Total slides: ${presentation.presentation.slides.length}`);
    console.log(`Quality score: ${presentation.quality_report.overall_score}`);
  })
  .onError((error) => {
    console.error('Generation failed:', error.message);
  });

// Generate presentation
vibe.generatePresentation({
  topic: 'Modern Web Development',
  key_points: ['React', 'TypeScript', 'GraphQL'],
  slide_count: 7,
  style: 'technical',
  fast_mode: true
}).then(presentation => {
  // Use the presentation data
  displayPresentation(presentation);
}).catch(error => {
  console.error('Failed to generate:', error);
});
```

### Python (Full Implementation)
```python
import asyncio
import json
import logging
from typing import Dict, List, Optional, Callable
import aiohttp

logger = logging.getLogger(__name__)

class VibeDecker:
    def __init__(self, base_url: str = "https://vibe-decker-agents-mvp10-production.up.railway.app"):
        self.base_url = base_url
        self.ws_base = base_url.replace("https://", "wss://").replace("http://", "ws://")
        
    async def generate_presentation(
        self,
        topic: str,
        key_points: Optional[List[str]] = None,
        slide_count: int = 10,
        style: str = "professional",
        fast_mode: bool = True,
        on_progress: Optional[Callable] = None,
        on_outline: Optional[Callable] = None,
        on_slide_preview: Optional[Callable] = None
    ) -> Dict:
        """
        Generate a presentation with real-time updates.
        
        Args:
            topic: Main topic of the presentation
            key_points: List of key points to cover
            slide_count: Number of slides (1-20)
            style: Visual style (professional, modern, technical, etc.)
            fast_mode: Use fast generation mode
            on_progress: Callback for progress updates
            on_outline: Callback for outline preview
            on_slide_preview: Callback for slide previews
            
        Returns:
            Complete presentation data
        """
        
        # 1. Start generation
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/api/v1/presentations/generate",
                json={
                    "topic": topic,
                    "key_points": key_points or [],
                    "slide_count": slide_count,
                    "style": style,
                    "fast_mode": fast_mode
                }
            ) as response:
                if response.status != 200:
                    raise Exception(f"Failed to start generation: {response.status}")
                    
                data = await response.json()
                presentation_id = data["presentation_id"]
                websocket_url = data["websocket_url"]
                
        # 2. Connect to WebSocket
        ws_url = f"{self.ws_base}{websocket_url}"
        logger.info(f"Connecting to WebSocket: {ws_url}")
        
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(ws_url) as ws:
                # Keep alive task
                async def keep_alive():
                    while not ws.closed:
                        await ws.send_str("ping")
                        await asyncio.sleep(30)
                
                keep_alive_task = asyncio.create_task(keep_alive())
                
                try:
                    async for msg in ws:
                        if msg.type == aiohttp.WSMsgType.TEXT:
                            data = json.loads(msg.data)
                            
                            if data["type"] == "connected":
                                logger.info(f"Connected to presentation: {data['presentation_id']}")
                                
                            elif data["type"] == "progress":
                                if on_progress:
                                    await on_progress(
                                        data["progress"],
                                        data["message"],
                                        data.get("stage")
                                    )
                                    
                            elif data["type"] == "outline_preview":
                                if on_outline:
                                    await on_outline(data["outline"])
                                    
                            elif data["type"] == "slide_preview":
                                if on_slide_preview:
                                    await on_slide_preview(data["slide"])
                                    
                            elif data["type"] == "complete":
                                logger.info("Presentation generation complete")
                                return data["presentation"]
                                
                            elif data["type"] == "error":
                                raise Exception(
                                    f"Generation failed at {data.get('stage_failed', 'unknown')}: "
                                    f"{data.get('error', 'Unknown error')}"
                                )
                                
                        elif msg.type == aiohttp.WSMsgType.ERROR:
                            raise Exception(f"WebSocket error: {ws.exception()}")
                            
                finally:
                    keep_alive_task.cancel()
                    
        raise Exception("WebSocket closed without completion")

# Usage Example
async def main():
    vibe = VibeDecker()
    
    # Define callbacks
    async def on_progress(progress, message, stage):
        print(f"[{stage}] {progress}% - {message}")
        
    async def on_outline(outline):
        print(f"Outline: {len(outline['planned_slides'])} slides planned")
        for slide in outline['planned_slides']:
            print(f"  - {slide}")
            
    async def on_slide_preview(slide):
        print(f"Preview: Slide {slide['order']} - {slide['title']}")
    
    try:
        # Generate presentation
        presentation = await vibe.generate_presentation(
            topic="Python Async Programming",
            key_points=["asyncio basics", "async/await", "concurrency patterns"],
            slide_count=6,
            style="technical",
            fast_mode=True,
            on_progress=on_progress,
            on_outline=on_outline,
            on_slide_preview=on_slide_preview
        )
        
        # Display results
        print(f"\nPresentation complete!")
        print(f"Title: {presentation['presentation']['title']}")
        print(f"Slides: {len(presentation['presentation']['slides'])}")
        print(f"Quality Score: {presentation['quality_report']['overall_score']}")
        
        # Save to file
        with open(f"presentation_{presentation['presentation_id']}.json", "w") as f:
            json.dump(presentation, f, indent=2)
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
```

### React Hook Example
```typescript
import { useState, useCallback } from 'react';

interface UseVibeDeckerOptions {
  baseUrl?: string;
  onProgress?: (progress: number, message: string, stage: string) => void;
  onOutline?: (outline: any) => void;
  onSlidePreview?: (slide: any) => void;
}

export const useVibeDecker = (options: UseVibeDeckerOptions = {}) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [presentation, setPresentation] = useState(null);
  const [error, setError] = useState(null);
  const [outline, setOutline] = useState(null);
  const [slidePreviews, setSlidePreviews] = useState([]);

  const baseUrl = options.baseUrl || 'https://vibe-decker-agents-mvp10-production.up.railway.app';

  const generatePresentation = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    setProgress(0);
    setSlidePreviews([]);
    
    try {
      // 1. Start generation
      const response = await fetch(`${baseUrl}/api/v1/presentations/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error('Failed to start generation');
      }

      const { websocket_url } = await response.json();

      // 2. Connect to WebSocket
      const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
      const ws = new WebSocket(`${wsUrl}${websocket_url}`);

      // Keep alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 30000);

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'progress':
            setProgress(message.progress);
            setStatus(message.message);
            options.onProgress?.(message.progress, message.message, message.stage);
            break;

          case 'outline_preview':
            setOutline(message.outline);
            options.onOutline?.(message.outline);
            break;

          case 'slide_preview':
            setSlidePreviews(prev => [...prev, message.slide]);
            options.onSlidePreview?.(message.slide);
            break;

          case 'complete':
            setPresentation(message.presentation);
            setLoading(false);
            clearInterval(pingInterval);
            ws.close();
            break;

          case 'error':
            setError(new Error(message.error || message.message));
            setLoading(false);
            clearInterval(pingInterval);
            ws.close();
            break;
        }
      };

      ws.onerror = (error) => {
        setError(new Error('WebSocket connection failed'));
        setLoading(false);
        clearInterval(pingInterval);
      };

    } catch (err) {
      setError(err);
      setLoading(false);
    }
  }, [baseUrl, options]);

  return {
    generatePresentation,
    loading,
    progress,
    status,
    presentation,
    error,
    outline,
    slidePreviews
  };
};

// Usage in component
const PresentationGenerator = () => {
  const {
    generatePresentation,
    loading,
    progress,
    status,
    presentation,
    error,
    outline,
    slidePreviews
  } = useVibeDecker({
    onProgress: (progress, message) => {
      console.log(`Progress: ${progress}% - ${message}`);
    }
  });

  const handleGenerate = () => {
    generatePresentation({
      topic: 'React Best Practices',
      key_points: ['Hooks', 'Performance', 'Testing'],
      slide_count: 5,
      style: 'modern',
      fast_mode: true
    });
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={loading}>
        Generate Presentation
      </button>
      
      {loading && (
        <div>
          <progress value={progress} max={100} />
          <p>{status}</p>
        </div>
      )}
      
      {error && <div>Error: {error.message}</div>}
      
      {presentation && (
        <div>
          <h2>{presentation.presentation.title}</h2>
          <p>Slides: {presentation.presentation.slides.length}</p>
        </div>
      )}
    </div>
  );
};
```

## Error Handling

### HTTP Status Codes
- `200 OK`: Success
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Invalid request data
- `500 Internal Server Error`: Server error

### Common Errors and Solutions

1. **No WebSocket messages after connection**
   - Cause: Missing API keys in deployment
   - Solution: Add `OPENAI_API_KEY` to Railway environment variables

2. **Generation timeout**
   - Cause: Too many slides or complex topic
   - Solution: Enable fast_mode, reduce slide_count

3. **WebSocket connection closed**
   - Cause: Network issues or 5-minute timeout
   - Solution: Implement reconnection logic

4. **Partial results**
   - Cause: Interaction limits reached
   - Solution: Check completion_status in response

## Performance Considerations

### Generation Times
- **Fast mode**: 15-30 seconds for 5-10 slides
- **Standard mode**: 60-90 seconds for 5-10 slides
- **Large presentations** (15+ slides): May timeout, use fast mode

### Interaction Limits
- Total interactions: 20 (configurable)
- Pair interactions: 5 (configurable)
- Exceeding limits returns partial results

### Best Practices
1. **Use fast_mode for testing**: Reduces generation time by 50-70%
2. **Connect to WebSocket immediately**: Ensures you receive all updates
3. **Implement timeouts**: Set 5-minute timeout for generation
4. **Handle disconnections**: Implement reconnection for production apps
5. **Batch similar requests**: Reuse presentations when possible

## Rate Limiting

Currently no explicit rate limiting. Natural throttling through:
- Generation time (15-90 seconds per request)
- Interaction limits
- Server resources

## Interactive WebSocket Integration Examples

### JavaScript/TypeScript - Interactive Client

```javascript
class InteractiveVibeDecker {
  constructor(baseUrl = 'https://vibe-decker-agents-mvp10-production.up.railway.app') {
    this.baseUrl = baseUrl;
    this.ws = null;
    this.presentationId = null;
  }

  async startInteractiveSession(presentationId) {
    this.presentationId = presentationId || crypto.randomUUID();
    const wsUrl = this.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${wsUrl}/ws/presentations/${this.presentationId}/interactive`);
      
      this.ws.onopen = () => {
        console.log('Interactive session started');
        resolve(this.presentationId);
      };
      
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };
      
      this.ws.onerror = reject;
    });
  }

  async sendCommand(commandType, command, context = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    const message = {
      command_type: commandType,
      command: command,
      context: context
    };
    
    this.ws.send(JSON.stringify(message));
  }

  handleMessage(message) {
    switch (message.type) {
      case 'connected':
        console.log('Connected with capabilities:', message.capabilities);
        break;
        
      case 'structure_update':
        console.log('Structure updated:', message.structure.title);
        console.log('Total slides:', message.structure.total_slides);
        console.log('Suggestions:', message.suggestions);
        break;
        
      case 'content_update':
        console.log(`Slide ${message.slide_id} updated: ${message.word_count} words`);
        break;
        
      case 'query_response':
        console.log('Answer:', message.answer);
        break;
        
      case 'clarification_request':
        console.log('Clarification needed:', message.message);
        console.log('Options:', message.options);
        break;
        
      default:
        console.log(message.type + ':', message);
    }
  }

  // Convenience methods
  async createPresentation(topic, slideCount = 10) {
    await this.sendCommand('structure', 
      `Create a presentation about ${topic} with ${slideCount} slides`,
      { topic }
    );
  }

  async expandSlide(slideNumber, expansionType = 'examples') {
    await this.sendCommand('expand',
      `Expand slide ${slideNumber} with ${expansionType}`,
      { selected_slides: [slideNumber] }
    );
  }

  async refineContent(instruction) {
    await this.sendCommand('refine', instruction);
  }

  async revert(target = 'last change') {
    await this.sendCommand('revert', `Undo ${target}`);
  }

  async query(question) {
    await this.sendCommand('query', question);
  }
}

// Usage Example
const vibe = new InteractiveVibeDecker();

async function buildPresentation() {
  // Start session
  const presentationId = await vibe.startInteractiveSession();
  
  // Create structure
  await vibe.createPresentation('Sustainable Architecture', 8);
  
  // Wait for structure, then expand
  setTimeout(async () => {
    await vibe.expandSlide(2, 'real examples');
    await vibe.expandSlide(3, 'statistics and data');
  }, 3000);
  
  // Refine after expansion
  setTimeout(async () => {
    await vibe.refineContent('Make the introduction more compelling with a story');
  }, 8000);
  
  // Query
  setTimeout(async () => {
    await vibe.query('What is the total word count?');
  }, 10000);
}

buildPresentation();
```

### Python - Interactive Async Client

```python
import asyncio
import json
import uuid
import websockets
from typing import Optional, Dict, Any, Callable

class InteractiveVibeDecker:
    def __init__(self, base_url: str = "wss://vibe-decker-agents-mvp10-production.up.railway.app"):
        self.base_url = base_url
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.presentation_id: Optional[str] = None
        self.message_handlers = {}
        
    async def start_session(self, presentation_id: Optional[str] = None) -> str:
        """Start an interactive session"""
        self.presentation_id = presentation_id or str(uuid.uuid4())
        url = f"{self.base_url}/ws/presentations/{self.presentation_id}/interactive"
        
        self.ws = await websockets.connect(url)
        
        # Start message receiver
        asyncio.create_task(self._receive_messages())
        
        return self.presentation_id
        
    async def _receive_messages(self):
        """Receive and handle messages"""
        async for message in self.ws:
            data = json.loads(message)
            msg_type = data.get("type")
            
            # Call registered handler if exists
            if msg_type in self.message_handlers:
                await self.message_handlers[msg_type](data)
            else:
                print(f"{msg_type}: {data}")
                
    def on_message(self, msg_type: str):
        """Decorator to register message handlers"""
        def decorator(func: Callable):
            self.message_handlers[msg_type] = func
            return func
        return decorator
        
    async def command(self, command_type: str, command: str, context: Dict[str, Any] = None):
        """Send a command"""
        message = {
            "command_type": command_type,
            "command": command,
            "context": context or {}
        }
        await self.ws.send(json.dumps(message))
        
    # Convenience methods
    async def create_structure(self, topic: str, slides: int = 10):
        await self.command(
            "structure",
            f"Create a presentation about {topic} with {slides} slides",
            {"topic": topic}
        )
        
    async def expand_slides(self, slide_numbers: list, content_type: str = "detailed"):
        await self.command(
            "expand",
            f"Expand slides {', '.join(map(str, slide_numbers))} with {content_type} content",
            {"selected_slides": slide_numbers}
        )
        
    async def refine(self, instruction: str, slides: Optional[list] = None):
        context = {"selected_slides": slides} if slides else {}
        await self.command("refine", instruction, context)
        
    async def revert_to(self, target: str):
        await self.command("revert", f"Go back to {target}")
        
    async def ask(self, question: str):
        await self.command("query", question)

# Usage Example
async def interactive_presentation_builder():
    vibe = InteractiveVibeDecker()
    
    # Register handlers
    @vibe.on_message("structure_update")
    async def handle_structure(data):
        structure = data["structure"]
        print(f"\n📋 Structure: {structure['title']}")
        print(f"   Slides: {structure['total_slides']}")
        for i, slide in enumerate(structure["slides"][:3]):
            print(f"   {i+1}. {slide['title']}")
        print(f"   Suggestions: {', '.join(data['suggestions'][:2])}")
        
    @vibe.on_message("content_update")
    async def handle_content(data):
        print(f"\n📝 Slide {data['slide_id']} expanded: {data['word_count']} words")
        
    @vibe.on_message("query_response")
    async def handle_query(data):
        print(f"\n❓ Q: {data['question']}")
        print(f"   A: {data['answer']}")
        
    # Start session
    presentation_id = await vibe.start_session()
    print(f"Session started: {presentation_id}")
    
    # Build presentation interactively
    await vibe.create_structure("Future of Space Exploration", 10)
    await asyncio.sleep(3)
    
    await vibe.expand_slides([1, 2, 3], "compelling narratives")
    await asyncio.sleep(5)
    
    await vibe.expand_slides([4, 5], "technical details and data")
    await asyncio.sleep(5)
    
    await vibe.refine("Add emotional appeal to the conclusion")
    await asyncio.sleep(3)
    
    await vibe.ask("Which slides have the most content?")
    await asyncio.sleep(2)
    
    await vibe.revert_to("5 minutes ago")
    await asyncio.sleep(2)
    
    # Keep connection alive
    await asyncio.sleep(10)
    await vibe.ws.close()

# Run
asyncio.run(interactive_presentation_builder())
```

### React Hook - Interactive Session

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';

interface InteractiveCommand {
  command_type: 'structure' | 'expand' | 'refine' | 'revert' | 'query';
  command: string;
  context?: Record<string, any>;
}

interface UseInteractiveVibeDeckerOptions {
  baseUrl?: string;
  onStructureUpdate?: (structure: any) => void;
  onContentUpdate?: (slideId: number, content: any) => void;
  onSuggestions?: (suggestions: string[]) => void;
  onQueryResponse?: (answer: string, relatedSlides: number[]) => void;
}

export const useInteractiveVibeDecker = (options: UseInteractiveVibeDeckerOptions = {}) => {
  const [connected, setConnected] = useState(false);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [structure, setStructure] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const presentationIdRef = useRef<string>('');

  const baseUrl = options.baseUrl || 'wss://vibe-decker-agents-mvp10-production.up.railway.app';

  const connect = useCallback(async (presentationId?: string) => {
    presentationIdRef.current = presentationId || crypto.randomUUID();
    const url = `${baseUrl}/ws/presentations/${presentationIdRef.current}/interactive`;
    
    wsRef.current = new WebSocket(url);
    
    wsRef.current.onopen = () => {
      setConnected(true);
    };
    
    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'connected':
          setCapabilities(message.capabilities);
          break;
          
        case 'structure_update':
          setStructure(message.structure);
          setSuggestions(message.suggestions);
          options.onStructureUpdate?.(message.structure);
          break;
          
        case 'content_update':
          options.onContentUpdate?.(message.slide_id, message.content);
          break;
          
        case 'suggestions':
          setSuggestions(message.suggestions);
          options.onSuggestions?.(message.suggestions);
          break;
          
        case 'query_response':
          options.onQueryResponse?.(message.answer, message.related_slides);
          break;
          
        case 'status':
          if (message.status === 'thinking') {
            setLoading(true);
          } else {
            setLoading(false);
          }
          break;
      }
    };
    
    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };
    
    wsRef.current.onclose = () => {
      setConnected(false);
    };
    
    return presentationIdRef.current;
  }, [baseUrl, options]);

  const sendCommand = useCallback(async (command: InteractiveCommand) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }
    
    wsRef.current.send(JSON.stringify(command));
  }, []);

  // Convenience methods
  const createStructure = useCallback((topic: string, slideCount: number = 10) => {
    return sendCommand({
      command_type: 'structure',
      command: `Create a presentation about ${topic} with ${slideCount} slides`,
      context: { topic }
    });
  }, [sendCommand]);

  const expandSlides = useCallback((slideIds: number[], contentType: string = 'detailed') => {
    return sendCommand({
      command_type: 'expand',
      command: `Expand slides ${slideIds.join(', ')} with ${contentType} content`,
      context: { selected_slides: slideIds }
    });
  }, [sendCommand]);

  const refineContent = useCallback((instruction: string, slideIds?: number[]) => {
    return sendCommand({
      command_type: 'refine',
      command: instruction,
      context: slideIds ? { selected_slides: slideIds } : {}
    });
  }, [sendCommand]);

  const revert = useCallback((target: string = 'last change') => {
    return sendCommand({
      command_type: 'revert',
      command: `Revert to ${target}`,
      context: {}
    });
  }, [sendCommand]);

  const query = useCallback((question: string) => {
    return sendCommand({
      command_type: 'query',
      command: question,
      context: {}
    });
  }, [sendCommand]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // State
    connected,
    capabilities,
    structure,
    suggestions,
    loading,
    presentationId: presentationIdRef.current,
    
    // Methods
    connect,
    disconnect,
    sendCommand,
    createStructure,
    expandSlides,
    refineContent,
    revert,
    query
  };
};

// Usage in Component
const InteractivePresentationBuilder: React.FC = () => {
  const {
    connected,
    structure,
    suggestions,
    loading,
    connect,
    createStructure,
    expandSlides,
    refineContent,
    query
  } = useInteractiveVibeDecker({
    onStructureUpdate: (structure) => {
      console.log('Structure updated:', structure.title);
    },
    onQueryResponse: (answer) => {
      alert(answer);
    }
  });

  const [topic, setTopic] = useState('');

  const handleStart = async () => {
    if (!connected) {
      await connect();
    }
    await createStructure(topic, 8);
  };

  return (
    <div>
      <h2>Interactive Presentation Builder</h2>
      
      {!connected ? (
        <div>
          <input
            type="text"
            placeholder="Enter presentation topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <button onClick={handleStart}>Start Building</button>
        </div>
      ) : (
        <div>
          {loading && <p>AI is thinking...</p>}
          
          {structure && (
            <div>
              <h3>{structure.title}</h3>
              <p>{structure.total_slides} slides • {structure.estimated_duration}</p>
              
              <div>
                <h4>Actions:</h4>
                <button onClick={() => expandSlides([1, 2, 3], 'examples')}>
                  Add Examples to First 3 Slides
                </button>
                <button onClick={() => refineContent('Make it more engaging')}>
                  Make More Engaging
                </button>
                <button onClick={() => query('What is the word count?')}>
                  Check Word Count
                </button>
              </div>
              
              {suggestions.length > 0 && (
                <div>
                  <h4>AI Suggestions:</h4>
                  <ul>
                    {suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

## Future Enhancements

1. **Authentication**: API keys for user isolation
2. **Persistent storage**: Database storage for presentations
3. **Webhook support**: POST to URL on completion
4. **Export formats**: PDF, PPTX, Google Slides
5. **Templates**: Pre-designed presentation templates
6. **Collaboration**: Multi-user editing
7. **Version control**: Track presentation changes
8. **Analytics**: Usage and quality metrics
9. **Voice commands**: Natural speech input for commands
10. **AI personas**: Different AI styles (formal, creative, technical)