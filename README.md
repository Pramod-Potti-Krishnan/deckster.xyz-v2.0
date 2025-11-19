# Deckster Frontend

> AI-Powered Presentation Builder with Multi-Agent Collaboration

Deckster is a Next.js application that leverages a multi-agent AI system to create professional presentations. Watch specialized AI agents (Director, Scripter, Graphic Artist, Data Visualizer) collaborate in real-time to transform your ideas into compelling slide decks.

## Quick Start

### Prerequisites
- Node.js 18.17 or later
- pnpm package manager
- PostgreSQL database
- Google OAuth credentials

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run database migrations
npx prisma migrate dev

# Start development server
pnpm dev
```

Visit `http://localhost:3000` to see the application.

## Tech Stack

- **Framework**: Next.js 15.2.4 (App Router)
- **Language**: TypeScript
- **UI**: React 19 + Tailwind CSS + shadcn/ui
- **Authentication**: NextAuth.js with Google OAuth
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: WebSocket connections to AI agents
- **Forms**: React Hook Form + Zod validation
- **Package Manager**: pnpm

## Key Features

- **Multi-Agent AI System**: Director orchestrates, Scripter writes, Graphic Artist designs, Data Visualizer creates charts
- **Real-Time Collaboration**: WebSocket-based communication with transparent agent activity
- **Dual-Pane Interface**: Chat with AI on the left, live slide preview/editing on the right
- **Living Canvas**: Interactive slide editing with inline modifications
- **Chain of Thought Visualizer**: See exactly what each agent is thinking and doing
- **Session Management**: Save, resume, and manage multiple presentation projects
- **Downloads Integration**: Export presentations to PowerPoint, PDF, and Google Slides

## Project Structure

```
deckster-frontend/
├── app/                    # Next.js App Router pages
│   ├── builder/           # Main presentation builder
│   ├── auth/              # Authentication pages
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Layout components (Header, Footer)
│   └── marketing/         # Landing page components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries and configurations
├── docs/                  # Documentation (see docs/README.md)
├── prisma/                # Database schema and migrations
└── public/                # Static assets
```

## Documentation

Comprehensive documentation is available in the `/docs` directory:

- [Getting Started Guide](docs/getting-started/) - Setup and onboarding
- [API Reference](docs/api/) - Backend service integration
- [Architecture](docs/architecture/) - System design and patterns
- [Deployment Guide](docs/deployment/) - Production deployment
- [Integration Guides](docs/integrations/) - Third-party services

For a complete documentation index, see [docs/README.md](docs/README.md).

## Development

### Available Commands

```bash
pnpm dev          # Start development server (port 3000)
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm type-check   # Run TypeScript compiler check
```

### Environment Variables

Required environment variables:

```bash
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"

# API Endpoints
NEXT_PUBLIC_API_BASE_URL="https://your-api-url"
NEXT_PUBLIC_WS_BASE_URL="wss://your-websocket-url"
```

See [docs/getting-started/environment-setup.md](docs/getting-started/environment-setup.md) for detailed configuration.

## Architecture Highlights

### Multi-Agent System
- **Director**: Orchestrates the presentation creation workflow
- **Scripter**: Generates slide content and speaker notes
- **Graphic Artist**: Creates visual elements and designs
- **Data Visualizer**: Builds charts and data visualizations
- **Layout Architect**: Optimizes slide layouts

### Real-Time Communication
- WebSocket connections with heartbeat/ping-pong keep-alive
- Message deduplication and ordering
- Automatic reconnection with state recovery
- Session persistence in PostgreSQL

### Authentication Flow
- NextAuth.js with JWT strategy
- Google OAuth 2.0 (select_account prompt)
- Session-based approval system
- Development bypass for testing

## Deployment

The application is production-ready and can be deployed to:
- Vercel (recommended)
- Railway
- Any Node.js hosting platform

See [docs/deployment/](docs/deployment/) for platform-specific guides.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Known Issues

See [docs/issues-and-fixes/](docs/issues-and-fixes/) for:
- Troubleshooting guides
- Known bugs and workarounds
- Issue reports and fixes

## License

[Add your license here]

## Support

For questions or issues:
- Check [docs/README.md](docs/README.md) for documentation
- Review [docs/issues-and-fixes/](docs/issues-and-fixes/) for common problems
- [Open an issue](https://github.com/your-org/deckster-frontend/issues) on GitHub

---

Built with [Next.js](https://nextjs.org) | Powered by AI
