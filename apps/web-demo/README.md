# Web Demo Application

A fintech-inspired credit monitoring application built with React, TypeScript, and Vite. This demo serves as the test target for the agentic testing framework.

## Overview

This application simulates a credit report platform with authentication, dashboard, and detailed report views. It's designed with accessibility in mind and includes proper ARIA attributes and test identifiers for automated testing.

## Features

- Email/password authentication with session management
- Dashboard with credit score overview
- Six navigation tiles (Credit Report functional, others placeholders)
- Detailed credit report page with tradelines
- Responsive design with Tailwind CSS
- Full accessibility compliance

## Available Routes

- `/` - Root redirect (to /login or /dashboard based on auth state)
- `/login` - Authentication page
- `/dashboard` - Main dashboard (protected)
- `/credit-report` - Detailed credit report (protected)

## Getting Started

### Install Dependencies

From the project root:

```bash
npm install
```

### Development Server

Start the development server:

```bash
npm run dev --workspace=apps/web-demo
```

Or from the apps/web-demo directory:

```bash
npm run dev
```

The application will run at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Built files will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Authentication

The authentication system is fully mocked for Phase 1:

- Any email/password combination will work
- Sessions are stored in localStorage
- Token expires after 15 minutes (auto-refresh implemented)
- Logout clears the session

Example login:
- Email: `test@example.com`
- Password: `password123`

## Testing & Accessibility

### Data Test IDs

All interactive elements include `data-testid` attributes for automated testing:

- `email-input` - Email input field
- `password-input` - Password input field
- `login-button` - Login submit button
- `logout-button` - Logout button
- `view-credit-report` - Credit Report navigation tile
- `back-to-dashboard` - Back button on credit report
- `credit-score-chart` - Credit score visualization

### ARIA Compliance

- All interactive elements have proper ARIA labels
- Semantic HTML with proper heading hierarchy
- Role attributes for navigation and main content
- Form inputs have associated labels

### Linting

Run ESLint checks:

```bash
npm run lint
```

The configuration includes:
- TypeScript ESLint rules
- React hooks best practices
- jsx-a11y accessibility rules

## Project Structure

```
apps/web-demo/
├── src/
│   ├── pages/              # Page components
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   └── CreditReport.tsx
│   ├── components/         # Shared components
│   │   └── ProtectedRoute.tsx
│   ├── auth/               # Authentication logic
│   │   ├── AuthContext.tsx
│   │   └── AuthProvider.tsx
│   ├── api/                # API layer (mocked)
│   │   └── auth.ts
│   ├── types/              # TypeScript types
│   │   └── auth.ts
│   ├── App.tsx             # Main app component with routing
│   ├── main.tsx            # Application entry point
│   └── index.css           # Global styles with Tailwind
├── public/                 # Static assets
├── dist/                   # Build output (generated)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── eslint.config.js
```

## Technology Stack

- **Build Tool**: Vite 5
- **Framework**: React 18
- **Language**: TypeScript 5
- **Routing**: React Router v6
- **Styling**: Tailwind CSS 4
- **State Management**: React Context API
- **Linting**: ESLint 8 with jsx-a11y plugin

## Development Notes

### Path Aliases

The project uses `@/` as an alias for the `src/` directory:

```typescript
import { useAuth } from '@/auth/AuthContext';
```

### Type Imports

Due to `verbatimModuleSyntax` being enabled, use type-only imports for types:

```typescript
import type { AuthSession } from '@/types/auth';
```

### Tailwind Configuration

Custom colors defined for fintech aesthetic:
- `fintech-blue` - Dark navy (#0f172a)
- `fintech-accent` - Bright blue (#3b82f6)

## Known Limitations (Phase 1)

- 2FA is not implemented (planned for later phase)
- Only Credit Report tile is functional
- All authentication is mocked (no backend)
- No actual API calls
- No real data persistence

## Next Phase

Phase 2 will integrate this application with:
- MCP-Web server for Playwright automation
- MCP-Data server for user factories
- Session state capture and replay
- Trace collection for debugging
