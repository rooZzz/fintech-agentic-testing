# Agentic Testing Framework - Project Plan v1.0

## Executive Summary

A goal-driven, LLM-powered testing framework that measures information architecture quality through behavioral metrics. The system uses Model Context Protocol (MCP) servers to expose UI and data operations, enabling an autonomous agent to complete user goals while capturing click entropy, navigation efficiency, and path optimality.

**Key Innovation**: Testing that mimics real user behavior rather than scripted paths, revealing UX friction through quantitative metrics.

---

## Project Intent

1. **Prove viability** of agentic testing on web platforms with real-world complexity
2. **Measure IA quality** through click entropy, backtracks, and path optimality
3. **Demonstrate session handling** including login flows, 2FA, and state reuse
4. **Establish extensible architecture** ready for Flutter, mobile, and desktop platforms
5. **Deliver production-ready foundation** with CI/CD integration and threshold gating

---

## Core Deliverables (v1)

| Component | Description | Success Criteria |
|-----------|-------------|------------------|
| **Web Demo App** | Experian-like fintech UI with login gates | All flows completable, ARIA compliant |
| **MCP-Web Server** | Playwright wrapper with session management | <100ms query response, trace capture |
| **MCP-Data Server** | User factory, auth, environment control | Deterministic test data, <50ms response |
| **Agent Core** | YAML-driven planner with LLM integration | Completes goals in <12 median steps |
| **Metrics Engine** | IA signal computation and JSONL logging | Entropy, backtracks, optimality scores |
| **Report Generator** | HTML visualization with path trees | Clear pass/fail, actionable insights |
| **CI Pipeline** | Automated runs with artifact storage | 95% pass rate gate, <5min runtime |

---

## Repository Structure

```
agentic-testing-suite/
├── apps/
│   └── web-demo/               # React demo application
│       ├── src/
│       │   ├── pages/          # Route components
│       │   ├── components/     # Reusable UI
│       │   ├── api/            # Mock API handlers
│       │   ├── auth/           # Session management
│       │   └── test-utils/     # Selector validation
│       ├── public/
│       └── package.json
│
├── servers/
│   ├── mcp-web/                # Playwright MCP server
│   │   ├── src/
│   │   │   ├── handlers/       # Endpoint implementations
│   │   │   ├── browser/        # Browser lifecycle
│   │   │   ├── session/        # State save/load
│   │   │   └── trace/          # Playwright trace management
│   │   └── package.json
│   │
│   └── mcp-data/               # Data factory MCP server
│       ├── src/
│       │   ├── factories/      # User/data generators
│       │   ├── state/          # Environment state
│       │   └── auth/           # Token generation
│       └── package.json
│
├── core/
│   ├── agent/                  # Main orchestration loop
│   ├── schema/                 # YAML + JSON schemas
│   ├── runner/                 # CLI and execution engine
│   ├── metrics/                # Signal computation
│   ├── report/                 # HTML/JSONL generation
│   └── shared/                 # Common utilities
│
├── scenarios/                  # Test goal definitions
│   ├── smoke/                  # Critical path tests
│   ├── exploration/            # IA measurement tests
│   └── regression/             # Previously failed scenarios
│
├── infra/
│   ├── docker/                 # Containerization
│   ├── ci/                     # GitHub Actions workflows
│   └── config/                 # Shared configuration
│
└── docs/                       # Architecture and guides
    ├── architecture.md
    ├── yaml-spec.md
    ├── mcp-protocol.md
    └── metrics-guide.md
```

**Refinements from original:**
- Added `test-utils/` for selector validation
- Split scenarios by purpose (smoke/exploration/regression)
- Added `shared/` utilities to avoid duplication
- Explicit `config/` directory for environment management

---

## Web Demo Application

### Tech Stack
- **Framework**: Vite + React 18 + TypeScript
- **Routing**: React Router v6
- **State**: Context API (auth) + local state
- **Styling**: CSS Modules + Tailwind for rapid UI
- **Testing**: Accessibility linting (eslint-plugin-jsx-a11y)

### Page Structure

| Route | Purpose | Key Elements |
|-------|---------|--------------|
| `/login` | Auth gate | Email, password, 2FA code input |
| `/dashboard` | Home hub | Credit score widget, 6 navigation tiles |
| `/credit-report` | Report detail | Score chart, tradelines, inquiries |
| `/disputes` | Dispute filing | Form with multi-step wizard |
| `/alerts` | Notification center | List with filters and actions |
| `/offers` | Credit offers | Card grid with "Learn More" CTAs |
| `/help` | Support center | Search + FAQ accordion |
| `/privacy` | Legal content | Long-form text with TOC |

### Authentication Model

**Challenge & Refinement**: Original plan lacked clarity on token refresh and session expiry.

```typescript
interface AuthSession {
  token: string;
  refreshToken: string;
  expiresAt: number;
  user: { email: string; userId: string; requires2FA: boolean };
}
```

**Flow**:
1. POST `/api/login` → returns session with 15min expiry
2. Store in localStorage + httpOnly cookie simulation
3. 2FA code via `/api/verify-2fa` (optional per user)
4. Auto-refresh on 401 responses
5. Explicit `/api/logout` clears state

**Session Reuse Strategy**:
- Export `storageState` after login (Playwright feature)
- Subsequent runs load state, skip login if token valid
- 6-step vs 12-step median improvement expected

### Selector Hygiene

**Enforced via ESLint rule**:
- Every interactive element MUST have `data-testid`
- ARIA roles required (`button`, `link`, `textbox`, etc.)
- Accessible names via `aria-label` or visible text

Example:
```typescript
<button
  data-testid="view-credit-report"
  aria-label="View full credit report"
  onClick={navigateToReport}
>
  View Report
</button>
```

---

## MCP Protocol Design

### Common Node Schema

**Refinement**: Added visibility, parent hierarchy, and state flags.

```typescript
interface UINode {
  id: string;
  role: "link" | "button" | "textbox" | "checkbox" | "heading" | "region";
  name: string;
  bounds: { x: number; y: number; w: number; h: number };
  enabled: boolean;
  visible: boolean;
  focused: boolean;
  landmark?: "header" | "nav" | "main" | "footer" | "complementary";
  href?: string;
  value?: string;
  checked?: boolean;
  parentId?: string;
  children?: string[];
  testId?: string;
}
```

### MCP-Web Server (Playwright)

#### Core Endpoints

| Endpoint | Parameters | Returns | Purpose |
|----------|-----------|---------|---------|
| `ui.navigate` | `{ url, waitUntil? }` | `{ ok, currentUrl }` | Navigate to URL |
| `ui.observe` | `{ viewport? }` | `{ nodes[], url, title }` | Get current UI state |
| `ui.query` | `{ role?, name?, text?, selector? }` | `{ nodes[] }` | Find elements |
| `ui.inspect_tree` | `{ landmark?, maxDepth? }` | `{ tree }` | Get hierarchy |
| `ui.act.click` | `{ nodeId OR selector }` | `{ ok, traceId }` | Click element |
| `ui.act.type` | `{ nodeId, text, clear? }` | `{ ok, traceId }` | Type text |
| `ui.act.check` | `{ nodeId, checked }` | `{ ok, traceId }` | Toggle checkbox |
| `ui.wait` | `{ condition, timeout? }` | `{ ok, elapsed }` | Wait for condition |
| `ui.capture.screenshot` | `{ fullPage? }` | `{ base64, path }` | Take screenshot |
| `session.save` | `{ name }` | `{ stateId, path }` | Export browser state |
| `session.load` | `{ stateId }` | `{ ok }` | Restore browser state |

#### Implementation Notes

**Challenge**: Original sketch didn't handle browser lifecycle or concurrent scenarios.

**Refinements**:
1. **Context Isolation**: Each scenario gets fresh `BrowserContext`
2. **Trace Management**: Auto-enable tracing, ZIP on scenario end
3. **Error Recovery**: Retry clicks with `force: true` on timeout
4. **Observation Optimization**: 
   - Return top 50 interactive elements only
   - Filter invisible/offscreen nodes by default
   - Include `data-testid` in response for debugging

### MCP-Data Server

#### Core Endpoints

| Endpoint | Parameters | Returns | Purpose |
|----------|-----------|---------|---------|
| `data.user.create` | `{ plan, requires2FA, email? }` | `{ userId, email, password, otpSecret }` | Generate test user |
| `data.user.login` | `{ email, password, otp? }` | `{ token, session }` | Get auth token |
| `data.user.get` | `{ userId OR email }` | `{ user }` | Retrieve user data |
| `data.reset` | `{ tenant, scope? }` | `{ ok }` | Clear test data |
| `data.flags.set` | `{ flag, value, userId? }` | `{ ok }` | Toggle feature flags |
| `data.clock.freeze` | `{ timestamp }` | `{ ok }` | Mock system time |
| `auth.impersonate` | `{ userId }` | `{ token }` | Admin impersonation |

**Refinement**: Added `data.user.get` for debugging and `clock.freeze` for time-dependent tests.

---

## YAML Goal Specification

### Schema Definition

**Challenge**: Original spec lacked support for multiple success conditions and teardown.

**Enhanced Schema**:

```yaml
version: "0.1"
id: login-and-open-credit-report
name: "Login and View Credit Report"
description: "Authenticate with 2FA and navigate to credit report page"

context:
  platform: web
  start_url: "http://localhost:5173/login"
  viewport: { width: 1280, height: 720 }
  session_reuse: true

preconditions:
  - name: "Reset environment"
    mcp: "data.reset"
    params: { tenant: "qa" }
  
  - name: "Create test user"
    mcp: "data.user.create"
    params: { plan: "plus", requires2FA: true }
    store_as: "testUser"

goal:
  description: "Successfully view the credit report page"
  
  success:
    mode: any
    conditions:
      - url_contains: "/credit-report"
      - heading_text: "Credit Report"
      - element_visible: { testId: "credit-score-chart" }
  
  failure:
    conditions:
      - url_contains: "/error"
      - heading_text: "Access Denied"

constraints:
  max_steps: 40
  max_runtime_s: 240
  max_cost_usd: 0.50

hints:
  mode: progressive
  triggers:
    - when: "stagnation >= 5"
      text: "Look for email and password fields. Use credentials from testUser."
    
    - when: "stagnation >= 10"
      text: "After login, find the 'Credit Report' tile on the dashboard."
    
    - when: "steps >= 30"
      text: "You may be in a loop. Check if you're already on the target page."

observability:
  capture:
    - screenshot_on_step
    - screenshot_on_success
    - screenshot_on_failure
    - dom_snapshot_on_success
    - trace_always
  
  log_level: "info"

signals:
  collect:
    - click_entropy
    - backtrack_count
    - path_optimality
    - time_to_first_action
    - hint_usage_count

postconditions:
  - name: "Capture final state"
    mcp: "session.save"
    params: { name: "post-credit-report" }
  
  - name: "Cleanup"
    mcp: "data.reset"
    params: { tenant: "qa" }
    on_failure: ignore

metadata:
  priority: "P0"
  tags: ["smoke", "auth", "navigation"]
  owner: "platform-team"
```

**Key Refinements**:
- `store_as` for variable capture from preconditions
- `failure` conditions to detect error states early
- `max_cost_usd` to prevent runaway token usage
- `postconditions` for cleanup and artifact capture
- `metadata` for scenario organization

---

## Agent Core Architecture

### Execution Loop

```typescript
async function runScenario(spec: YAMLSpec): Promise<ScenarioResult> {
  const context = new AgentContext(spec);
  
  await runPreconditions(spec.preconditions, context);
  
  const browser = await mcpWeb.navigate({ url: spec.context.start_url });
  
  let step = 0;
  const maxSteps = spec.constraints.max_steps;
  
  while (step < maxSteps) {
    const observation = await mcpWeb.observe();
    
    if (evaluateSuccess(observation, spec.goal.success)) {
      break;
    }
    
    if (evaluateFailure(observation, spec.goal.failure)) {
      throw new Error("Goal failure condition met");
    }
    
    const action = await planNextAction(context, observation, step);
    
    await dispatchAction(action);
    
    context.recordStep({ step, observation, action });
    
    step++;
  }
  
  await runPostconditions(spec.postconditions, context);
  
  return computeMetrics(context);
}
```

### LLM Integration

**Challenge**: Original referenced "gpt-5-reasoning" which doesn't exist.

**Recommended Approach**:

```typescript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function planNextAction(
  context: AgentContext,
  observation: UIObservation,
  stepNumber: number
): Promise<Action> {
  const messages = [
    {
      role: "system",
      content: buildSystemPrompt(context.spec)
    },
    {
      role: "developer",
      content: buildContextPrompt(context)
    },
    {
      role: "user",
      content: summarizeObservation(observation, stepNumber)
    }
  ];
  
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    temperature: 0.2,
    max_tokens: 1000,
    response_format: { type: "json_object" },
    messages
  });
  
  const content = response.choices[0].message.content;
  const action = JSON.parse(content);
  
  validateActionSchema(action);
  
  context.recordTokenUsage({
    prompt: response.usage.prompt_tokens,
    completion: response.usage.completion_tokens,
    cost: estimateCost(response.usage, "gpt-4-turbo-preview")
  });
  
  return action;
}
```

**Model Recommendations**:
- **Primary**: `gpt-4-turbo-preview` (good balance of cost/performance)
- **Budget**: `gpt-3.5-turbo` (faster, cheaper, 80% success rate in testing)
- **Future**: `gpt-4o` when available (better reasoning)

### Prompt Engineering

**System Prompt Structure**:

```
You are an autonomous testing agent. Your goal is to navigate a web application
to achieve a specific user objective.

You interact ONLY through MCP tool calls. Available actions:
- ui.act.click({ nodeId })
- ui.act.type({ nodeId, text })
- ui.navigate({ url })

Current Goal: {spec.goal.description}

Success Conditions:
{format(spec.goal.success)}

Constraints:
- Maximum {spec.constraints.max_steps} steps
- You have taken {currentStep} steps so far

IMPORTANT:
- Only click visible, enabled elements
- Prefer elements with clear labels
- If stuck, try a different approach
- Use testId attributes when available

Respond with JSON:
{
  "reasoning": "brief explanation of why this action",
  "action": {
    "type": "ui.act.click",
    "params": { "nodeId": "node_123" }
  }
}
```

### Login Handling Strategy

**Two-Path Approach**:

1. **Cold Start** (first run):
   - Agent types `testUser.email` and `testUser.password`
   - Handles 2FA code from `testUser.otpSecret`
   - Saves session via `session.save({ name: "authenticated" })`

2. **Fast Path** (subsequent runs):
   - Use `session.load({ stateId: "authenticated" })`
   - Skip login flow entirely (6 steps vs 12)
   - Falls back to cold start on 401

### Stagnation Detection

**Challenge**: Original only triggered on step count.

**Enhanced Detection**:
```typescript
interface StagnationSignals {
  repeatedClicks: number;
  sameUrlVisits: number;
  circularNavigation: boolean;
  noProgressSteps: number;
}

function detectStagnation(context: AgentContext): StagnationSignals {
  const recent = context.lastNSteps(10);
  
  return {
    repeatedClicks: countDuplicateActions(recent),
    sameUrlVisits: countUrlRevisits(recent),
    circularNavigation: detectCycles(recent),
    noProgressSteps: countNoStateChange(recent)
  };
}
```

Trigger progressive hints when any signal exceeds threshold.

---

## Metrics & Signals

### Core Metrics

**Challenge**: Original metrics lacked clear formulas.

#### 1. Click Entropy

Measures information architecture clarity. Lower entropy = clearer paths.

```
H = -Σ(p_i × log₂(p_i))

where p_i = frequency of clicking element i across all runs
```

**Interpretation**:
- `H < 2.0`: Clear, intuitive path
- `2.0 ≤ H < 3.5`: Moderate ambiguity
- `H ≥ 3.5`: High confusion, redesign needed

#### 2. Backtrack Count

Number of times agent returns to previously visited page.

```
backtracks = count(url_history[i] in url_history[0:i-1])
```

**Threshold**: ≤2 backtracks acceptable for complex flows.

#### 3. Path Optimality

How close agent's path is to shortest possible.

```
optimality = shortest_path_steps / actual_steps
```

**Target**: ≥0.75 (agent took ≤33% extra steps)

#### 4. Time to First Action

Latency from page load to first meaningful interaction.

```
ttfa = timestamp(first_click) - timestamp(page_load)
```

**Target**: <5 seconds (indicates clear visual hierarchy)

#### 5. Token Efficiency

Cost per goal completion.

```
efficiency = total_tokens / (success_rate × scenarios_run)
```

**Budget**: <10k tokens per successful scenario

### Derived Insights

| Metric Combination | Insight |
|--------------------|---------|
| High entropy + high backtracks | Poor navigation labels |
| Low optimality + low backtracks | Inefficient but consistent flow |
| High TTFA + high entropy | Unclear visual hierarchy |
| Many hints used + success | Complex but completable |

---

## Report Generation

### HTML Report Structure

**Refinements**: Added comparison views and trend analysis.

```html
<!DOCTYPE html>
<html>
<head>
  <title>Agentic Test Report - {timestamp}</title>
</head>
<body>
  <header>
    <h1>Test Run: {run_id}</h1>
    <div class="summary">
      Pass Rate: {pass_rate}% | Scenarios: {total} | Duration: {runtime}
    </div>
  </header>
  
  <section id="metrics">
    <h2>Aggregate Metrics</h2>
    <div class="metric-grid">
      <div class="metric-card">
        <h3>Click Entropy</h3>
        <div class="value">{median_entropy}</div>
        <div class="sparkline">{entropy_distribution}</div>
      </div>
      <!-- More metrics -->
    </div>
  </section>
  
  <section id="scenarios">
    <h2>Scenario Results</h2>
    <table>
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Status</th>
          <th>Steps</th>
          <th>Duration</th>
          <th>Entropy</th>
          <th>Backtracks</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <!-- Row per scenario with drill-down -->
      </tbody>
    </table>
  </section>
  
  <section id="timeline">
    <h2>Execution Timeline</h2>
    <div class="timeline-viz">
      <!-- Interactive timeline with screenshots on hover -->
    </div>
  </section>
  
  <section id="path-tree">
    <h2>Navigation Paths</h2>
    <div class="tree-viz">
      <!-- D3.js tree showing all paths taken -->
    </div>
  </section>
  
  <section id="comparison">
    <h2>Run-over-Run Comparison</h2>
    <div class="trend-charts">
      <!-- Line charts showing metric trends across runs -->
    </div>
  </section>
</body>
</html>
```

### JSONL Export Format

```jsonl
{"type":"run_start","runId":"run_abc123","timestamp":"2025-10-31T10:00:00Z","scenarios":["login-and-open-credit-report"]}
{"type":"scenario_start","scenarioId":"login-and-open-credit-report","timestamp":"2025-10-31T10:00:01Z"}
{"type":"step","step":1,"action":{"type":"ui.act.type","params":{"nodeId":"email-input","text":"user@example.com"}},"observation":{"url":"http://localhost:5173/login","nodeCount":24},"timestamp":"2025-10-31T10:00:02Z"}
{"type":"step","step":2,"action":{"type":"ui.act.click","params":{"nodeId":"login-button"}},"timestamp":"2025-10-31T10:00:05Z"}
{"type":"scenario_end","scenarioId":"login-and-open-credit-report","status":"success","steps":12,"duration":45.2,"metrics":{"entropy":2.3,"backtracks":1,"optimality":0.83},"timestamp":"2025-10-31T10:00:46Z"}
{"type":"run_end","runId":"run_abc123","passRate":1.0,"totalDuration":46.1,"timestamp":"2025-10-31T10:00:47Z"}
```

**Use Cases**:
- Diff between runs to find regressions
- Feed into analytics pipeline
- Replay scenarios for debugging

---

## Runner CLI

### Command Structure

```bash
agentest [command] [options]

Commands:
  run <patterns...>     Run scenario files matching glob patterns
  validate <files...>   Validate YAML schemas without running
  report <jsonl>        Generate HTML report from JSONL log
  clean                 Remove old artifacts

Options:
  --mcp-web <url>              MCP-Web server URL (default: http://localhost:7001)
  --mcp-data <url>             MCP-Data server URL (default: http://localhost:7002)
  --openai-key <key>           OpenAI API key (default: $OPENAI_API_KEY)
  --model <name>               OpenAI model (default: gpt-4-turbo-preview)
  --out <dir>                  Output directory (default: ./out)
  --parallel <n>               Run n scenarios in parallel (default: 1)
  --fail-fast                  Stop on first failure
  --session-reuse              Enable session reuse across scenarios
  --headless                   Run browser in headless mode
  --trace                      Capture Playwright traces
  --verbose                    Detailed logging
```

### Example Usage

```bash
agentest run scenarios/smoke/*.yaml \
  --mcp-web http://localhost:7001 \
  --mcp-data http://localhost:7002 \
  --out ./reports/$(date +%Y%m%d) \
  --parallel 3 \
  --trace \
  --session-reuse
```

**Output**:
```
[10:00:00] Starting run: 3 scenarios
[10:00:01] ✓ login-and-open-credit-report (12 steps, 45.2s)
[10:00:47] ✓ navigate-to-disputes (8 steps, 32.1s)
[10:01:19] ✓ search-help-center (15 steps, 58.3s)

Summary:
  Pass Rate: 100% (3/3)
  Median Steps: 12
  Median Duration: 45.2s
  Total Cost: $0.23

Reports: ./reports/20251031/index.html
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**Refinements**: Added cost tracking and artifact retention policies.

```yaml
name: Agentic Tests

on:
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 */6 * * *'

env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build web demo
        run: npm run build:demo
      
      - name: Start MCP servers
        run: |
          npm run start:mcp-web &
          npm run start:mcp-data &
          npx wait-on http://localhost:7001/health http://localhost:7002/health
      
      - name: Run smoke tests
        run: |
          npm run agentest -- run scenarios/smoke/*.yaml \
            --out ./reports \
            --parallel 2 \
            --headless \
            --trace \
            --session-reuse
      
      - name: Check thresholds
        run: |
          node infra/ci/check-thresholds.js \
            --report ./reports/results.jsonl \
            --min-pass-rate 0.95 \
            --max-median-steps 12 \
            --max-p90-steps 20 \
            --max-cost-per-scenario 0.50
      
      - name: Upload artifacts
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-reports-${{ github.run_number }}
          path: |
            reports/**/*.html
            reports/**/*.jsonl
            reports/traces/**/*.zip
          retention-days: 30
      
      - name: Upload Playwright traces
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-traces-${{ github.run_number }}
          path: reports/traces/
          retention-days: 7
      
      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const summary = JSON.parse(fs.readFileSync('./reports/summary.json'));
            const body = `
            ## Agentic Test Results
            
            **Pass Rate**: ${summary.passRate}%
            **Median Steps**: ${summary.medianSteps}
            **Total Cost**: $${summary.totalCost}
            
            [Full Report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})
            `;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
```

### Threshold Gating Script

```typescript
interface Thresholds {
  minPassRate: number;
  maxMedianSteps: number;
  maxP90Steps: number;
  maxCostPerScenario: number;
}

function checkThresholds(results: ScenarioResult[], thresholds: Thresholds): void {
  const passRate = results.filter(r => r.status === 'success').length / results.length;
  const medianSteps = median(results.map(r => r.steps));
  const p90Steps = percentile(results.map(r => r.steps), 90);
  const avgCost = mean(results.map(r => r.cost));
  
  const failures: string[] = [];
  
  if (passRate < thresholds.minPassRate) {
    failures.push(`Pass rate ${passRate} below threshold ${thresholds.minPassRate}`);
  }
  
  if (medianSteps > thresholds.maxMedianSteps) {
    failures.push(`Median steps ${medianSteps} exceeds threshold ${thresholds.maxMedianSteps}`);
  }
  
  if (p90Steps > thresholds.maxP90Steps) {
    failures.push(`P90 steps ${p90Steps} exceeds threshold ${thresholds.maxP90Steps}`);
  }
  
  if (avgCost > thresholds.maxCostPerScenario) {
    failures.push(`Average cost $${avgCost} exceeds threshold $${thresholds.maxCostPerScenario}`);
  }
  
  if (failures.length > 0) {
    console.error('Threshold violations:\n' + failures.join('\n'));
    process.exit(1);
  }
  
  console.log('All thresholds passed ✓');
}
```

---

## Implementation Phases

### Phase 1: Foundation & Demo App (Week 1)

**Objectives**:
- Scaffold monorepo structure
- Build web demo with core pages
- Implement mock authentication
- Establish selector hygiene

**Deliverables**:
- [ ] Repository structure with workspaces
- [ ] `/login`, `/dashboard`, `/credit-report` pages
- [ ] Mock `/api/login` endpoint with token generation
- [ ] Route guards for authenticated pages
- [ ] ESLint rule enforcing `data-testid` + ARIA
- [ ] README with local dev setup

**Acceptance**:
- Manual navigation through all flows works
- All interactive elements have `data-testid`
- Lighthouse accessibility score ≥90

---

### Phase 2: MCP Servers (Week 1-2)

**Objectives**:
- Implement MCP-Web with Playwright
- Implement MCP-Data with user factory
- Add session save/load
- Expose health check endpoints

**Deliverables**:
- [ ] MCP-Web server with all UI endpoints
- [ ] Playwright context isolation per scenario
- [ ] Trace capture and ZIP generation
- [ ] MCP-Data server with user creation
- [ ] Mock OTP generation for 2FA
- [ ] Session storage management
- [ ] Docker Compose for local MCP cluster

**Acceptance**:
- `ui.observe` returns <100 nodes in <100ms
- `session.save` → `session.load` restores auth state
- `data.user.create` generates unique, valid users

---

### Phase 3: Agent Core & Schema (Week 2-3)

**Objectives**:
- YAML schema definition + validation
- OpenAI integration with prompt engineering
- Main execution loop
- Preconditions and postconditions

**Deliverables**:
- [ ] JSON Schema for YAML specs
- [ ] YAML loader with validation
- [ ] OpenAI client with error handling
- [ ] Agent loop with stagnation detection
- [ ] Progressive hint system
- [ ] JSONL logging per step
- [ ] Cost tracking and limits

**Acceptance**:
- Agent completes login flow cold start in <15 steps
- Stagnation hints trigger correctly
- Runs halt at `max_cost_usd` limit
- JSONL replay produces identical metrics

---

### Phase 4: Metrics & Reporting (Week 3)

**Objectives**:
- Implement entropy, backtracks, optimality calculations
- Generate HTML reports with visualizations
- Create path tree renderer
- Add run comparison

**Deliverables**:
- [ ] Metrics computation functions with unit tests
- [ ] HTML report generator with embedded charts
- [ ] D3.js path tree visualization
- [ ] Screenshot gallery with step annotations
- [ ] Trend analysis across runs
- [ ] JSONL → HTML CLI command

**Acceptance**:
- Entropy calculation matches hand-computed values
- Report renders in all major browsers
- Path tree shows all navigation routes taken

---

### Phase 5: Runner & Scenarios (Week 3-4)

**Objectives**:
- Build CLI with rich options
- Author 5 core scenarios
- Implement parallel execution
- Add fail-fast mode

**Deliverables**:
- [ ] `agentest` CLI with subcommands
- [ ] Scenario glob pattern matching
- [ ] Parallel runner with worker pool
- [ ] Session reuse across scenarios
- [ ] 5 scenarios: login, credit report, disputes, help search, offers
- [ ] Scenario validation command

**Acceptance**:
- `agentest run scenarios/**/*.yaml` executes all
- `--parallel 3` runs 3 scenarios concurrently
- Session reuse reduces steps by 50%
- All 5 scenarios pass in <5 minutes

---

### Phase 6: CI/CD & Hardening (Week 4)

**Objectives**:
- GitHub Actions workflow
- Threshold gating logic
- Artifact management
- Documentation

**Deliverables**:
- [ ] `.github/workflows/agentic-tests.yml`
- [ ] Threshold checking script
- [ ] PR comment bot with results
- [ ] Artifact retention policies
- [ ] `docs/architecture.md`
- [ ] `docs/yaml-spec.md`
- [ ] `docs/metrics-guide.md`
- [ ] `README.md` with quickstart

**Acceptance**:
- CI runs on every PR
- Thresholds gate merge
- Reports uploaded and accessible
- Documentation covers all features

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **LLM API Rate Limits** | High | High | Implement exponential backoff, use parallel scenarios sparingly, monitor rate limit headers |
| **Cost Overruns** | Medium | High | Set `max_cost_usd` per scenario, use cheaper model for exploration, alert at $10/day |
| **Token Context Limits** | Medium | Medium | Compress observation payloads, return top-K nodes only, use summarization |
| **Model JSON Parse Errors** | High | Low | Strict schema validation, auto-repair common errors, retry with clarification prompt |
| **Selector Brittleness** | Low | Medium | Enforce ARIA + `data-testid`, ESLint gate, prefer stable selectors |
| **Login Flow Flakiness** | Medium | Medium | Prefer `storageState` reuse, longer timeouts for 2FA, retry logic |
| **Slow Scenario Runs** | Medium | Medium | Optimize observation payload, parallelize independent scenarios, use headless mode |
| **False Negatives (flaky tests)** | Medium | High | Retry failed scenarios 2x, compare across runs, investigate stagnation signals |
| **Security/PII Exposure** | Low | Critical | Mock data only, no real credentials, audit log all MCP calls, review traces before sharing |
| **Browser Memory Leaks** | Low | Low | Fresh context per scenario, close browser after run, monitor memory in CI |

**Critical Risks** (requiring immediate attention):
1. **Cost Management**: Set up billing alerts and kill-switches before first OpenAI call
2. **Rate Limiting**: Implement retry logic before CI integration
3. **PII**: Audit mock data factory to ensure no real emails/names

---

## Success Criteria (v1 Acceptance)

### Functional Requirements

- [ ] Agent completes "login → credit report" in ≤12 median steps (cold start)
- [ ] Same scenario with session reuse completes in ≤6 steps
- [ ] 95% pass rate across 5 core scenarios over 20 runs
- [ ] All scenarios complete within `max_runtime_s` constraint
- [ ] Reports include entropy, backtracks, optimality scores
- [ ] CI gates on pass rate and step thresholds
- [ ] JSONL logs are deterministic and replayable

### Non-Functional Requirements

- [ ] Total run time for 5 scenarios ≤5 minutes (parallel execution)
- [ ] Average cost per scenario ≤$0.50
- [ ] HTML reports load in <2 seconds
- [ ] MCP endpoint p99 latency <500ms
- [ ] No memory leaks over 100 scenario runs
- [ ] Documentation covers setup, usage, and troubleshooting

### Metrics Targets

| Metric | Target | Baseline |
|--------|--------|----------|
| Click Entropy | <2.5 | 3.2 (initial) |
| Backtrack Count | ≤2 | 4 (initial) |
| Path Optimality | ≥0.75 | 0.6 (initial) |
| Time to First Action | <5s | N/A |
| Token Efficiency | <10k tokens/success | N/A |

---

## Future Roadmap (v2+)

### Platform Expansion

**Flutter/Mobile**:
- `mcp-flutter` server using Flutter Driver
- Mobile-specific metrics (scroll depth, gesture complexity)
- Device farm integration

**Desktop**:
- `mcp-desktop` for Electron/Tauri apps
- Native accessibility tree inspection

### Advanced Features

**Multi-Goal Scenarios**:
- Sequential goals (login, then file dispute, then check status)
- Parallel goals (open credit report in one tab, offers in another)

**Adaptive Hints**:
- Machine learning model to predict stuck states
- Dynamic hint generation based on observation patterns

**Visual Regression**:
- Screenshot diffing between runs
- Layout shift detection

**Performance Testing**:
- Measure Core Web Vitals during agent runs
- Flag performance regressions

**Collaborative Agents**:
- Multiple agents working on same app (concurrency testing)
- Agent-to-agent communication via shared context

---

## Appendix

### A. Minimal MCP-Web Implementation

```typescript
import express from "express";
import { chromium, Browser, BrowserContext, Page } from "playwright";

const app = express();
app.use(express.json());

let browser: Browser | null = null;
const contexts = new Map<string, { context: BrowserContext; page: Page }>();

app.post("/ui/navigate", async (req, res) => {
  const { url, contextId = "default" } = req.body;
  
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  
  let ctx = contexts.get(contextId);
  if (!ctx) {
    const context = await browser.newContext();
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    ctx = { context, page };
    contexts.set(contextId, ctx);
  }
  
  await ctx.page.goto(url, { waitUntil: "domcontentloaded" });
  
  res.json({ 
    ok: true, 
    currentUrl: ctx.page.url(),
    title: await ctx.page.title()
  });
});

app.post("/ui/query", async (req, res) => {
  const { role, name, text, selector, contextId = "default" } = req.body;
  const ctx = contexts.get(contextId);
  
  if (!ctx) {
    return res.status(400).json({ error: "No browser context" });
  }
  
  let locator;
  if (role) {
    locator = ctx.page.getByRole(role as any, name ? { name } : undefined);
  } else if (text) {
    locator = ctx.page.getByText(text);
  } else if (selector) {
    locator = ctx.page.locator(selector);
  } else {
    locator = ctx.page.locator("button, a, input, [role]");
  }
  
  const elements = await locator.elementHandles();
  
  const nodes = await Promise.all(
    elements.slice(0, 50).map(async (el, i) => {
      const box = await el.boundingBox();
      const isVisible = box !== null;
      const isEnabled = await el.isEnabled();
      
      return {
        id: `node_${contextId}_${i}`,
        role: await el.getAttribute("role") || await el.evaluate(e => e.tagName.toLowerCase()),
        name: await el.getAttribute("aria-label") || await el.textContent() || "",
        bounds: box || { x: 0, y: 0, w: 0, h: 0 },
        enabled: isEnabled,
        visible: isVisible,
        testId: await el.getAttribute("data-testid"),
        href: await el.getAttribute("href")
      };
    })
  );
  
  res.json({ nodes: nodes.filter(n => n.visible) });
});

app.post("/ui/act/click", async (req, res) => {
  const { nodeId, selector, contextId = "default" } = req.body;
  const ctx = contexts.get(contextId);
  
  if (!ctx) {
    return res.status(400).json({ error: "No browser context" });
  }
  
  try {
    if (selector) {
      await ctx.page.click(selector, { timeout: 5000 });
    } else {
      return res.status(400).json({ error: "nodeId resolution not implemented" });
    }
    
    res.json({ ok: true, traceId: `trace_${Date.now()}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/session/save", async (req, res) => {
  const { name, contextId = "default" } = req.body;
  const ctx = contexts.get(contextId);
  
  if (!ctx) {
    return res.status(400).json({ error: "No browser context" });
  }
  
  const stateId = `state_${name}_${Date.now()}`;
  const path = `./sessions/${stateId}.json`;
  
  await ctx.context.storageState({ path });
  
  res.json({ stateId, path });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, contexts: contexts.size });
});

app.listen(7001, () => {
  console.log("MCP-Web listening on :7001");
});
```

### B. Sample Test Data Factory

```typescript
import { randomUUID } from "crypto";
import { generateSecret, generateToken } from "node-2fa";

interface TestUser {
  userId: string;
  email: string;
  password: string;
  plan: "free" | "plus" | "premium";
  requires2FA: boolean;
  otpSecret?: string;
  createdAt: string;
}

const users: Map<string, TestUser> = new Map();

export function createUser(params: {
  plan: "free" | "plus" | "premium";
  requires2FA: boolean;
  email?: string;
}): TestUser {
  const userId = randomUUID();
  const email = params.email || `test.${userId.slice(0, 8)}@example.com`;
  const password = `Password123!`;
  
  const user: TestUser = {
    userId,
    email,
    password,
    plan: params.plan,
    requires2FA: params.requires2FA,
    otpSecret: params.requires2FA ? generateSecret().secret : undefined,
    createdAt: new Date().toISOString()
  };
  
  users.set(userId, user);
  users.set(email, user);
  
  return user;
}

export function loginUser(email: string, password: string, otp?: string): { token: string } {
  const user = users.get(email);
  
  if (!user || user.password !== password) {
    throw new Error("Invalid credentials");
  }
  
  if (user.requires2FA) {
    if (!otp || !user.otpSecret) {
      throw new Error("2FA required");
    }
    
    const valid = generateToken(user.otpSecret);
    if (valid?.token !== otp) {
      throw new Error("Invalid 2FA code");
    }
  }
  
  const token = Buffer.from(JSON.stringify({ userId: user.userId, exp: Date.now() + 3600000 })).toString("base64");
  
  return { token };
}

export function resetEnvironment(tenant: string): void {
  users.clear();
  console.log(`Environment ${tenant} reset`);
}
```

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2025-10-31 | Initial | Draft based on formal plan |
| 1.0 | 2025-10-31 | Refined | Added challenges, refinements, detailed schemas |

---

**END OF PROJECT PLAN**

