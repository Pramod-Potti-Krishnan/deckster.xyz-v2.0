# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies (using pnpm)
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint
```

## High-Level Architecture

### Technology Stack
- **Framework**: Next.js 15.2.4 with App Router
- **UI**: React 19 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Forms**: React Hook Form + Zod validation
- **Package Manager**: pnpm

### Application Overview
Vibe Deck is a presentation/slide deck builder that uses a multi-agent AI system to generate presentations. The application features:
- Real-time WebSocket communication for live updates
- Dual-pane interface: chat with AI agents (left) and slide preview/editing (right)
- Multi-agent system: Director, Scripter, Graphic Artist, and Data Visualizer

### Key Architectural Patterns

1. **Component Architecture**
   - UI components in `/components/ui/` use Radix UI primitives with CVA for variants
   - Feature components in `/components/` handle business logic
   - All components use TypeScript for type safety

2. **State Management**
   - Local state with React hooks (no global state library)
   - Authentication stored in localStorage (mock implementation)
   - WebSocket state managed in component level

3. **API Integration**
   - Base API URL: `https://vibe-decker-agents-mvp10-production.up.railway.app`
   - REST API calls using fetch
   - WebSocket for real-time updates with ping/pong keep-alive

4. **Routing Structure**
   - `/` - Landing page
   - `/dashboard` - User dashboard
   - `/builder` - Main presentation builder with AI agents
   - `/auth/signin` & `/auth/signup` - Authentication flows
   - `/onboarding` - New user onboarding

### Important Implementation Details

1. **WebSocket Connection** (`vibe-decker-test.tsx`):
   - Handles real-time presentation generation
   - Implements reconnection logic and error handling
   - Manages agent progress and status updates

2. **Slide Management**:
   - Slides stored as array of objects with content, speaker notes, and visual description
   - Inline editing capability for all slide elements
   - Real-time preview updates

3. **Build Configuration**:
   - ESLint errors ignored during builds
   - TypeScript errors ignored during builds
   - Images are unoptimized in Next.js config

### Development Notes

- No test framework is currently set up
- Authentication is mock implementation using localStorage
- The application uses client-side rendering with "use client" directive
- All API endpoints are prefixed with `/api/`
- WebSocket endpoint: `wss://vibe-decker-agents-mvp10-production.up.railway.app/ws/slides/{connectionId}`