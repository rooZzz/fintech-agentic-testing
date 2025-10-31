# Phase 2: MCP Servers Setup Guide

This guide walks through setting up and validating the Phase 2 deliverables: MCP-Web and MCP-Data servers.

## Phase 2 Overview

Phase 2 establishes the REST/HTTP server infrastructure for agentic testing by creating:
- MCP-Web server (Playwright browser automation)
- MCP-Data server (test user factory and authentication)
- Session save/load capabilities for auth state reuse
- Health check endpoints for monitoring

## Prerequisites

Before starting, ensure you have:
- Node.js 18 or higher
- npm 8 or higher
- Completed Phase 1 setup
- A modern web browser (Chrome/Chromium for Playwright)

## Setup Steps

### 1. Install Dependencies

From the project root:

```bash
npm install
```

This will install dependencies for both MCP servers including Playwright.

### 2. Install Playwright Browsers

Playwright needs to download browser binaries:

```bash
npx playwright install chromium
```

### 3. Start the Servers

You have three options:

**Option A: Start both servers together (recommended)**
```bash
npm run start:servers
```

**Option B: Start servers individually**

Terminal 1:
```bash
npm run start:mcp-web
```

Terminal 2:
```bash
npm run start:mcp-data
```

**Option C: Start in development mode with auto-reload**

Terminal 1:
```bash
npm run dev --workspace=servers/mcp-web
```

Terminal 2:
```bash
npm run dev --workspace=servers/mcp-data
```

### 4. Verify Health Checks

```bash
curl http://localhost:7001/health
curl http://localhost:7002/health
```

Expected responses:
```json
{"ok":true,"contexts":0,"timestamp":"2025-10-31T..."}
{"ok":true,"users":0,"timestamp":"2025-10-31T..."}
```

## Manual Testing with curl

### Test 1: Create Test User

```bash
curl -X POST http://localhost:7002/data/user/create \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "plus",
    "requires2FA": false
  }'
```

Expected response:
```json
{
  "userId": "a1b2c3d4-...",
  "email": "test.a1b2c3d4@example.com",
  "password": "Password123!",
  "plan": "plus",
  "requires2FA": false
}
```

Save the email and password for the next steps.

### Test 2: Navigate to Login Page

First, make sure the web demo is running:
```bash
npm run dev
```

Then navigate via MCP-Web:
```bash
curl -X POST http://localhost:7001/ui/navigate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:5173/login",
    "waitUntil": "domcontentloaded"
  }'
```

Expected response:
```json
{
  "ok": true,
  "currentUrl": "http://localhost:5173/login",
  "title": "Fintech Demo"
}
```

You should see a browser window open and navigate to the login page.

### Test 3: Query for Login Elements

```bash
curl -X POST http://localhost:7001/ui/query \
  -H "Content-Type: application/json" \
  -d '{
    "testId": "email-input"
  }'
```

Expected response:
```json
{
  "nodes": [
    {
      "id": "node_default_0",
      "role": "input",
      "name": "Email",
      "bounds": {"x": 123, "y": 456, "w": 300, "h": 40},
      "enabled": true,
      "visible": true,
      "focused": false,
      "testId": "email-input",
      "tagName": "input"
    }
  ]
}
```

### Test 4: Type Email

Replace `YOUR_EMAIL_HERE` with the email from Test 1:

```bash
curl -X POST http://localhost:7001/ui/act/type \
  -H "Content-Type: application/json" \
  -d '{
    "testId": "email-input",
    "text": "YOUR_EMAIL_HERE",
    "clear": true
  }'
```

Expected response:
```json
{
  "ok": true,
  "message": "Type successful"
}
```

### Test 5: Type Password

```bash
curl -X POST http://localhost:7001/ui/act/type \
  -H "Content-Type: application/json" \
  -d '{
    "testId": "password-input",
    "text": "Password123!",
    "clear": true
  }'
```

### Test 6: Click Login Button

```bash
curl -X POST http://localhost:7001/ui/act/click \
  -H "Content-Type: application/json" \
  -d '{
    "testId": "login-button"
  }'
```

Expected response:
```json
{
  "ok": true,
  "message": "Click successful"
}
```

The browser should navigate to the dashboard.

### Test 7: Save Session State

```bash
curl -X POST http://localhost:7001/session/save \
  -H "Content-Type: application/json" \
  -d '{
    "name": "authenticated"
  }'
```

Expected response:
```json
{
  "stateId": "state_authenticated_1730400000000",
  "path": "./sessions/state_authenticated_1730400000000.json"
}
```

Save the `stateId` for the next test.

### Test 8: Load Session State

First, navigate to login page again (which will redirect to dashboard if session is valid):

```bash
curl -X POST http://localhost:7001/session/load \
  -H "Content-Type: application/json" \
  -d '{
    "stateId": "YOUR_STATE_ID_HERE"
  }'
```

Then navigate:
```bash
curl -X POST http://localhost:7001/ui/navigate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:5173/dashboard",
    "waitUntil": "domcontentloaded"
  }'
```

The browser should load directly to the dashboard without needing to log in.

### Test 9: Observe Current Page

```bash
curl -X POST http://localhost:7001/ui/observe \
  -H "Content-Type: application/json" \
  -d '{}'
```

This returns the top 50 visible interactive elements on the current page.

### Test 10: Validate User Login via MCP-Data

```bash
curl -X POST http://localhost:7002/data/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "YOUR_EMAIL_HERE",
    "password": "Password123!"
  }'
```

Expected response:
```json
{
  "token": "eyJ1c2VySWQiOi...",
  "expiresAt": 1730400900000,
  "user": {
    "userId": "a1b2c3d4-...",
    "email": "test.a1b2c3d4@example.com"
  }
}
```

## API Reference

### MCP-Web Endpoints (Port 7001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/ui/navigate` | POST | Navigate to URL |
| `/ui/query` | POST | Find elements by selector/role/testId |
| `/ui/observe` | POST | Get all visible interactive elements |
| `/ui/act/click` | POST | Click an element |
| `/ui/act/type` | POST | Type into an input |
| `/session/save` | POST | Save browser storage state |
| `/session/load` | POST | Restore browser storage state |

### MCP-Data Endpoints (Port 7002)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/data/user/create` | POST | Create test user |
| `/data/user/login` | POST | Validate credentials and get token |
| `/data/user/get` | POST | Retrieve user by ID or email |
| `/data/reset` | POST | Clear all test users |

## Troubleshooting

### Port Already in Use

If ports 7001 or 7002 are already in use, you'll need to change the PORT constant in:
- `servers/mcp-web/src/index.ts`
- `servers/mcp-data/src/index.ts`

### Playwright Browser Fails to Launch

Ensure browsers are installed:
```bash
npx playwright install chromium
```

On Linux, you may need additional dependencies:
```bash
npx playwright install-deps chromium
```

### Browser Window Doesn't Appear

The browser is set to `headless: false` in `servers/mcp-web/src/browser.ts`. If you want headless mode, change it to `headless: true`.

### Session File Not Found

Make sure the `sessions/` directory exists. It's created automatically when you save a session, but the directory might be in the `servers/mcp-web/` folder.

## Acceptance Criteria

Phase 2 is complete when:

- [x] Both MCP servers start without errors
- [x] Health endpoints return 200 OK
- [ ] MCP-Web can navigate to localhost:5173 and query elements
- [ ] MCP-Data creates users with valid tokens
- [ ] Session save/load preserves localStorage auth
- [ ] Manual curl test completes full login flow
- [ ] Response times are <100ms for query operations

## Project Structure Created

```
servers/
├── mcp-web/
│   ├── src/
│   │   ├── index.ts           # Main Express server
│   │   ├── browser.ts         # Playwright browser manager
│   │   ├── session.ts         # Session state utilities
│   │   └── types.ts           # TypeScript interfaces
│   ├── sessions/              # Saved session states
│   ├── package.json
│   └── tsconfig.json
│
└── mcp-data/
    ├── src/
    │   ├── index.ts           # Main Express server
    │   ├── factory.ts         # User creation logic
    │   ├── auth.ts            # Token generation
    │   └── types.ts           # TypeScript interfaces
    ├── package.json
    └── tsconfig.json
```

## Next Steps

With Phase 2 complete, the next phase will:
- Implement YAML goal specification schema
- Integrate OpenAI for agent decision-making
- Build the main agent execution loop
- Add preconditions and postconditions
- Implement stagnation detection and hints

See [PROJECT_PLAN.md](../PROJECT_PLAN.md) for details on Phase 3 and beyond.

