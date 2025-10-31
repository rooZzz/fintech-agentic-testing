# Phase 3: Agent Core & Schema

**Status**: Complete  
**Date**: October 31, 2025

## Overview

Phase 3 implements the autonomous agent orchestration system that reads YAML scenario definitions, uses OpenAI to plan actions, executes them via the Phase 2 MCP servers, and logs detailed execution data.

## What Was Built

### Core Components

1. **YAML Schema & Validation**
   - JSON Schema definition for goal specifications
   - TypeScript type system with full type safety
   - Ajv-based validation with descriptive error messages

2. **Scenario Loader**
   - YAML file parsing
   - Schema validation
   - Type-safe scenario objects

3. **OpenAI Integration**
   - GPT-4o-mini as default model (cost-effective)
   - JSON mode for reliable structured responses
   - Token usage tracking and cost calculation
   - Cost limit enforcement per scenario

4. **MCP Client**
   - HTTP client for MCP-Web (port 7001)
   - HTTP client for MCP-Data (port 7002)
   - Error handling with meaningful messages
   - Health check support

5. **Condition Evaluator**
   - URL matching (url_contains)
   - Element visibility checking (element_visible by testId)
   - Heading text matching (heading_text)

6. **Execution Loop**
   - Precondition execution (user creation, environment setup)
   - Step-by-step agent actions
   - Success condition checking after each observation
   - Constraint enforcement (max steps, max cost)

7. **JSONL Logger**
   - One JSON object per line
   - Complete execution trace
   - Token usage and cost per step
   - Timestamps for all events

8. **CLI Runner**
   - Simple command-line interface
   - Health checks for dependencies
   - Pretty console output with progress
   - Exit codes for success/failure

## Architecture

```
core/agent/
├── src/
│   ├── schema/
│   │   ├── goal-spec.schema.json    # JSON Schema definition
│   │   ├── types.ts                 # TypeScript interfaces
│   │   └── validator.ts             # Ajv validation
│   ├── loader/
│   │   └── scenario-loader.ts       # YAML loading
│   ├── llm/
│   │   ├── openai-client.ts         # OpenAI wrapper
│   │   └── prompts.ts               # Prompt templates
│   ├── mcp/
│   │   └── client.ts                # MCP server clients
│   ├── conditions/
│   │   └── evaluator.ts             # Success checking
│   ├── logger/
│   │   └── jsonl-logger.ts          # Log writer
│   ├── runner/
│   │   ├── agent-runner.ts          # Main execution loop
│   │   └── cli.ts                   # CLI entry point
│   └── index.ts                     # Public exports
├── package.json
└── tsconfig.json
```

## YAML Scenario Format

### Minimal Example

```yaml
version: "0.1"
id: login-and-dashboard
goal:
  description: "Login and reach dashboard page"
  success:
    - url_contains: "/dashboard"

context:
  start_url: "http://localhost:5173/login"

preconditions:
  - mcp: "data.user.create"
    params:
      plan: "plus"
      requires2FA: false
    store_as: "testUser"

constraints:
  max_steps: 20
  max_cost_usd: 0.50
```

### Schema Elements

**version** (required)
- Must be "0.1"

**id** (required)
- Unique identifier (lowercase, hyphens only)

**goal** (required)
- `description`: Human-readable goal
- `success`: Array of conditions (any one met = success)
  - `url_contains`: String to find in URL
  - `element_visible`: testId of element that must be visible
  - `heading_text`: Text content of heading element

**context** (required)
- `start_url`: Initial URL to navigate to

**preconditions** (optional)
- Array of MCP calls to run before scenario
- Each has:
  - `mcp`: Endpoint name (e.g., "data.user.create")
  - `params`: Object with parameters
  - `store_as`: Variable name to store result

**constraints** (required)
- `max_steps`: Maximum actions before failure
- `max_cost_usd`: Maximum OpenAI cost before stopping

## Usage

### Prerequisites

1. **Environment Configuration**
   
   Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-actual-key-here
   OPENAI_MODEL=gpt-4o-mini
   MCP_WEB_URL=http://localhost:7001
   MCP_DATA_URL=http://localhost:7002
   ```

2. **MCP Servers Running**
   ```bash
   npm run start:servers
   ```

3. **Web Demo Running**
   ```bash
   npm run dev
   ```

### Running a Scenario

```bash
npm run agent scenarios/smoke/login-and-dashboard.yaml
```

### Output

The agent will:
1. Validate the scenario YAML
2. Check MCP server health
3. Run preconditions (create test user)
4. Navigate to start URL
5. Execute steps until success or limit reached
6. Write detailed JSONL log to `out/` directory

### Example Console Output

```
Agentic Testing Framework - Phase 3
====================================

Loading scenario: scenarios/smoke/login-and-dashboard.yaml
✓ Loaded: login-and-dashboard
  Goal: Login and reach dashboard page
  Max steps: 20
  Max cost: $0.50

Checking MCP servers...
✓ MCP-Web: healthy
✓ MCP-Data: healthy
✓ OpenAI API key configured

Output: out/login-and-dashboard_1730400000000.jsonl

Starting scenario execution...
================================================================================

Running preconditions:
  1. data.user.create({"plan":"plus","requires2FA":false})
    Stored as: testUser

Step 1:
URL: http://localhost:5173/login
Interactive elements: 12
Reasoning: need to enter email to login
Action: ui.act.type {"selector":"[data-testid='email-input']","text":"test@example.com"}
Cost: $0.0012 (total: $0.0012)

Step 2:
URL: http://localhost:5173/login
Interactive elements: 12
Reasoning: enter password next
Action: ui.act.type {"selector":"[data-testid='password-input']","text":"password123"}
Cost: $0.0013 (total: $0.0025)

Step 3:
URL: http://localhost:5173/login
Interactive elements: 12
Reasoning: click login button to submit
Action: ui.act.click {"testId":"login-button"}
Cost: $0.0011 (total: $0.0036)

✓ Success condition met: url_contains: "/dashboard"

================================================================================

Scenario Complete!
Status: success
Steps: 3
Duration: 6.42s
Total cost: $0.0036
Log: out/login-and-dashboard_1730400000000.jsonl

✓ SUCCESS
```

## JSONL Log Format

Each line is a JSON object representing an event:

**run_start**
```json
{"type":"run_start","runId":"run_1730400000000","scenarioId":"login-and-dashboard","timestamp":"2025-10-31T14:00:00Z"}
```

**scenario_start**
```json
{"type":"scenario_start","scenarioId":"login-and-dashboard","timestamp":"2025-10-31T14:00:01Z"}
```

**precondition**
```json
{"type":"precondition","step":0,"action":"data.user.create","params":{"plan":"plus","requires2FA":false},"result":{"userId":"abc123","email":"test@example.com","password":"password123"},"timestamp":"2025-10-31T14:00:02Z"}
```

**step**
```json
{"type":"step","step":1,"observation":{"url":"http://localhost:5173/login","title":"Login","nodeCount":12},"action":{"type":"ui.act.type","params":{"selector":"[data-testid='email-input']","text":"test@example.com"}},"reasoning":"need to enter email to login","tokens":{"prompt":450,"completion":45,"cost":0.0012},"timestamp":"2025-10-31T14:00:03Z"}
```

**scenario_end**
```json
{"type":"scenario_end","scenarioId":"login-and-dashboard","status":"success","steps":3,"duration":6.42,"totalCost":0.0036,"timestamp":"2025-10-31T14:00:08Z"}
```

**run_end**
```json
{"type":"run_end","runId":"run_1730400000000","status":"success","duration":6.42,"totalCost":0.0036,"timestamp":"2025-10-31T14:00:08Z"}
```

## OpenAI Integration

### Model Selection

Default: `gpt-4o-mini`
- Cost: $0.15 per 1M input tokens, $0.60 per 1M output tokens
- Fast and cost-effective for most scenarios
- Typical scenario cost: $0.003 - $0.01

Override with environment variable:
```bash
export OPENAI_MODEL=gpt-4o
```

### Prompt Strategy

**System Prompt**
- Explains agent role and capabilities
- Lists available actions (click, type, navigate)
- Defines success conditions
- Sets constraints (max steps, cost limit)
- Enforces JSON response format

**User Prompt** (per step)
- Current URL and page title
- List of interactive elements (visible, enabled)
- Element properties (testId, role, name, href, value)
- Test user credentials (if available)

**Response Format**
```json
{
  "reasoning": "brief explanation",
  "action": {
    "type": "ui.act.click",
    "params": {"testId": "login-button"}
  }
}
```

### Cost Management

- Token usage tracked per step
- Cumulative cost calculated
- Scenario fails if `max_cost_usd` exceeded
- Typical login flow: 3-5 steps, $0.003-$0.005

## Testing

### Manual Test

1. Start all services:
   ```bash
   npm run dev                    # Terminal 1
   npm run start:servers          # Terminal 2
   ```

2. Set API key:
   ```bash
   export OPENAI_API_KEY=sk-...
   ```

3. Run scenario:
   ```bash
   npm run agent scenarios/smoke/login-and-dashboard.yaml
   ```

4. Verify:
   - Agent completes login (expect 3-5 steps)
   - Dashboard URL reached
   - JSONL log created in `out/`
   - Cost under $0.01

## Acceptance Criteria

All criteria met:

- [x] YAML scenario loads and validates successfully
- [x] Agent communicates with both MCP servers
- [x] OpenAI integration returns valid action JSON
- [x] Agent completes login flow and reaches dashboard
- [x] Success condition properly detected
- [x] JSONL log contains all steps with timestamps
- [x] Cost limit enforced (run fails if exceeded)
- [x] Max steps limit enforced

## Known Limitations

1. **No stagnation detection** - Agent may loop if confused (deferred to Phase 4)
2. **No progressive hints** - No guidance when stuck (deferred to Phase 4)
3. **Limited action types** - Only click, type, navigate (sufficient for Phase 3)
4. **No session reuse** - Every run starts from login (deferred to Phase 5)
5. **No parallel execution** - One scenario at a time (deferred to Phase 5)
6. **No metrics computation** - Entropy, backtracks not calculated (Phase 4)

## Dependencies Added

**Production:**
- `openai` ^4.52.0 - OpenAI API client
- `yaml` ^2.3.4 - YAML parsing
- `ajv` ^8.12.0 - JSON Schema validation
- `ajv-formats` ^3.0.1 - Format validators for Ajv
- `zod` ^3.22.4 - Runtime type validation (future use)

**Development:**
- `tsx` ^4.7.0 - TypeScript execution
- `typescript` ^5.3.3 - TypeScript compiler

## Lines of Code

- Schema & Types: ~150 lines
- MCP Client: ~150 lines
- OpenAI Client: ~120 lines
- Agent Runner: ~200 lines
- JSONL Logger: ~80 lines
- CLI: ~80 lines
- Total: ~780 lines

## Next Phase Preview

**Phase 4: Metrics & Reporting** will add:
- Click entropy calculation
- Backtrack detection
- Path optimality measurement
- HTML report generation with visualizations
- Run-over-run comparison

**Phase 5: Runner & Scenarios** will add:
- Full CLI with all options
- Multiple scenario support
- Parallel execution
- Session reuse optimization
- 5+ test scenarios

## Troubleshooting

### "Invalid goal specification" error
- Check YAML syntax (spaces, not tabs)
- Verify all required fields present
- Ensure version is "0.1"

### "MCP-Web: not responding"
- Start MCP servers: `npm run start:servers`
- Check port 7001 is not in use

### "No response from OpenAI"
- Verify `OPENAI_API_KEY` is set
- Check API key is valid
- Ensure network connectivity

### "Cost limit exceeded"
- Increase `max_cost_usd` in scenario
- Use cheaper model: `export OPENAI_MODEL=gpt-3.5-turbo`

### Agent gets stuck in loop
- Reduce `max_steps` to fail faster
- Check element selectors are correct
- Verify success conditions are achievable

## Phase 3 Sign-Off

✓ All planned features implemented  
✓ All acceptance criteria met  
✓ End-to-end testing completed  
✓ Documentation comprehensive  
✓ Code follows project standards (no comments)  
✓ Ready for Phase 4 development  

---

**Phase 3: Agent Core & Schema - COMPLETE**

