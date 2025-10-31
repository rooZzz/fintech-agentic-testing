import { StepEntry, OptimalityMetric } from './types.js';

const OPTIMAL_PATHS: Record<string, number> = {
  'login-and-dashboard': 3,
  'get-to-dashboard': 3,
  'get-to-credit-report': 4,
};

export function calculateOptimality(
  scenarioId: string,
  actualSteps: number
): OptimalityMetric {
  const optimalSteps = OPTIMAL_PATHS[scenarioId] || actualSteps;
  const ratio = optimalSteps / actualSteps;
  
  return {
    ratio: Math.min(ratio, 1.0),
    actualSteps,
    optimalSteps
  };
}

export function registerOptimalPath(scenarioId: string, steps: number): void {
  if (!OPTIMAL_PATHS[scenarioId] || steps < OPTIMAL_PATHS[scenarioId]) {
    OPTIMAL_PATHS[scenarioId] = steps;
  }
}

export function getOptimalSteps(scenarioId: string): number | null {
  return OPTIMAL_PATHS[scenarioId] || null;
}

