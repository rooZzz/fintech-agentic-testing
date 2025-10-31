# Phase 1 Setup Guide

This guide walks through setting up and validating the Phase 1 deliverables.

## Phase 1 Overview

Phase 1 establishes the foundation for the agentic testing framework by creating:
- Minimal monorepo structure
- React demo application
- Basic authentication system
- Three core pages with proper accessibility
- Development tooling and linting

## Prerequisites

Before starting, ensure you have:
- Node.js 18 or higher
- npm 8 or higher
- A modern web browser (Chrome, Firefox, Safari, or Edge)
- A code editor (VS Code recommended)

## Setup Steps

### 1. Clone and Install

```bash
cd /path/to/fintech-agentic-testing
npm install
```

This will install dependencies for both the root workspace and the web-demo application.

### 2. Start Development Server

```bash
npm run dev
```

The application should start at `http://localhost:5173`

### 3. Manual Testing

#### Login Flow

1. Navigate to `http://localhost:5173`
2. You should be redirected to `/login`
3. Enter any email and password (e.g., `test@example.com` / `password`)
4. Click "Sign In"
5. You should be redirected to `/dashboard`

#### Dashboard

1. Verify the credit score widget displays "742"
2. You should see 6 navigation tiles
3. Five tiles should show "Coming soon" and be disabled
4. Click the "Credit Report" tile
5. You should navigate to `/credit-report`

#### Credit Report

1. Verify the page heading is "Credit Report"
2. Check the credit score chart is visible
3. Verify 3 tradeline accounts are displayed
4. Click "Back to Dashboard"
5. You should return to `/dashboard`

#### Logout

1. From any authenticated page, click "Logout"
2. You should be redirected to `/login`
3. Try accessing `/dashboard` directly - should redirect to `/login`

### 4. Accessibility Validation

#### Check Data Test IDs

Open browser DevTools and verify these elements have `data-testid` attributes:

**Login Page:**
- `email-input`
- `password-input`
- `login-button`

**Dashboard:**
- `logout-button`
- `view-credit-report`

**Credit Report:**
- `credit-score-chart`
- `back-to-dashboard`

#### Run ESLint

```bash
npm run lint
```

Should complete with no errors.

#### Lighthouse Audit

1. Open Chrome DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Accessibility" category
4. Click "Analyze page load"
5. Verify score is ≥90

Run this for all three pages:
- `/login`
- `/dashboard`
- `/credit-report`

### 5. Build Verification

Test the production build:

```bash
npm run build
```

Should complete successfully and output to `apps/web-demo/dist/`

## Troubleshooting

### Port Already in Use

If port 5173 is already in use:

```bash
npm run dev -- --port 3000
```

### Build Fails

Ensure all dependencies are installed:

```bash
rm -rf node_modules apps/web-demo/node_modules
npm install
```

### Linting Errors

If you encounter linting errors, check:
- All interactive elements have `data-testid`
- All inputs have associated labels
- All buttons have accessible text or `aria-label`

## Acceptance Criteria

Phase 1 is complete when:

- [ ] Manual navigation through all flows works
- [ ] Login with any credentials succeeds
- [ ] Dashboard displays correctly with 6 tiles
- [ ] Credit Report page displays tradelines
- [ ] Logout returns to login page
- [ ] All interactive elements have `data-testid`
- [ ] ESLint passes with no errors
- [ ] Build completes successfully
- [ ] Lighthouse accessibility score ≥90 on all pages

## Project Structure Created

```
fintech-agentic-testing/
├── apps/
│   └── web-demo/
│       ├── src/
│       │   ├── pages/
│       │   │   ├── Login.tsx
│       │   │   ├── Dashboard.tsx
│       │   │   └── CreditReport.tsx
│       │   ├── components/
│       │   │   └── ProtectedRoute.tsx
│       │   ├── auth/
│       │   │   ├── AuthContext.tsx
│       │   │   └── AuthProvider.tsx
│       │   ├── api/
│       │   │   └── auth.ts
│       │   ├── types/
│       │   │   └── auth.ts
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── index.css
│       ├── public/
│       ├── dist/ (generated)
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       └── eslint.config.js
├── docs/
│   └── phase1-setup.md (this file)
├── package.json
├── README.md
└── PROJECT_PLAN.md
```

## Development Workflow

For ongoing development:

1. Start dev server: `npm run dev`
2. Make changes to source files
3. Hot reload will update the browser automatically
4. Run lint checks periodically: `npm run lint`
5. Test build before committing: `npm run build`

## Next Steps

With Phase 1 complete, the next phase will:
- Implement MCP-Web server with Playwright
- Implement MCP-Data server for test data
- Add session save/load capabilities
- Enable browser automation

See [PROJECT_PLAN.md](../PROJECT_PLAN.md) for details on Phase 2 and beyond.

