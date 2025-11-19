# Architecture Documentation

Technical architecture and design patterns used in Deckster.

## Available Documentation

- [Multi-Agent System](multi-agent-system.md) - How AI agents collaborate
- [Frontend Architecture](frontend-overview.md) - Component structure and patterns
- [Authentication Flow](authentication.md) - NextAuth.js implementation
- [State Management](state-management.md) - React hooks and patterns

## System Overview

Deckster is built on a multi-agent AI architecture where specialized agents collaborate to create presentations:

```
User Input → Director → Scripter → Layout → Graphic Artist → Data Viz → Output
                ↓
         Orchestration
```

### Key Agents

1. **Director**: Orchestrates the entire workflow, makes high-level decisions
2. **Scripter**: Generates slide content and speaker notes
3. **Layout Architect**: Optimizes slide layouts for visual hierarchy
4. **Graphic Artist**: Creates visual elements and designs
5. **Data Visualizer**: Builds charts and data visualizations

## Frontend Architecture

### Component Hierarchy
```
App (Next.js)
├── Layout Components (Header, Footer)
├── Page Components (Landing, Builder, Dashboard)
├── Feature Components (Chat, Canvas, Sidebar)
└── UI Components (shadcn/ui primitives)
```

### State Flow
```
User Action → Component State → WebSocket → Backend
                                    ↓
Backend Response → State Update → UI Re-render
```

## Technology Stack

### Core
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type safety and developer experience
- **React 19**: Latest React features and patterns

### UI & Styling
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Accessible component primitives
- **Radix UI**: Unstyled accessible components

### Data & Auth
- **Prisma**: Type-safe database ORM
- **PostgreSQL**: Primary database
- **NextAuth.js**: Authentication with OAuth

### Real-Time
- **WebSocket**: Direct WebSocket connections
- **Message Protocol**: Custom JSON-based protocol

## Design Principles

1. **Transparency**: Users see exactly what agents are doing
2. **Real-Time Feedback**: Immediate visual updates during generation
3. **Type Safety**: TypeScript throughout for reliability
4. **Component Composition**: Small, reusable components
5. **Progressive Enhancement**: Works without JavaScript (where possible)

## Key Patterns

### Custom Hooks
Encapsulate complex logic:
- `use-deckster-websocket-v2.ts`: WebSocket management
- `use-auth.ts`: Authentication wrapper

### Client Components
Most components use `"use client"` for interactivity:
- Real-time updates require client-side state
- WebSocket connections need browser APIs

### Session Management
- Sessions persisted in PostgreSQL
- Real-time state in React hooks
- Automatic session recovery on reconnect

---

[Back to Documentation Index](../README.md)
