# State Management Best Practices

## Overview

Proper state management is critical for reliable, scalable test execution. This guide covers how to handle state isolation, cleanup, and reset between test runs.

## The Problem

When tests run sequentially, state from one test can leak into the next:
- Browser localStorage/cookies persist
- Test data accumulates in databases
- Session tokens remain valid
- Browser contexts reuse authentication

This causes:
- **Flaky tests** - Pass/fail depends on execution order
- **False positives** - Tests pass because of leftover state
- **Hard-to-debug failures** - Root cause is in a previous test

## The Solution: Stateless Test Execution

### 1. Browser Context Isolation (Automatic ✅)

Each scenario run creates a **unique browser context** that's automatically cleaned up:

```typescript
const contextId = `agent_${Date.now()}`;
await mcpWeb.navigate({ url: startUrl, contextId });
```

**Benefits:**
- Fresh localStorage/cookies/sessionStorage
- No authentication carryover
- Parallel test execution possible
- Zero overhead (contexts are lightweight)

### 2. Test Data Reset (Manual via Preconditions)

Reset test data at the start of each scenario using preconditions:

```yaml
preconditions:
  - mcp: "data.reset"
    params: {}
```

This clears:
- All test users
- Cached tokens
- Any in-memory state

### 3. Browser Reset Endpoint (Optional)

For manual cleanup or debugging:

```bash
curl -X POST http://localhost:7001/browser/reset \
  -H "Content-Type: application/json" \
  -d '{"contextId": "default"}'
```

## Recommended Pattern

### For Sequential Tests

```yaml
# scenario-1.yaml
preconditions:
  - mcp: "data.reset"           # Clear data
    params: {}
  - mcp: "data.user.create"     # Create fresh user
    params: { plan: "plus" }
    store_as: "testUser"

goal:
  description: "Test scenario 1"
  success:
    - url_contains: "/success"
```

Each scenario:
1. Resets data (via precondition)
2. Gets a unique browser context (automatic)
3. Creates its own test data
4. Runs in complete isolation

### For Parallel Tests

No changes needed! Each scenario automatically gets:
- Unique `contextId` based on timestamp
- Isolated browser context
- Fresh environment

```bash
# All run in parallel with no conflicts
npm run agent scenario1.yaml &
npm run agent scenario2.yaml &
npm run agent scenario3.yaml &
wait
```

## Performance Comparison

| Approach | Time | Reliability | Scalability |
|----------|------|-------------|-------------|
| **Restart servers** | 5-10s | ✅ High | ❌ Poor |
| **Browser contexts** | <100ms | ✅ High | ✅ Excellent |
| **Reset endpoints** | ~50ms | ✅ High | ✅ Excellent |
| **No isolation** | 0ms | ❌ Low | ❌ Poor |

**Recommendation**: Use browser contexts (automatic) + reset preconditions

## Common Anti-Patterns

### ❌ Don't: Restart servers between tests
```bash
npm run kill:servers
npm run start:servers
# Slow (5-10s), unnecessary
```

### ✅ Do: Use context isolation + reset
```yaml
preconditions:
  - mcp: "data.reset"
```

### ❌ Don't: Share contexts between tests
```typescript
const contextId = "shared";  // BAD
```

### ✅ Do: Let agent create unique contexts
```typescript
const contextId = `agent_${Date.now()}`;  // GOOD (automatic)
```

### ❌ Don't: Depend on test execution order
```yaml
# scenario-2.yaml assumes scenario-1.yaml ran first
goal:
  description: "Continue from where scenario-1 left off"
```

### ✅ Do: Make each test self-contained
```yaml
# scenario-2.yaml sets up its own state
preconditions:
  - mcp: "data.reset"
  - mcp: "data.user.create"
    store_as: "testUser"
```

## Implementation Details

### How Context Isolation Works

1. **Unique ID Generation**
   ```typescript
   const contextId = `agent_${Date.now()}_${Math.random()}`;
   ```

2. **Browser Context Creation**
   ```typescript
   const context = await browser.newContext({
     viewport: { width: 1280, height: 720 }
   });
   ```

3. **Automatic Cleanup**
   - Contexts are not explicitly closed (designed for long-running server)
   - For explicit cleanup: `POST /browser/reset { "contextId": "..." }`

### Context Lifecycle

```
Test Start → Create Context → Run Test → Context Remains
                  ↓
            Isolated from other tests
```

For production CI/CD, consider adding cleanup after N contexts or on schedule.

## CI/CD Recommendations

### GitHub Actions Example

```yaml
- name: Run agentic tests
  run: |
    npm run agent scenarios/smoke/*.yaml
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

No special cleanup needed - each workflow run is a fresh container.

### For Long-Running Test Servers

Add periodic cleanup:

```typescript
// Cleanup contexts older than 1 hour
setInterval(async () => {
  const oldContexts = getContextsOlderThan(Date.now() - 3600000);
  for (const contextId of oldContexts) {
    await mcpWeb.resetBrowser({ contextId });
  }
}, 3600000);
```

## Troubleshooting

### Test passes locally, fails in CI

**Symptom**: Test works on your machine but fails in CI
**Cause**: Leftover state on local machine
**Fix**: 
```bash
npm run kill:servers
npm run start:servers
# Or add data.reset precondition
```

### Tests fail when run in parallel

**Symptom**: Tests pass individually, fail when run together
**Cause**: Shared test data (not using unique contexts properly)
**Fix**: Ensure each test has:
```yaml
preconditions:
  - mcp: "data.reset"
  - mcp: "data.user.create"
    store_as: "testUser"
```

### Browser context count keeps growing

**Symptom**: Memory usage increases over time
**Cause**: Contexts not being cleaned up
**Fix**: Add reset endpoint call or restart server periodically

## Summary

✅ **Do This:**
- Let the agent create unique contexts (automatic)
- Add `data.reset` precondition to each scenario
- Make tests self-contained and order-independent

❌ **Don't Do This:**
- Restart servers between tests
- Share browser contexts
- Depend on execution order
- Skip data cleanup

**Result**: Fast, reliable, scalable test execution! 🚀

