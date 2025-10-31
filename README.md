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

**Phase 3: Agent Core & Schema** - ✅ COMPLETE

- YAML-driven scenario definitions with JSON Schema validation
- OpenAI integration (GPT-4o-mini) with cost tracking
- Autonomous agent execution loop with success detection
- MCP client for browser and data operations
- JSONL logging for complete execution traces
- CLI runner with health checks and progress output

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

**Agent:**
- `npm run agent <scenario.yaml>` - Run an agentic test scenario

## Project Structure

```
fintech-agentic-testing/
├── apps/
│   └── web-demo/           # React demo application
├── servers/
│   ├── mcp-web/            # Playwright browser automation server
│   └── mcp-data/           # Test data factory server
├── core/
│   └── agent/              # Autonomous agent orchestration
├── scenarios/              # YAML test scenario definitions
├── out/                    # JSONL execution logs
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

## Running Agentic Tests

With Phase 3 complete, you can now run autonomous agent tests:

1. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-actual-key-here
   ```

2. **Start all services:**
   ```bash
   npm run dev                    # Terminal 1: Web demo
   npm run start:servers          # Terminal 2: MCP servers
   ```

3. **Run a scenario:**
   ```bash
   npm run agent scenarios/smoke/login-and-dashboard.yaml
   ```

The agent will autonomously navigate the application, logging each step to `out/*.jsonl`.

## Next Steps

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the complete roadmap:

- **Phase 4**: Metrics & Reporting (entropy, path analysis, HTML reports)
- **Phase 5**: Runner & Scenarios (full CLI, multiple scenarios, parallel execution)
- **Phase 6**: CI/CD & Hardening (GitHub Actions, documentation)

## Documentation

- [PROJECT_PLAN.md](./PROJECT_PLAN.md) - Complete project specification
- [PHASE2_COMPLETE.md](./PHASE2_COMPLETE.md) - Phase 2 completion report
- [PHASE3_COMPLETE.md](./PHASE3_COMPLETE.md) - Phase 3 completion report
- [docs/phase1-setup.md](./docs/phase1-setup.md) - Phase 1 setup guide
- [docs/phase2-mcp-servers.md](./docs/phase2-mcp-servers.md) - Phase 2 MCP servers guide
- [docs/phase2-test-results.md](./docs/phase2-test-results.md) - Phase 2 test results
- [docs/phase3-agent-core.md](./docs/phase3-agent-core.md) - Phase 3 agent core guide
- [apps/web-demo/README.md](./apps/web-demo/README.md) - Web demo documentation

## License

MIT

