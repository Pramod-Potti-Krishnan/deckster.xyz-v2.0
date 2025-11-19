# Integration Guides

Documentation for integrating external services and APIs with Deckster.

## Available Guides

- [Google OAuth Setup](google-oauth.md) - Configure Google sign-in authentication
- [Database Setup](database-setup.md) - PostgreSQL and Prisma configuration
- [Director v3.4 Integration](director-v3.4.md) - Latest Director service integration
- [Downloads Service](downloads-service.md) - v7.5 presentation export service

## Third-Party Services

### Google Cloud Platform
Required for OAuth authentication:
- Google OAuth 2.0 credentials
- Redirect URIs configuration
- API scopes setup

### PostgreSQL
Database for persistent storage:
- User accounts and sessions
- Presentation data
- Authentication tokens

### Backend Services
Microservices architecture:
- Director Service (AI orchestration)
- Downloads Service (export functionality)
- Layout Service (layout optimization)

## Integration Checklist

When adding a new integration:
- [ ] Document environment variables needed
- [ ] Add configuration steps to integration guide
- [ ] Update `.env.example` with new variables
- [ ] Document API endpoints and schemas
- [ ] Add error handling patterns
- [ ] Include example code snippets
- [ ] Test in development environment
- [ ] Verify production configuration

## Environment Variables

Each integration requires specific environment variables. See individual guides for details.

### Google OAuth
```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Database
```bash
DATABASE_URL=
```

### Backend Services
```bash
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_WS_BASE_URL=
```

## Common Integration Patterns

### API Client Setup
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL

export async function callService(endpoint: string, data: any) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return response.json()
}
```

### Error Handling
```typescript
try {
  const result = await callService('/api/endpoint', data)
  return result
} catch (error) {
  console.error('Service error:', error)
  throw new Error('Failed to call service')
}
```

---

[Back to Documentation Index](../README.md)
