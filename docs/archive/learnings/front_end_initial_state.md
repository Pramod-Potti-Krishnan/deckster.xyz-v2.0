# Frontend Initial State Documentation

## Overview

This document provides a comprehensive analysis of the Deckster frontend application's current state, focusing on the core presentation builder functionality that operates through a chat-based interface. This documentation serves as a reference for integrating an external API that will provide real AI agents to replace the current mock implementation.

## 1. Architecture and Technology Stack

### 1.1 Core Technologies
- **Framework**: Next.js 15.2.4 with App Router
- **React**: Version 19
- **TypeScript**: For type safety
- **Styling**: Tailwind CSS with custom components
- **UI Components**: Radix UI primitives
- **Authentication**: NextAuth.js with Google OAuth
- **Deployment**: Vercel (production at deckster.xyz)

### 1.2 Project Structure
```
/app
  /builder        # Main presentation builder interface
  /dashboard      # User dashboard with presentations list
  /auth          # Authentication pages
  /api/auth      # NextAuth API routes
/components
  /ui            # Reusable UI components
  /attachment-panel.tsx
  /enhanced-chat-input.tsx
  /slide-element.tsx
  /version-history.tsx
  /enhanced-project-sidebar.tsx
/hooks
  /use-auth.ts   # Authentication hook
/lib
  /auth-options.ts # NextAuth configuration
```

## 2. Core Presentation Builder Features

### 2.1 Split-Pane Interface

The builder uses a sophisticated split-pane layout with the following characteristics:

#### Left Pane: "Mission Control"
- **Purpose**: Chat interface for interacting with AI agents
- **Default Width**: 25% of screen (adjustable via draggable divider)
- **Components**:
  - Chat header with description
  - Agent status grid showing 4 agents
  - Attachment panel for file uploads
  - Scrollable message history
  - Enhanced chat input with attachments and internet search toggle

#### Right Pane: "Living Canvas"
- **Purpose**: Real-time presentation preview and editing
- **Default Width**: 75% of screen
- **Components**:
  - Canvas header with slide count
  - Main slide view (16:9 aspect ratio)
  - Vertical slide navigator (pinnable)
  - Slide elements with direct editing

#### Interaction Features:
- **Draggable Divider**: Users can resize panes by dragging
- **Focus Modes**: Maximize either chat or canvas
- **Responsive**: Adapts to screen sizes

### 2.2 AI Agent System

Currently implemented as a mock system with four specialized agents:

#### Agent Definitions:
```typescript
const agentMap = {
  director: { 
    name: "The Director", 
    icon: Users, 
    color: "bg-purple-100 text-purple-700" 
  },
  scripter: { 
    name: "The Scripter", 
    icon: MessageSquare, 
    color: "bg-blue-100 text-blue-700" 
  },
  "graphic-artist": { 
    name: "The Graphic Artist", 
    icon: Palette, 
    color: "bg-green-100 text-green-700" 
  },
  "data-visualizer": { 
    name: "The Data Visualizer", 
    icon: BarChart3, 
    color: "bg-orange-100 text-orange-700" 
  }
}
```

#### Agent Status States:
- **idle**: Waiting for instructions
- **thinking**: Processing request
- **working**: Actively creating content
- **completed**: Task finished

#### Current Workflow Simulation:
1. User sends message → Director analyzes (1.5s delay)
2. Director responds with understanding
3. Scripter activated → writes content (2s delay)
4. Graphic Artist activated → designs layout (1.5s delay)
5. Final confirmation from Director

### 2.3 Data Structures

#### Message Interface:
```typescript
interface Message {
  id: string
  type: "user" | "agent"
  content: string
  timestamp: Date
  agent?: "director" | "scripter" | "graphic-artist" | "data-visualizer"
}
```

#### Slide Interface:
```typescript
interface Slide {
  id: string
  title: string
  content: string
  layout: "title" | "content" | "two-column" | "image-focus"
  elements: Array<{
    id: string
    type: "title" | "content" | "image" | "placeholder"
    content: string
    style?: {
      fontSize?: string
      fontFamily?: string
      fontWeight?: string
      fontStyle?: string
      textDecoration?: string
      textAlign?: string
      color?: string
    }
    position?: { x: number; y: number }
  }>
}
```

#### Agent Status Interface:
```typescript
interface AgentStatus {
  agent: "director" | "scripter" | "graphic-artist" | "data-visualizer"
  status: "idle" | "thinking" | "working" | "completed"
  task: string
  progress: number
}
```

### 2.4 Current Mock Implementation

The `simulateAgentWorkflow` function creates a hardcoded presentation with 4 slides:
1. **Introduction**: Title slide with welcome message
2. **Key Challenges**: Content slide
3. **Our Solution**: Two-column layout
4. **Next Steps**: Action items slide

Each slide contains 3 elements:
- Title element
- Content element
- Placeholder element (for future enhancements)

## 3. Chat System Details

### 3.1 Chat Input Features
- **Text Input**: Standard message input with Enter to send
- **File Attachments**: 
  - Multi-file upload via paperclip button
  - Supported formats: PDF, DOC, images, videos, audio, data files
  - Badge shows attachment count
- **Internet Search Toggle**: Enable/disable web search context
- **Loading State**: Disabled during message processing

### 3.2 Message Display
- **User Messages**: Right-aligned, purple background
- **Agent Messages**: Left-aligned with agent avatar and name
- **Timestamps**: Shown below each message
- **Auto-scroll**: Messages container scrolls to bottom on new message

### 3.3 Attachment Management
- Files stored in local state array
- Each attachment has: id, name, type, size, uploadedAt, url
- Visual indicators by file type (document, image, video, audio, data)
- Remove functionality for each file
- Preview and download options

## 4. Slide Editing Features

### 4.1 Direct Editing
- Click on any slide element to select
- Inline text editing with `EditableText` component
- Contextual toolbar appears on selection

### 4.2 Formatting Options
- Text styling: bold, italic, underline
- Alignment: left, center, right
- Font size adjustment
- Font family selection
- Color picker
- List formatting (bullet/numbered)

### 4.3 Slide Navigation
- Vertical thumbnail sidebar (collapsible)
- Previous/Next navigation buttons
- Add new slide functionality
- Current slide indicator
- Click thumbnail to jump to slide

## 5. Additional Features

### 5.1 Version History
- Track multiple versions of presentation
- Restore previous versions
- Version metadata: name, date, description
- Delete old versions

### 5.2 Project Management
- Organize presentations in projects/folders
- Search and filter presentations
- Presentation status: draft, in-progress, completed
- Metadata: creation date, slide count

### 5.3 Export and Sharing
- Export button (functionality not implemented)
- Share dialog for collaboration
- Settings for presentation preferences

## 6. Authentication and User Management

### 6.1 User Object Structure
```typescript
{
  id: string
  name: string
  email: string
  image?: string
  tier: "free" | "pro" | "enterprise"
  subscriptionStatus?: string
  createdAt?: Date
}
```

### 6.2 Subscription Tiers
- **Free**: 3 presentations, 2 AI agents
- **Pro**: Unlimited presentations, all 4 agents
- **Enterprise**: Everything in Pro + team features

## 7. State Management

### 7.1 Component State
All state is managed at the component level using React hooks:
- `messages`: Chat history array
- `slides`: Presentation slides array
- `agentStatuses`: Current agent states
- `attachments`: Uploaded files
- `splitPosition`: Pane divider position
- Various UI state flags (focused, loading, etc.)

### 7.2 No Persistence
- All data is lost on page refresh
- No database integration yet
- Mock data initialized in useEffect

## 8. Key Functions for API Integration

### 8.1 Message Handling
```typescript
const handleSendMessage = async () => {
  if (!inputMessage.trim() || isLoading) return
  
  const userMessage: Message = {
    id: Date.now().toString(),
    type: "user",
    content: inputMessage,
    timestamp: new Date(),
  }
  
  setMessages((prev) => [...prev, userMessage])
  setInputMessage("")
  setIsLoading(true)
  
  await simulateAgentWorkflow(inputMessage) // Replace this with API call
  setIsLoading(false)
}
```

### 8.2 Current Mock Workflow
```typescript
const simulateAgentWorkflow = async (userMessage: string) => {
  // Update agent statuses
  // Add agent messages
  // Generate slides
  // All with artificial delays
}
```

## 9. Integration Points for External API

### 9.1 Replace Mock Implementation
1. **WebSocket Connection**: For real-time agent updates
2. **API Endpoints**: 
   - POST /api/presentations/create
   - GET /api/presentations/{id}/status
   - PUT /api/presentations/{id}/slides
3. **Streaming Responses**: Progressive slide generation
4. **Error Handling**: Network failures, API errors
5. **Authentication**: Bearer token for API requests

### 9.2 Data Flow Changes
1. User message → API request with context
2. WebSocket updates → Agent status changes
3. Slide generation → Progressive updates
4. Final response → Complete presentation

### 9.3 New Features to Support
- Real-time collaboration
- Persistent storage
- Resume interrupted sessions
- Export to multiple formats
- Advanced agent capabilities

## 10. UI/UX Patterns to Maintain

### 10.1 Visual Consistency
- Agent colors and icons
- Message bubble styles
- Loading states and progress indicators
- Smooth transitions and animations

### 10.2 User Experience
- Immediate feedback on actions
- Clear agent status visibility
- Progressive disclosure of slides
- Intuitive editing interface
- Responsive design patterns

### 10.3 Error States
- Network connection issues
- API failures
- Invalid inputs
- Rate limiting
- Graceful degradation

## Conclusion

The current frontend provides a sophisticated chat-based interface for presentation creation with a well-structured component architecture. The mock implementation clearly defines the expected behavior and data structures, making it straightforward to integrate a real AI API. The key challenge will be maintaining the smooth user experience while handling the asynchronous nature of real AI processing and potential network issues.

Key files to modify for integration:
- `/app/builder/page.tsx` - Main integration point
- `simulateAgentWorkflow()` - Replace with API calls
- Add WebSocket client for real-time updates
- Implement proper error handling and retry logic
- Add persistence layer for presentations