# deckster.xyz Builder Interface - UX Specification Document

## Executive Summary

The deckster.xyz builder interface represents a revolutionary approach to AI-powered presentation creation, featuring a sophisticated dual-pane interface that visualizes multi-agent collaboration in real-time. This document serves as a comprehensive guide to recreate the interface, capturing every design decision, interaction pattern, and visual element that makes the experience unique.

### Core Design Philosophy

1. **Transparency**: Users see AI agents working together, not a black box
2. **Real-time Collaboration**: Live updates as content is generated
3. **Professional Simplicity**: Clean, modern interface that doesn't overwhelm
4. **Adaptive Workspace**: Flexible layout that adjusts to user needs

### Key Innovations

- **Dual-pane Interface**: Mission Control (chat) + Living Canvas (slides)
- **Multi-agent Visualization**: Four specialized AI agents with distinct roles
- **Draggable Divider**: User-controlled workspace proportions
- **Phase-based Generation**: Progressive enhancement from structure to content
- **Meta-content Display**: Narrative purpose, engagement hooks, visual suggestions

## Visual Design System

### Color Palette

```css
/* Primary Brand Colors */
--primary-purple: #9333EA;  /* Purple 600 */
--primary-blue: #2563EB;    /* Blue 600 */
--gradient-start: #9333EA;  /* from-purple-600 */
--gradient-end: #2563EB;    /* to-blue-600 */

/* Background Colors */
--bg-primary: #FFFFFF;      /* White */
--bg-secondary: #F8FAFC;    /* Slate 50 */
--bg-tertiary: #F1F5F9;     /* Slate 100 */

/* Text Colors */
--text-primary: #1E293B;    /* Slate 800 */
--text-secondary: #475569;  /* Slate 600 */
--text-muted: #94A3B8;      /* Slate 400 */

/* Border Colors */
--border-primary: #E2E8F0;  /* Slate 200 */
--border-hover: #CBD5E1;    /* Slate 300 */

/* Agent Colors */
--agent-director: {
  bg: #F3E8FF;      /* Purple 100 */
  text: #6B21A8;    /* Purple 700 */
}
--agent-scripter: {
  bg: #DBEAFE;      /* Blue 100 */
  text: #1E40AF;    /* Blue 700 */
}
--agent-graphic: {
  bg: #D1FAE5;      /* Green 100 */
  text: #047857;    /* Green 700 */
}
--agent-data: {
  bg: #FED7AA;      /* Orange 100 */
  text: #C2410C;    /* Orange 700 */
}

/* Status Colors */
--status-success: #10B981;  /* Green 500 */
--status-warning: #F59E0B;  /* Yellow 500 */
--status-error: #EF4444;    /* Red 500 */
--status-info: #3B82F6;     /* Blue 500 */

/* Meta-content Colors */
--narrative-bg: #D1FAE5;    /* Green 50 */
--narrative-border: #34D399; /* Green 200 */
--narrative-text: #047857;   /* Green 700 */

--engagement-bg: #DBEAFE;    /* Blue 50 */
--engagement-border: #60A5FA; /* Blue 200 */
--engagement-text: #1E40AF;   /* Blue 700 */

--visual-bg: #F9FAFB;        /* Gray 50 */
--visual-border: #E5E7EB;    /* Gray 200 */
--visual-text: #374151;       /* Gray 700 */
```

### Typography

```css
/* Font Families */
--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", monospace;

/* Font Sizes */
--text-xs: 0.75rem;     /* 12px */
--text-sm: 0.875rem;    /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg: 1.125rem;    /* 18px */
--text-xl: 1.25rem;     /* 20px */
--text-2xl: 1.5rem;     /* 24px */
--text-3xl: 1.875rem;   /* 30px */
--text-4xl: 2.25rem;    /* 36px */

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
```

### Spacing System

```css
/* Based on 4px grid */
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
```

### Border Radius

```css
--radius-sm: 0.125rem;    /* 2px */
--radius-md: 0.375rem;    /* 6px */
--radius-lg: 0.5rem;      /* 8px */
--radius-xl: 0.75rem;     /* 12px */
--radius-full: 9999px;    /* Full circle */
```

### Shadows

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
```

## Layout Architecture

### Overall Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                          Header (64px)                          │
├─────────────────────────┬───┬───────────────────────────────────┤
│                         │ D │                                   │
│    Mission Control      │ I │        Living Canvas              │
│       (Chat)           │ V │         (Slides)                  │
│                         │ I │                                   │
│    Default: 25%        │ D │      Default: 75%                │
│    Min: 300px          │ E │      Min: 400px                 │
│    Max: 80%            │ R │      Max: 90%                   │
│                         │   │                                   │
└─────────────────────────┴───┴───────────────────────────────────┘
```

### Header Component (64px height)

```
┌─────────────────────────────────────────────────────────────────┐
│ [≡] [Logo] deckster.xyz | New Presentation [History] [API Test] │ [Settings] [Share] [Export] | [Status] [Profile]
└─────────────────────────────────────────────────────────────────┘
```

**Left Section:**
- Hamburger menu (24x24) - Opens project sidebar
- Logo (32x32) - Purple-to-blue gradient with Sparkles icon
- Brand name - Font-semibold, text-xl
- Separator (vertical, 24px height)
- Presentation title - text-sm, text-slate-600
- History button - Ghost variant with History icon
- API Test button - Ghost variant with Zap icon

**Right Section:**
- Settings button - Outline variant with Settings icon
- Share button - Outline variant with Share icon
- Export button - Default variant with Download icon
- Separator (vertical, 24px height)
- Connection status (conditional) - Custom component
- User profile menu - Avatar with dropdown

### Mission Control (Left Pane)

```
┌─────────────────────────────────────────┐
│ Mission Control                    [⧉]  │
│ Chat with The Director to guide...      │
├─────────────────────────────────────────┤
│ Agent Status                            │
│ ┌─────────────┐ ┌─────────────┐        │
│ │ Director    │ │ Scripter    │        │
│ │ [thinking]  │ │ [idle]      │        │
│ └─────────────┘ └─────────────┘        │
│ ┌─────────────┐ ┌─────────────┐        │
│ │ Graphic     │ │ Data Viz    │        │
│ │ [idle]      │ │ [idle]      │        │
│ └─────────────┘ └─────────────┘        │
├─────────────────────────────────────────┤
│ Attachments: [📎] Drop files here...    │
├─────────────────────────────────────────┤
│                                         │
│ [Agent Avatar] The Director             │
│ ┌─────────────────────────────┐        │
│ │ Hello! I'm The Director...  │        │
│ └─────────────────────────────┘        │
│                          9:15 AM        │
│                                         │
│                    ┌──────────────────┐ │
│                    │ User message     │ │
│                    └──────────────────┘ │
│                              9:16 AM    │
│                                         │
│ [↓ Scroll Area]                         │
│                                         │
├─────────────────────────────────────────┤
│ [📎] [🌐] [Input field...] [Send]       │
│ [Internet search on] [2 files]          │
└─────────────────────────────────────────┘
```

#### Chat Header
- Title: "Mission Control" (font-semibold)
- Subtitle: "Chat with The Director to guide your presentation creation" (text-sm, text-slate-600)
- Focus toggle button (Maximize2/Minimize2 icon)

#### Agent Status Grid
- Background: bg-slate-50
- 2x2 grid layout with 8px gap
- Each agent card:
  - White background with border
  - Agent icon (24x24) with colored background
  - Agent name (truncated if needed)
  - Status badge (text-[10px])
  - Progress bar (if status is "working")

#### Chat Messages
- ScrollArea with flex-1 for dynamic height
- Message spacing: 16px (space-y-4)
- User messages: Right-aligned, purple background
- Agent messages: Left-aligned, slate-100 background
- Agent avatar and name above message
- Timestamp below message (text-xs, text-slate-500)

#### Chat Input
- Fixed height section with border-t
- File upload button (ghost, 32x32)
- Internet search toggle (changes color when active)
- Input field (min-height: 40px)
- Send button (disabled when empty or loading)
- Status badges area (min-height: 24px) with smooth transitions

### Living Canvas (Right Pane)

```
┌─────────────────────────────────────────────────┐
│ Living Canvas               [10 slides ◄] [⧉]  │
├─────────────────────────────────────────────────┤
│                                                 │
│     ┌───────────────────────────────┐  ┌─────┐ │
│     │                               │  │  1  │ │
│     │         Slide Content         │  │ ─── │ │
│     │                               │  │ Tit │ │
│     │    [Title - 36px bold]       │  │     │ │
│     │    [Content - 18px]          │  ├─────┤ │
│     │                               │  │  2  │ │
│     │    ─────────────────         │  │ ─── │ │
│     │    Narrative Purpose          │  │ Pro │ │
│     │    [Green bordered box]       │  │     │ │
│     │                               │  ├─────┤ │
│     │    Engagement Hook            │  │  3  │ │
│     │    [Blue bordered box]        │  │ ─── │ │
│     │                               │  │ Sol │ │
│     │    Suggested Visuals          │  │     │ │
│     │    [Gray bordered box]        │  ├─────┤ │
│     │                               │  │ [+] │ │
│     └───────────────────────────────┘  └─────┘ │
│                                         [◄] [►] │
└─────────────────────────────────────────────────┘
```

#### Canvas Header
- Title: "Living Canvas" (font-semibold)
- Slide count button (shows/hides navigation panel)
- Focus toggle button

#### Slide Display Area
- Padding: 32px (p-8)
- Card component with aspect ratio 16:9
- Shadow-lg for depth
- Dynamic width based on navigation panel state

#### Slide Content Structure
1. **Slide Number Badge** (absolute top-right)
   - Background: bg-gray-100
   - Text: text-gray-600
   - Padding: 12px horizontal, 4px vertical
   - Border radius: full

2. **Main Content Area**
   - Title: text-4xl, font-bold, text-center, mb-4
   - Description: text-lg, leading-relaxed, max-width 4xl
   - Additional elements filtered and rendered

3. **Meta-content Section** (border-t, pt-6)
   - Narrative Purpose (green theme)
   - Engagement Hook (blue theme)
   - Visual Suggestions (gray theme)

4. **Slide Metadata Footer**
   - Speaking time indicator
   - Content depth badge

#### Slide Navigation Panel
- Position: absolute, right-0
- Width: 160px (w-40)
- Background: white with border-l and shadow-lg
- Transition: translateX animation (300ms)
- Components:
  - Header with slide counter and unpin button
  - ScrollArea with slide thumbnails
  - Each thumbnail shows number, title, and content preview
  - Active slide highlighted with purple border
  - "Add Slide" button at bottom
  - Navigation arrows in footer

### Draggable Divider

```css
.divider {
  width: 4px;
  background: #E2E8F0; /* slate-200 */
  cursor: col-resize;
  position: relative;
}

.divider:hover {
  background: #CBD5E1; /* slate-300 */
}

.divider-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 32px;
  background: #94A3B8; /* slate-400 */
  border-radius: 9999px;
  opacity: 0;
  transition: opacity 150ms;
}

.divider:hover .divider-handle {
  opacity: 1;
}
```

## Core Components

### Agent Status Card

```typescript
interface AgentStatusProps {
  agent: "director" | "scripter" | "graphic-artist" | "data-visualizer"
  status: "idle" | "thinking" | "working" | "completed"
  task: string
  progress: number
}
```

Visual States:
- **Idle**: Gray border, "idle" badge
- **Thinking**: Blue border, animated pulse, "thinking" badge
- **Working**: Blue border, progress bar, "working" badge
- **Completed**: Green border, checkmark, "completed" badge

### Message Bubble

```typescript
interface MessageProps {
  type: "user" | "agent"
  agent?: AgentType
  content: string
  timestamp: Date
}
```

Styling:
- **User Message**: 
  - Background: bg-purple-600
  - Text: white
  - Border radius: rounded-lg
  - Max width: 80%
  - Alignment: right

- **Agent Message**:
  - Background: bg-slate-100
  - Text: text-slate-900
  - Agent avatar and name above
  - Border radius: rounded-lg
  - Max width: 80%
  - Alignment: left

### Enhanced Chat Input

Features:
1. **File Upload Button**
   - Ghost variant, 32x32
   - Shows badge with count when files attached
   - Accepts multiple file types

2. **Internet Search Toggle**
   - Changes color when active (green)
   - Shows tooltip on hover

3. **Text Input**
   - Minimum height: 40px
   - Placeholder: "Describe your presentation or ask for changes..."
   - Disabled during loading

4. **Send Button**
   - Height: 40px
   - Disabled when input empty or loading
   - Send icon (16x16)

5. **Status Badges Area**
   - Fixed height: 24px (prevents layout shift)
   - Smooth opacity transitions
   - Shows internet search and file count badges

### Meta-content Components

#### Narrative Purpose
```
┌─────────────────────────────────────────┐
│ NARRATIVE PURPOSE                       │
│ ─────────────────                       │
│ This slide establishes the context and  │
│ sets expectations for the audience.     │
└─────────────────────────────────────────┘
```
- Background: bg-green-50
- Border: border-green-200
- Title: uppercase, tracking-wide, text-green-800
- Content: text-green-700

#### Engagement Hook
```
┌─────────────────────────────────────────┐
│ ENGAGEMENT HOOK                         │
│ ─────────────────                       │
│ "Have you ever wondered how to make     │
│ your presentations more impactful?"     │
└─────────────────────────────────────────┘
```
- Background: bg-blue-50
- Border: border-blue-200
- Title: uppercase, tracking-wide, text-blue-800
- Content: italic, text-blue-700

#### Visual Suggestions
```
┌─────────────────────────────────────────┐
│ SUGGESTED VISUALS                       │
│ ─────────────────                       │
│ [📷] IMAGE                              │
│      Professional header image          │
│      Purpose: Set professional tone     │
│                                         │
│ [📊] CHART                              │
│      Problem impact statistics          │
│      Purpose: Visualize scale           │
└─────────────────────────────────────────┘
```
- Background: bg-gray-50
- Border: border-gray-200
- Each suggestion in white box with gray-100 border
- Icon based on type (Image, Chart, Video, etc.)

## Interactive Features

### WebSocket Integration

Real-time features powered by WebSocket:
1. **Connection Status Indicator**
   - Shows connection state (connecting, connected, error)
   - Retry button on error
   - Positioned in header

2. **Live Message Updates**
   - Messages appear instantly
   - Typing indicators during AI processing
   - Status updates ("thinking", "working")

3. **Progressive Slide Generation**
   - Phase 1: Basic structure
   - Phase 2: Enhanced with meta-content
   - Live updates as content generates

### Drag-to-Resize

Implementation:
```javascript
// Mouse down on divider
- Store initial mouse position
- Store current split percentage
- Add mousemove and mouseup listeners

// Mouse move
- Calculate delta from initial position
- Update split percentage
- Constrain between min/max values

// Mouse up
- Remove event listeners
- Store final split position
```

Constraints:
- Minimum pane width: 300px (chat), 400px (canvas)
- Maximum: 80% for chat, 90% for canvas

### Focus/Minimize Modes

Three view states:
1. **Normal**: Both panes visible with adjustable split
2. **Chat Focused**: Chat takes 100%, canvas hidden
3. **Canvas Focused**: Canvas takes 100%, chat hidden

Transitions:
- Duration: 300ms
- Easing: ease-in-out
- Smooth width animations

### Slide Navigation

Features:
1. **Thumbnail Navigation**
   - Click to jump to any slide
   - Active slide highlighted
   - Shows slide number and title preview

2. **Arrow Navigation**
   - Previous/Next buttons
   - Disabled at boundaries
   - Keyboard support (arrow keys)

3. **Pin/Unpin Panel**
   - Toggles slide panel visibility
   - Adjusts main content width
   - Smooth slide transition

## AI Agent System

### Four Specialized Agents

1. **The Director** (Purple)
   - Icon: Users
   - Role: Orchestrates overall presentation
   - Colors: bg-purple-100, text-purple-700

2. **The Scripter** (Blue)
   - Icon: MessageSquare
   - Role: Writes content and narrative
   - Colors: bg-blue-100, text-blue-700

3. **The Graphic Artist** (Green)
   - Icon: Palette
   - Role: Designs visual elements
   - Colors: bg-green-100, text-green-700

4. **The Data Visualizer** (Orange)
   - Icon: BarChart3
   - Role: Creates charts and data visuals
   - Colors: bg-orange-100, text-orange-700

### Status Visualization

Agent cards show:
- Agent icon with colored background
- Agent name (without "The")
- Current status badge
- Task description (when active)
- Progress bar (when working)

Status transitions:
- Idle → Thinking → Working → Completed
- Smooth animations between states
- Progress bar fills during work

## Content Generation Workflow

### Phase 1: Discovery
```
User: "I need a presentation about climate change"
Director: "I'll help you create that. Who's your audience?"
[Agent Status: Director - thinking]
```

### Phase 2: Requirements Gathering
```
Director: "What's the main goal? How long should it be?"
User: "20 minutes for high school students, educational"
[Agent Status: Director - working]
```

### Phase 3: Structure Creation
```
Director: "Creating your presentation structure..."
[Progress bar animation]
[Slides appear with basic titles/descriptions]
```

### Phase 4: Review & Approval
```
Director: "I've created a 10-slide structure. Review?"
User: "Looks good"
[Structure displayed in canvas]
```

### Phase 5: Enhancement
```
Scripter: "Enhancing with narrative elements..."
[Meta-content appears for each slide]
[Agent Status: Scripter - working]
```

## Error States and Recovery

### Connection Errors
```
┌─────────────────────────────────────────┐
│ ⚠️ Connection Lost                      │
│ Unable to connect to AI services        │
│ [Retry] [Work Offline]                  │
└─────────────────────────────────────────┘
```

### Generation Errors
```
Director: "I had trouble understanding that request. 
Could you provide more details about your presentation topic?"
```

### Empty States

**No Slides:**
```
[Sparkles Icon]
No slides yet

Start by describing your presentation in Mission Control,
and the AI team will generate slides for you.
```

**No Messages:**
```
The Director: "Hello! I'm The Director, and I'll be 
orchestrating your presentation creation. What would 
you like to create today?"
```

## Accessibility Features

### Keyboard Navigation
- Tab through all interactive elements
- Arrow keys for slide navigation
- Enter to send messages
- Escape to close dialogs

### ARIA Labels
```html
<button aria-label="Toggle focus mode">
<div role="status" aria-live="polite">
<input aria-label="Message input">
```

### Color Contrast
- All text meets WCAG AA standards
- Important actions use high contrast
- Status indicators have text labels

### Loading States
```
[Spinner Animation]
Creating your presentation...

[Progress Bar]
Generating slides: 60%
```

## Performance Optimizations

### Lazy Loading
- Slides load as needed
- Images load on viewport entry
- Heavy components code-split

### Memoization
- Agent status calculations cached
- Message rendering optimized
- Slide updates granular

### Debouncing
- Resize events debounced (100ms)
- Input changes debounced (300ms)
- Scroll events throttled

## Best Practices

### Component Composition
```typescript
// Prefer composition over inheritance
<SlideDisplay>
  <SlideHeader />
  <SlideContent />
  <SlideMetaContent />
  <SlideFooter />
</SlideDisplay>
```

### State Management
- Local state for UI (useState)
- Refs for values needed in effects
- Context for cross-component state
- No global state library needed

### Error Boundaries
```typescript
<WebSocketErrorBoundary>
  <BuilderInterface />
</WebSocketErrorBoundary>
```

### Type Safety
- Full TypeScript coverage
- Strict null checks
- Exhaustive type checking

## Implementation Checklist

### Phase 1: Foundation
- [ ] Set up Next.js with TypeScript
- [ ] Install Tailwind CSS and shadcn/ui
- [ ] Create color system and design tokens
- [ ] Set up base layout structure

### Phase 2: Core Components
- [ ] Build header with navigation
- [ ] Create dual-pane layout
- [ ] Implement draggable divider
- [ ] Add focus/minimize functionality

### Phase 3: Chat Interface
- [ ] Create message components
- [ ] Build agent status grid
- [ ] Implement chat input with attachments
- [ ] Add WebSocket connection

### Phase 4: Canvas Interface
- [ ] Build slide display component
- [ ] Create slide navigation panel
- [ ] Implement meta-content sections
- [ ] Add empty states

### Phase 5: Integration
- [ ] Connect WebSocket events
- [ ] Implement real-time updates
- [ ] Add error handling
- [ ] Test complete workflow

### Phase 6: Polish
- [ ] Add animations and transitions
- [ ] Implement keyboard shortcuts
- [ ] Ensure accessibility
- [ ] Performance optimization

## Conclusion

The deckster.xyz builder interface represents a new paradigm in AI-assisted content creation. By visualizing the collaborative process between specialized AI agents and maintaining a clean, professional design, it creates an experience that is both powerful and approachable. This specification provides all the details necessary to recreate this sophisticated interface, from the gradient logo to the real-time WebSocket updates.

Key takeaways:
1. **Visual Hierarchy**: Clear separation between control (chat) and output (canvas)
2. **Real-time Feedback**: Users see progress at every step
3. **Professional Polish**: Attention to micro-interactions and transitions
4. **Flexible Workspace**: Adapts to different working styles
5. **Transparent Process**: No black box - see how AI creates content

With this specification, any developer can recreate the deckster.xyz builder experience, maintaining the high standards of user experience that make it unique in the presentation creation space.