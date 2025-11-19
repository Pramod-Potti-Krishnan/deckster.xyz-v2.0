# API Reference

Documentation for backend service integration and protocols.

## Available Documentation

- [Director Service API](director-service.md) - Main AI orchestration service
- [Layout Service API](layout-service.md) - Slide layout optimization service
- [Downloads Service API](downloads-service.md) - Presentation export service (v7.5)
- [WebSocket Protocol](websocket-protocol.md) - Real-time communication specification

## Service Architecture

Deckster uses a microservices architecture:

```
┌─────────────────┐
│  Frontend       │
│  (Next.js)      │
└────────┬────────┘
         │
         ├──────────────┐
         │              │
    ┌────▼────┐    ┌────▼────┐
    │ Director│    │Downloads│
    │ Service │    │ Service │
    └────┬────┘    └─────────┘
         │
    ┌────▼────┐
    │ Layout  │
    │ Service │
    └─────────┘
```

## Service Endpoints

### Production
- Director: `https://vibe-decker-agents-mvp10-production.up.railway.app`
- Downloads: `https://downloads-service-production.up.railway.app`
- Layout: (integrated in Director)

### WebSocket
- Director WS: `wss://vibe-decker-agents-mvp10-production.up.railway.app/ws/slides/{sessionId}`

## Authentication

All API requests include:
- Session ID in URL path or query parameters
- User ID in request body (where applicable)

## Common Patterns

### REST API Calls
```typescript
const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, sessionId, ...data })
})
```

### WebSocket Connection
```typescript
const ws = new WebSocket(`${WS_BASE_URL}/ws/slides/${sessionId}`)

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'init', sessionId }))
}

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  // Handle message based on type
}
```

## Error Handling

All services return consistent error formats:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* additional context */ }
}
```

---

[Back to Documentation Index](../README.md)
