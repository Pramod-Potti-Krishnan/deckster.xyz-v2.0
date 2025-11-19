# Deckster Documentation

Welcome to the Deckster Frontend documentation. This guide will help you understand, develop, and deploy the Deckster AI-powered presentation builder.

## Documentation Index

### Getting Started
New to Deckster? Start here:
- [Content Guide](getting-started/content-guide.md) - How to create effective presentations
- [Environment Setup](getting-started/environment-setup.md) - Local development configuration
- [Quick Start](getting-started/quick-start.md) - Get up and running in 5 minutes

### Deployment
Production deployment guides:
- [Vercel Deployment](deployment/vercel.md) - Deploy to Vercel (recommended)
- [Railway Deployment](deployment/railway.md) - Deploy to Railway
- [Environment Variables](deployment/environment-variables.md) - Production configuration

### API Reference
Backend service integration:
- [Director Service API](api/director-service.md) - Main orchestration service
- [Layout Service API](api/layout-service.md) - Slide layout optimization
- [Downloads Service API](api/downloads-service.md) - Presentation export functionality
- [WebSocket Protocol](api/websocket-protocol.md) - Real-time communication spec

### Architecture
System design and technical decisions:
- [Multi-Agent System](architecture/multi-agent-system.md) - How AI agents collaborate
- [Frontend Architecture](architecture/frontend-overview.md) - Component structure and patterns
- [Authentication Flow](architecture/authentication.md) - NextAuth.js implementation
- [State Management](architecture/state-management.md) - React hooks and patterns

### Integration Guides
Connect external services:
- [Google OAuth Setup](integrations/google-oauth.md) - Configure Google sign-in
- [Database Setup](integrations/database-setup.md) - PostgreSQL and Prisma
- [Director v3.4 Integration](integrations/director-v3.4.md) - Latest Director service
- [Downloads Integration](integrations/downloads-service.md) - v7.5 export service

### Developer Guides
Step-by-step implementation guides:
- [Adding Content Types](guides/adding-content.md) - Extend slide content capabilities
- [Action Buttons](guides/action-buttons.md) - Add user interface controls
- [WebSocket Debugging](guides/websocket-debugging.md) - Debug real-time connections
- [Session Management](guides/session-management.md) - Handle user sessions

### Technical Notes
In-depth technical documentation:
- [Migration Guides](technical-notes/migration-guide.md) - Upgrade between versions
- [Frontend Corrections](technical-notes/frontend-corrections.md) - Historical fixes
- [Implementation Summaries](technical-notes/implementation-summary.md) - Feature implementations
- [Team Briefings](technical-notes/team-briefing.md) - Development updates

### Issues and Fixes
Troubleshooting and known issues:
- [Strawman Loop Issue](issues-and-fixes/strawman-loop.md) - Director regeneration problem
- [Preview ID Fix](issues-and-fixes/preview-presentation-id.md) - Google Slides preview
- [Authentication Issues](issues-and-fixes/authentication.md) - OAuth and session problems
- [WebSocket Disconnections](issues-and-fixes/websocket-disconnections.md) - Connection stability

### Planning Documents
Product roadmap and feature planning:
- [Credibility Features](planning/credibility-features.md) - Trust-building features roadmap
- [Director v2.0 Spec](planning/director-v2.0/) - Next-generation Director service

### Archive
Deprecated or historical documentation:
- [Old Integration Guides](archive/old-integration-guides.md)
- [Deprecated Screenshots](archive/screenshots/)
- [Outdated Plans](archive/old-plans/)

## Quick Navigation by Role

### For Developers
1. Start with [Getting Started](getting-started/)
2. Review [Architecture](architecture/) to understand the system
3. Use [API Reference](api/) for backend integration
4. Check [Developer Guides](guides/) for specific tasks

### For DevOps/Deployment
1. Review [Deployment Guides](deployment/)
2. Configure [Environment Variables](deployment/environment-variables.md)
3. Check [Integration Guides](integrations/) for third-party services

### For Troubleshooting
1. Search [Issues and Fixes](issues-and-fixes/)
2. Review [Technical Notes](technical-notes/) for implementation details
3. Check [WebSocket Debugging Guide](guides/websocket-debugging.md)

### For Product/Planning
1. Review [Planning Documents](planning/)
2. Check [Credibility Features Roadmap](planning/credibility-features.md)
3. See [Director v2.0 Spec](planning/director-v2.0/)

## Documentation Standards

### File Naming
- Use kebab-case: `my-document.md`
- Be descriptive: `websocket-debugging.md` not `ws.md`
- Include version numbers when relevant: `director-v3.4.md`

### Document Structure
All documentation should include:
1. Title and brief description
2. Table of contents (for long docs)
3. Clear sections with headings
4. Code examples where applicable
5. Last updated date

### Categories
- **getting-started**: Onboarding and setup
- **deployment**: Production deployment
- **api**: Backend API documentation
- **architecture**: System design
- **integrations**: Third-party services
- **guides**: Step-by-step tutorials
- **technical-notes**: In-depth technical docs
- **issues-and-fixes**: Troubleshooting
- **planning**: Roadmaps and specs
- **archive**: Deprecated content

## Contributing to Documentation

When adding or updating documentation:
1. Place in the appropriate category directory
2. Follow the file naming conventions
3. Add entry to this README index
4. Include code examples and screenshots where helpful
5. Update the "Last updated" date
6. Cross-reference related documents

## Need Help?

- Can't find what you're looking for? [Open an issue](https://github.com/your-org/deckster-frontend/issues)
- Found outdated docs? Submit a PR to update them
- Have questions? Check existing [Issues and Fixes](issues-and-fixes/)

---

Last updated: 2025-11-18
