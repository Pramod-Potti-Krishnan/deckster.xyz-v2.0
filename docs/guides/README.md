# Developer Guides

Step-by-step guides for common development tasks and features.

## Available Guides

- [Adding Content Types](adding-content.md) - Extend slide content capabilities
- [Action Buttons](action-buttons.md) - Add user interface controls
- [WebSocket Debugging](websocket-debugging.md) - Debug real-time connections
- [Session Management](session-management.md) - Handle user sessions effectively

## Guide Categories

### Feature Development
Learn how to add new features:
- Adding new slide content types
- Creating custom UI components
- Extending AI agent capabilities

### Debugging
Troubleshooting common issues:
- WebSocket connection problems
- State synchronization issues
- Authentication flows

### Best Practices
Follow Deckster conventions:
- Component patterns
- State management
- Error handling
- Testing approaches

## Quick Reference

### Adding a New Feature
1. Read relevant architecture docs
2. Follow existing patterns in codebase
3. Add TypeScript types
4. Implement with error handling
5. Test thoroughly
6. Update documentation

### Common Tasks

#### Add a New UI Component
```typescript
// components/my-component.tsx
import { cn } from "@/lib/utils"

interface MyComponentProps {
  className?: string
  // ... other props
}

export function MyComponent({ className, ...props }: MyComponentProps) {
  return (
    <div className={cn("base-styles", className)}>
      {/* component content */}
    </div>
  )
}
```

#### Add a WebSocket Message Handler
```typescript
// In use-deckster-websocket-v2.ts
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)

  if (message.type === 'new_message_type') {
    handleNewMessageType(message)
  }
}
```

#### Add a New API Route
```typescript
// app/api/my-route/route.ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    // Process request
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process' },
      { status: 500 }
    )
  }
}
```

---

[Back to Documentation Index](../README.md)
