import { StepEntry, BacktrackMetric } from './types.js';

export function calculateBacktracks(steps: StepEntry[]): BacktrackMetric {
  const urlHistory: string[] = [];
  const backtrackPoints: Array<{
    step: number;
    url: string;
    previousStep: number;
  }> = [];
  
  for (const step of steps) {
    const currentUrl = step.observation.url;
    const previousIndex = urlHistory.indexOf(currentUrl);
    
    if (previousIndex !== -1 && previousIndex < urlHistory.length - 1) {
      backtrackPoints.push({
        step: step.step,
        url: currentUrl,
        previousStep: previousIndex + 1
      });
    }
    
    urlHistory.push(currentUrl);
  }
  
  return {
    count: backtrackPoints.length,
    urlHistory,
    backtrackPoints
  };
}

export function calculateAggregateBacktracks(allSteps: StepEntry[][]): number {
  let totalBacktracks = 0;
  
  for (const steps of allSteps) {
    const result = calculateBacktracks(steps);
    totalBacktracks += result.count;
  }
  
  return totalBacktracks;
}

