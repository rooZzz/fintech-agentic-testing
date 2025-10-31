import { ReportData } from './types.js';

function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(4)}`;
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'success': return '#10b981';
    case 'failure': return '#ef4444';
    case 'error': return '#f59e0b';
    default: return '#6b7280';
  }
}

function getMetricColor(value: number, thresholds: { good: number; warning: number; }): string {
  if (value <= thresholds.good) return '#10b981';
  if (value <= thresholds.warning) return '#f59e0b';
  return '#ef4444';
}

function getOptimalityColor(ratio: number): string {
  if (ratio >= 0.75) return '#10b981';
  if (ratio >= 0.5) return '#f59e0b';
  return '#ef4444';
}

export function generateHTML(data: ReportData): string {
  const { aggregate, scenarios } = data;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f9fafb;
      color: #111827;
      padding: 2rem;
      line-height: 1.6;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    header {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }
    
    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      color: #1f2937;
    }
    
    .subtitle {
      color: #6b7280;
      font-size: 0.875rem;
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    
    .metric-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .metric-label {
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 0.5rem;
    }
    
    .metric-value {
      font-size: 2rem;
      font-weight: 700;
      color: #1f2937;
    }
    
    .metric-value.success {
      color: #10b981;
    }
    
    .metric-value.warning {
      color: #f59e0b;
    }
    
    .metric-value.error {
      color: #ef4444;
    }
    
    .section {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }
    
    h2 {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      color: #1f2937;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th {
      background: #f9fafb;
      padding: 0.75rem;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }
    
    td {
      padding: 0.75rem;
      border-bottom: 1px solid #e5e7eb;
    }
    
    tr:hover {
      background: #f9fafb;
    }
    
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .status-success {
      background: #d1fae5;
      color: #065f46;
    }
    
    .status-failure {
      background: #fee2e2;
      color: #991b1b;
    }
    
    .status-error {
      background: #fef3c7;
      color: #92400e;
    }
    
    .number {
      font-variant-numeric: tabular-nums;
    }
    
    .details-section {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
    }
    
    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    
    .detail-item {
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: 4px;
    }
    
    .detail-label {
      font-size: 0.75rem;
      color: #6b7280;
      margin-bottom: 0.25rem;
    }
    
    .detail-value {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1f2937;
    }
    
    .expandable {
      cursor: pointer;
    }
    
    .expandable-content {
      display: none;
    }
    
    .expandable.expanded .expandable-content {
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${data.title}</h1>
      <p class="subtitle">Generated on ${data.generatedAt.toLocaleString()}</p>
    </header>
    
    <div class="summary">
      <div class="metric-card">
        <div class="metric-label">Pass Rate</div>
        <div class="metric-value ${aggregate.passRate >= 0.95 ? 'success' : aggregate.passRate >= 0.75 ? 'warning' : 'error'}">
          ${formatPercent(aggregate.passRate)}
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Total Scenarios</div>
        <div class="metric-value">${aggregate.totalScenarios}</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Median Steps</div>
        <div class="metric-value ${aggregate.medianSteps <= 5 ? 'success' : aggregate.medianSteps <= 10 ? 'warning' : 'error'}">
          ${formatNumber(aggregate.medianSteps, 0)}
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Median Duration</div>
        <div class="metric-value">${formatNumber(aggregate.medianDuration, 1)}s</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Total Cost</div>
        <div class="metric-value">${formatCurrency(aggregate.totalCost)}</div>
      </div>
    </div>
    
    <div class="section">
      <h2>Median Metrics</h2>
      <div class="details-grid">
        <div class="detail-item">
          <div class="detail-label">Click Entropy</div>
          <div class="detail-value" style="color: ${getMetricColor(aggregate.medianEntropy, { good: 2.5, warning: 3.5 })}">
            ${formatNumber(aggregate.medianEntropy, 2)}
          </div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Backtracks</div>
          <div class="detail-value" style="color: ${getMetricColor(aggregate.medianBacktracks, { good: 2, warning: 4 })}">
            ${formatNumber(aggregate.medianBacktracks, 0)}
          </div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Path Optimality</div>
          <div class="detail-value" style="color: ${getOptimalityColor(aggregate.medianOptimality)}">
            ${formatPercent(aggregate.medianOptimality)}
          </div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Success Count</div>
          <div class="detail-value" style="color: #10b981">${aggregate.successCount}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Failure Count</div>
          <div class="detail-value" style="color: #ef4444">${aggregate.failureCount}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Error Count</div>
          <div class="detail-value" style="color: #f59e0b">${aggregate.errorCount}</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>Scenario Results</h2>
      <table>
        <thead>
          <tr>
            <th>Scenario ID</th>
            <th>Status</th>
            <th>Steps</th>
            <th>Duration</th>
            <th>Entropy</th>
            <th>Backtracks</th>
            <th>Optimality</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          ${scenarios.map((scenario, index) => `
            <tr class="expandable" onclick="this.classList.toggle('expanded')">
              <td><strong>${scenario.scenarioId}</strong></td>
              <td>
                <span class="status-badge status-${scenario.status}">
                  ${scenario.status}
                </span>
              </td>
              <td class="number">${scenario.totalSteps}</td>
              <td class="number">${formatNumber(scenario.timing.totalDuration, 2)}s</td>
              <td class="number" style="color: ${getMetricColor(scenario.entropy.value, { good: 2.5, warning: 3.5 })}">
                ${formatNumber(scenario.entropy.value, 2)}
              </td>
              <td class="number" style="color: ${getMetricColor(scenario.backtracks.count, { good: 2, warning: 4 })}">
                ${scenario.backtracks.count}
              </td>
              <td class="number" style="color: ${getOptimalityColor(scenario.optimality.ratio)}">
                ${formatPercent(scenario.optimality.ratio)}
              </td>
              <td class="number">${formatCurrency(scenario.totalCost)}</td>
            </tr>
            <tr class="expandable-content">
              <td colspan="8">
                <div class="details-section">
                  <h3 style="margin-bottom: 1rem;">Detailed Metrics</h3>
                  <div class="details-grid">
                    <div class="detail-item">
                      <div class="detail-label">Run ID</div>
                      <div class="detail-value" style="font-size: 0.875rem;">${scenario.runId}</div>
                    </div>
                    <div class="detail-item">
                      <div class="detail-label">Time to First Action</div>
                      <div class="detail-value">${formatNumber(scenario.timing.timeToFirstAction, 2)}s</div>
                    </div>
                    <div class="detail-item">
                      <div class="detail-label">Avg Step Latency</div>
                      <div class="detail-value">${formatNumber(scenario.timing.avgStepLatency, 2)}s</div>
                    </div>
                    <div class="detail-item">
                      <div class="detail-label">Total Interactions</div>
                      <div class="detail-value">${scenario.entropy.totalInteractions}</div>
                    </div>
                    <div class="detail-item">
                      <div class="detail-label">Optimal Steps</div>
                      <div class="detail-value">${scenario.optimality.optimalSteps}</div>
                    </div>
                    <div class="detail-item">
                      <div class="detail-label">Actual Steps</div>
                      <div class="detail-value">${scenario.optimality.actualSteps}</div>
                    </div>
                  </div>
                  ${scenario.backtracks.urlHistory.length > 0 ? `
                    <h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">URL History</h4>
                    <ol style="padding-left: 1.5rem; color: #6b7280; font-size: 0.875rem;">
                      ${scenario.backtracks.urlHistory.map(url => `<li>${url}</li>`).join('')}
                    </ol>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

