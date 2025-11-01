import { parseScenario, parseMultipleScenarios } from './parser.js';
import { calculateEntropy } from './entropy.js';
import { calculateBacktracks } from './backtracks.js';
import { calculateOptimality } from './optimality.js';
import { calculateTiming } from './timing.js';
import { ScenarioMetrics, AggregateMetrics, ParsedScenario } from './types.js';

export function analyzeScenario(scenario: ParsedScenario): ScenarioMetrics {
  const entropy = calculateEntropy(scenario.steps);
  const backtracks = calculateBacktracks(scenario.steps);
  const optimality = calculateOptimality(scenario.scenarioId, scenario.totalSteps);
  const timing = calculateTiming(scenario);
  
  const dataVerificationCount = scenario.steps.filter(step => 
    step.action.type.startsWith('data.')
  ).length;
  
  const verificationSteps = scenario.steps
    .filter(step => step.action.type.startsWith('data.'))
    .map(step => step.step);
  
  return {
    scenarioId: scenario.scenarioId,
    runId: scenario.runId,
    status: scenario.status,
    entropy,
    backtracks,
    optimality,
    timing,
    totalSteps: scenario.totalSteps,
    totalCost: scenario.totalCost,
    dataVerificationCount,
    verificationSteps
  };
}

export function analyzeScenarioFile(filePath: string): ScenarioMetrics {
  const scenario = parseScenario(filePath);
  if (!scenario) {
    throw new Error(`Failed to parse scenario file: ${filePath}`);
  }
  return analyzeScenario(scenario);
}

export function analyzeMultipleScenarios(filePaths: string[]): AggregateMetrics {
  const scenarios = parseMultipleScenarios(filePaths);
  const metrics = scenarios.map(analyzeScenario);
  
  const successCount = metrics.filter(m => m.status === 'success').length;
  const failureCount = metrics.filter(m => m.status === 'failure').length;
  const errorCount = metrics.filter(m => m.status === 'error').length;
  const totalScenarios = metrics.length;
  const passRate = totalScenarios > 0 ? successCount / totalScenarios : 0;
  
  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };
  
  const medianSteps = median(metrics.map(m => m.totalSteps));
  const medianDuration = median(metrics.map(m => m.timing.totalDuration));
  const medianEntropy = median(metrics.map(m => m.entropy.value));
  const medianBacktracks = median(metrics.map(m => m.backtracks.count));
  const medianOptimality = median(metrics.map(m => m.optimality.ratio));
  const totalCost = metrics.reduce((sum, m) => sum + m.totalCost, 0);
  
  return {
    totalScenarios,
    successCount,
    failureCount,
    errorCount,
    passRate,
    medianSteps,
    medianDuration,
    medianEntropy,
    medianBacktracks,
    medianOptimality,
    totalCost,
    scenarios: metrics
  };
}

export { parseScenario, parseMultipleScenarios } from './parser.js';

