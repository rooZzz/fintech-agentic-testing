# Phase 4: Metrics & Reporting

**Status**: Complete  
**Date**: October 31, 2025

## Overview

Phase 4 implements a comprehensive metrics computation engine and HTML report generation system. The system analyzes JSONL logs from agent runs to extract information architecture (IA) quality signals including click entropy, backtracks, path optimality, and timing metrics.

## Architecture

### Metrics Module (`core/agent/src/metrics/`)

The metrics module provides functions to parse JSONL logs and compute IA quality metrics.

#### Key Components

1. **Parser** (`parser.ts`)
   - Parses JSONL files line by line
   - Validates entry structure
   - Extracts scenario metadata and steps

2. **Entropy Calculator** (`entropy.ts`)
   - Computes click entropy using Shannon's formula: H = -Σ(p_i × log₂(p_i))
   - Tracks element interaction frequencies
   - Lower entropy indicates clearer navigation paths

3. **Backtrack Detector** (`backtracks.ts`)
   - Identifies URL revisits in navigation history
   - Counts instances where agent returns to previously visited pages
   - Tracks backtrack points with step numbers

4. **Optimality Calculator** (`optimality.ts`)
   - Compares actual steps to optimal path length
   - Ratio = optimal_steps / actual_steps
   - Target: ≥0.75 (agent took ≤33% extra steps)

5. **Timing Metrics** (`timing.ts`)
   - Time to first action (TTFA)
   - Total duration
   - Average step latency
   - Per-step latencies

6. **Analyzer** (`analyzer.ts`)
   - Main entry point for metrics computation
   - Aggregates metrics across multiple scenarios
   - Computes medians and percentiles

### Report Module (`core/agent/src/report/`)

The report module generates self-contained HTML reports with embedded CSS.

#### Key Components

1. **Template** (`template.ts`)
   - HTML generation with inline CSS
   - Responsive design
   - Color-coded metrics (green/yellow/red)
   - Expandable scenario details

2. **Generator** (`generator.ts`)
   - Orchestrates report creation
   - Handles file I/O
   - Creates output directory structure

3. **Charts** (`charts.ts`)
   - Chart data formatters
   - Color mapping for metrics
   - Supports future D3.js integration

4. **Path Tree** (`path-tree.ts`)
   - Builds navigation path tree structure
   - Identifies backtrack points
   - Renders text-based path visualization

## Metrics Reference

### Click Entropy

**Formula**: H = -Σ(p_i × log₂(p_i))

**Interpretation**:
- H < 2.0: Clear, intuitive navigation path
- 2.0 ≤ H < 2.5: Good navigation (target range)
- 2.5 ≤ H < 3.5: Moderate ambiguity
- H ≥ 3.5: High confusion, redesign recommended

**What it measures**: Information architecture clarity. Lower entropy means users consistently interact with the same elements, indicating clear navigation patterns.

### Backtracks

**Definition**: Number of times agent returns to a previously visited URL.

**Interpretation**:
- 0 backtracks: Linear navigation (ideal for simple flows)
- 1-2 backtracks: Acceptable for complex flows
- 3+ backtracks: Navigation confusion or dead ends

**What it measures**: Navigation efficiency. High backtrack counts indicate users getting lost or hitting dead ends.

### Path Optimality

**Formula**: optimality = optimal_steps / actual_steps

**Interpretation**:
- 1.0: Perfect efficiency
- ≥0.75: Good (target threshold)
- 0.5-0.75: Suboptimal but acceptable
- <0.5: Significant inefficiency

**What it measures**: How close the agent's path is to the shortest possible path. Lower ratios indicate unnecessary navigation.

### Time to First Action (TTFA)

**Definition**: Time from page load to first meaningful interaction.

**Interpretation**:
- <3s: Excellent visual hierarchy
- 3-5s: Good (target range)
- 5-10s: Slow, review page layout
- >10s: Poor visual design

**What it measures**: Visual hierarchy clarity. Shorter times indicate clear call-to-action placement.

### Timing Metrics

- **Total Duration**: End-to-end scenario runtime
- **Average Step Latency**: Mean time between actions
- **Per-Step Latencies**: Individual step timing for bottleneck identification

## Usage

### Generate Report from JSONL Files

```bash
npm run agent report out/*.jsonl
```

**Options:**
- Single file: `npm run agent report out/scenario.jsonl`
- Pattern matching: `npm run agent report out/login-*.jsonl`
- Multiple patterns: `npm run agent report out/login-*.jsonl out/credit-*.jsonl`

### Programmatic Usage

```typescript
import { analyzeScenarioFile, analyzeMultipleScenarios } from '@fintech-agentic/agent/metrics/analyzer';
import { generateReport } from '@fintech-agentic/agent/report/generator';

const metrics = analyzeScenarioFile('out/scenario.jsonl');

const aggregate = analyzeMultipleScenarios([
  'out/scenario1.jsonl',
  'out/scenario2.jsonl'
]);

generateReport(aggregate, {
  outputPath: 'out/reports/report.html',
  title: 'Custom Report Title'
});
```

### Test Metrics Computation

```bash
cd core/agent
npx tsx src/test-metrics.ts
```

## Report Structure

### Summary Section
- Pass rate percentage
- Total scenarios count
- Median steps
- Median duration
- Total cost

### Median Metrics Section
- Click entropy with color coding
- Backtrack count
- Path optimality
- Success/failure/error counts

### Scenario Results Table
- Scenario ID
- Status badge (success/failure/error)
- Steps, duration, entropy, backtracks, optimality, cost
- Expandable details with:
  - Run ID
  - Time to first action
  - Average step latency
  - URL history
  - Element interaction frequencies

## File Structure

```
core/agent/src/
├── metrics/
│   ├── types.ts           # TypeScript interfaces for metrics
│   ├── parser.ts          # JSONL parsing and validation
│   ├── entropy.ts         # Click entropy calculation
│   ├── backtracks.ts      # URL revisit detection
│   ├── optimality.ts      # Path optimality computation
│   ├── timing.ts          # Timing metrics
│   └── analyzer.ts        # Main aggregation logic
│
├── report/
│   ├── types.ts           # Report structure interfaces
│   ├── template.ts        # HTML template with CSS
│   ├── generator.ts       # Report generation logic
│   ├── charts.ts          # Chart data formatters
│   └── path-tree.ts       # Navigation path tree
│
└── test-metrics.ts        # Validation test script
```

## Color Coding

The report uses traffic light colors to indicate metric health:

- **Green (#10b981)**: Metric meets target
- **Yellow (#f59e0b)**: Metric in warning range
- **Red (#ef4444)**: Metric needs attention

### Thresholds

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Entropy | < 2.5 | 2.5-3.5 | > 3.5 |
| Backtracks | ≤ 2 | 3-4 | > 4 |
| Optimality | ≥ 0.75 | 0.5-0.75 | < 0.5 |
| Pass Rate | ≥ 95% | 75-95% | < 75% |

## Examples

### Example 1: Single Scenario Report

```bash
npm run agent report out/login-and-dashboard_1761922730412.jsonl
```

**Expected Output:**
```
Agentic Testing Framework - Report Generator
============================================

Found 1 JSONL file(s):
  - login-and-dashboard_1761922730412.jsonl

Generating report...

✓ Report generated successfully!
  Output: /path/to/out/reports/report_2025-10-31T15-30-00-000Z.html

Open in browser:
  open /path/to/out/reports/report_2025-10-31T15-30-00-000Z.html
```

### Example 2: Multiple Scenarios Report

```bash
npm run agent report out/*.jsonl
```

Generates a combined report showing aggregate metrics across all scenario runs, useful for:
- Comparing different scenarios
- Tracking trends over multiple runs
- Identifying consistently problematic flows

## Validation

### Manual Entropy Calculation Example

For login-and-dashboard scenario with 3 steps:
1. Type in email field
2. Type in password field  
3. Click login button

Element frequencies: { 'type:[data-testid="email-input"]': 1, 'type:[data-testid="password-input"]': 1, 'click:login-button': 1 }

Total interactions: 3

Probabilities: p1 = 1/3, p2 = 1/3, p3 = 1/3

Entropy: H = -(3 × (1/3) × log₂(1/3)) = -log₂(1/3) = log₂(3) ≈ 1.585

**Expected**: Low entropy (< 2.5) ✓

### Backtrack Validation

For get-to-credit-report scenario:
- URL history: [/login, /dashboard, /credit-report]
- No repeated URLs
- Backtrack count: 0 ✓

## Future Enhancements

1. **D3.js Visualizations**
   - Interactive path trees
   - Trend charts
   - Heatmaps

2. **Multi-Run Comparison**
   - Side-by-side metric comparison
   - Regression detection
   - Improvement tracking

3. **Screenshot Integration**
   - Embed screenshots at each step
   - Visual diff between runs
   - Highlight clicked elements

4. **Export Formats**
   - PDF export
   - JSON export for CI/CD integration
   - CSV export for spreadsheet analysis

## Troubleshooting

### No JSONL files found

**Problem**: Pattern doesn't match any files  
**Solution**: Check file path and pattern syntax. Use absolute paths or ensure relative paths are correct from project root.

### Failed to generate report

**Problem**: JSONL parsing error  
**Solution**: Ensure JSONL files are valid. Each line must be valid JSON. Check for truncated or corrupted files.

### Metrics seem incorrect

**Problem**: Unexpected metric values  
**Solution**: Run test script to validate calculations. Check that JSONL contains all required fields (observation.url, action.type, etc.).

## Integration with CI/CD

The report command can be integrated into CI/CD pipelines:

```yaml
- name: Generate test report
  run: npm run agent report out/*.jsonl

- name: Upload report
  uses: actions/upload-artifact@v3
  with:
    name: test-report
    path: out/reports/*.html
```

## Performance

- Report generation: <2 seconds for 16 files
- Metrics computation: ~10ms per scenario
- HTML file size: ~50-100KB (self-contained)

## Next Steps (Phase 5)

Phase 5 will focus on:
- Multiple scenario execution via CLI
- Parallel scenario runs
- Session reuse across scenarios
- Glob pattern scenario selection
- Fail-fast mode
- Enhanced CLI with more options

See PROJECT_PLAN.md for Phase 5 details.

