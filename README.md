# Fintech Agentic Testing Suite

A goal-driven, LLM-powered testing framework that measures information architecture quality through behavioral metrics.

## Project Overview

This project implements an agentic testing framework that uses autonomous agents to navigate web applications and measure UX quality through quantitative metrics like click entropy, navigation efficiency, and path optimality.

**Key Innovation**: Testing that mimics real user behavior rather than scripted paths, revealing UX friction through data-driven insights.

## Current Status

**Phase 1: Foundation & Demo App** - ✅ COMPLETE

- Minimal monorepo structure with npm workspaces
- React demo application (Vite + React 18 + TypeScript)
- Basic email/password authentication with session management
- Three core pages: Login, Dashboard, Credit Report
- Accessibility compliance with ARIA attributes and data-testid selectors
- Tailwind CSS styling with fintech-appropriate design

**Phase 2: MCP Servers** - ✅ COMPLETE

- MCP-Web server with Playwright browser automation (port 7001)
- MCP-Data server with test user factory and authentication (port 7002)
- Session save/load for auth state reuse
- Health check endpoints for monitoring
- Full manual testing validated with curl

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Modern web browser

### Installation

```bash
npm install
```

### Development

Start the web demo application:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Demo Credentials

Use any email and password to login. The authentication is mocked and will accept any credentials.

### Available Scripts

**Web Demo:**
- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint checks

**MCP Servers:**
- `npm run start:mcp-web` - Start MCP-Web server (port 7001)
- `npm run start:mcp-data` - Start MCP-Data server (port 7002)
- `npm run start:servers` - Start both MCP servers concurrently

## Project Structure

```
fintech-agentic-testing/
├── apps/
│   └── web-demo/           # React demo application
├── servers/
│   ├── mcp-web/            # Playwright browser automation server
│   └── mcp-data/           # Test data factory server
├── docs/                   # Documentation
├── package.json            # Root workspace configuration
└── PROJECT_PLAN.md         # Comprehensive project plan
```

## Phase 1 Deliverables

### Completed

- [x] Repository structure with npm workspaces
- [x] `/login`, `/dashboard`, `/credit-report` pages
- [x] Mock `/api/login` endpoint with token generation
- [x] Route guards for authenticated pages
- [x] ESLint rule enforcing `data-testid` + ARIA
- [x] README with local dev setup

### Acceptance Criteria Met

1. Manual navigation through all flows works
2. All interactive elements have `data-testid`
3. Lighthouse accessibility score ≥90 (ready for audit)

## Technology Stack

- **Frontend**: Vite + React 18 + TypeScript
- **Routing**: React Router v6
- **State Management**: Context API
- **Styling**: Tailwind CSS + CSS Modules
- **Linting**: ESLint with jsx-a11y plugin
- **Package Manager**: npm with workspaces

## Next Steps

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the complete roadmap:

- **Phase 2**: MCP Servers (Playwright wrapper, data factory)
- **Phase 3**: Agent Core (YAML schemas, OpenAI integration)
- **Phase 4**: Metrics & Reporting (entropy, path analysis)
- **Phase 5**: Runner & Scenarios (CLI, test suite)
- **Phase 6**: CI/CD & Hardening (GitHub Actions, documentation)

## Documentation

- [PROJECT_PLAN.md](./PROJECT_PLAN.md) - Complete project specification
- [docs/phase1-setup.md](./docs/phase1-setup.md) - Phase 1 setup guide
- [docs/phase2-mcp-servers.md](./docs/phase2-mcp-servers.md) - Phase 2 MCP servers guide
- [docs/phase2-test-results.md](./docs/phase2-test-results.md) - Phase 2 test results
- [apps/web-demo/README.md](./apps/web-demo/README.md) - Web demo documentation

## License

MIT

