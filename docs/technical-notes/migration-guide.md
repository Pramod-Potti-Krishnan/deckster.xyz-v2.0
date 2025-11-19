# Frontend Backend Integration Migration Guide

## Overview

This guide helps you migrate from the old WebSocket implementation to the new Deckster.xyz-compatible system.

## Breaking Changes

### 1. WebSocket URL Structure
**Old**: `/ws/presentations/${presentationId}/interactive`  
**New**: `/ws?token=${token}` or `/ws` with auth message

### 2. Message Format
**Old**: Command-based messages
```typescript
{
  command_type: "string",
  command: "string",
  context: { topic: "string" }
}
```

**New**: Structured user input messages
```typescript
{
  message_id: "string",
  timestamp: "ISO 8601",
  session_id: "string",
  type: "user_input",
  data: {
    text: "string",
    response_to: "string | null",
    attachments: [],
    ui_references: [],
    frontend_actions: []
  }
}
```

### 3. Authentication
**Old**: No WebSocket authentication  
**New**: JWT token required in connection URL or first message

### 4. State Management
**Old**: Component-level state  
**New**: Context-based state management with PresentationProvider

## Migration Steps

### Step 1: Update Environment Variables
Add the new WebSocket URL to your `.env.local`:
```
NEXT_PUBLIC_WS_URL=wss://api.deckster.xyz/ws
```

### Step 2: Update Authentication
Ensure your authentication flow provides JWT tokens:
```typescript
// In your auth configuration
export const authOptions = {
  // ...
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresIn = account.expires_in
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.refreshToken = token.refreshToken
      session.expiresIn = token.expiresIn
      return session
    }
  }
}
```

### Step 3: Wrap Your App with PresentationProvider
```typescript
// In app/builder/page.tsx or layout.tsx
import { PresentationProvider } from '@/contexts/presentation-context'

export default function BuilderPage() {
  return (
    <PresentationProvider>
      <WebSocketErrorBoundary>
        <BuilderContent />
      </WebSocketErrorBoundary>
    </PresentationProvider>
  )
}
```

### Step 4: Replace WebSocket Usage
**Old**:
```typescript
const wsService = new VibeDeckWebSocket(presentationId)
wsService.on('assistant_message', handler)
wsService.send({ command: 'chat', content: message })
```

**New**:
```typescript
const { sendMessage, isReady } = useDecksterWebSocket()
await sendMessage(message)
```

### Step 5: Update Message Handlers
**Old**:
```typescript
service.on('assistant_message', (data) => {
  setMessages(prev => [...prev, {
    content: data.content,
    agent: 'director'
  }])
})
```

**New**:
```typescript
// Messages are automatically processed into state
const { state } = usePresentation()
// Access messages via state.chatMessages
```

### Step 6: Update Error Handling
Use the new error boundary components:
```typescript
import { WebSocketErrorBoundary } from '@/components/error-boundary'

<WebSocketErrorBoundary>
  <YourComponent />
</WebSocketErrorBoundary>
```

## Feature Flags

During migration, you can use feature flags to gradually roll out changes:

```typescript
// lib/feature-flags.ts
export const FeatureFlags = {
  useNewWebSocket: () => process.env.NEXT_PUBLIC_USE_NEW_WS === 'true',
  useOptimisticUpdates: () => process.env.NEXT_PUBLIC_USE_OPTIMISTIC === 'true'
}
```

## Compatibility Layer

For gradual migration, use the compatibility layer:

```typescript
import { convertLegacyToNewMessage, convertNewToLegacyMessage } from '@/lib/types/vibe-decker-api'

// Convert old format to new
const newMessage = convertLegacyToNewMessage(legacyMessage)

// Convert new format to old (for legacy components)
const legacyMessage = convertNewToLegacyMessage(directorMessage)
```

## Testing

1. Test WebSocket connection with mock authentication:
```typescript
localStorage.setItem('mockUser', JSON.stringify({
  id: 'test-user',
  email: 'test@example.com'
}))
```

2. Verify message flow:
- Send a message and check it appears in chat
- Verify slides update when structure is generated
- Check progress tracking works

3. Test error scenarios:
- Disconnect network to test reconnection
- Invalid token to test auth errors
- Send malformed messages to test validation

## Rollback Plan

If issues arise:

1. Revert to old builder component:
```bash
mv app/builder/page-old.tsx app/builder/page.tsx
```

2. Disable new WebSocket in environment:
```
NEXT_PUBLIC_USE_REAL_API=false
```

3. Clear browser cache and localStorage

## Common Issues

### Issue: "No authentication token available"
**Solution**: Ensure user is logged in or mock auth is set up

### Issue: WebSocket connects but no messages
**Solution**: Check if backend expects different message format

### Issue: Slides not updating
**Solution**: Verify slide data structure matches new format

### Issue: Performance degradation
**Solution**: Check if optimistic updates are causing conflicts

## Support

For issues during migration:
1. Check browser console for detailed error messages
2. Enable debug mode: `localStorage.setItem('debug', 'websocket:*')`
3. Review WebSocket frames in browser DevTools
4. Check the error log: `errorHandler.getErrorLog()`