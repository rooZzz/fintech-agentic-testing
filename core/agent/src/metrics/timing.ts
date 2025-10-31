import { StepEntry, TimingMetric, ParsedScenario } from './types.js';

export function calculateTiming(scenario: ParsedScenario): TimingMetric {
  const { steps, startTime, endTime } = scenario;
  
  if (steps.length === 0) {
    return {
      timeToFirstAction: 0,
      totalDuration: scenario.duration,
      avgStepLatency: 0,
      stepLatencies: []
    };
  }
  
  const firstStepTime = new Date(steps[0].timestamp);
  const timeToFirstAction = (firstStepTime.getTime() - startTime.getTime()) / 1000;
  
  const stepLatencies: number[] = [];
  for (let i = 0; i < steps.length; i++) {
    const currentTime = new Date(steps[i].timestamp);
    const previousTime = i === 0 ? startTime : new Date(steps[i - 1].timestamp);
    const latency = (currentTime.getTime() - previousTime.getTime()) / 1000;
    stepLatencies.push(latency);
  }
  
  const avgStepLatency = stepLatencies.reduce((sum, lat) => sum + lat, 0) / stepLatencies.length;
  
  return {
    timeToFirstAction,
    totalDuration: scenario.duration,
    avgStepLatency,
    stepLatencies
  };
}

export function calculateMedianTiming(scenarios: ParsedScenario[]): {
  medianTimeToFirstAction: number;
  medianDuration: number;
  medianStepLatency: number;
} {
  const timings = scenarios.map(calculateTiming);
  
  const ttfaValues = timings.map(t => t.timeToFirstAction).sort((a, b) => a - b);
  const durationValues = timings.map(t => t.totalDuration).sort((a, b) => a - b);
  const latencyValues = timings.flatMap(t => t.stepLatencies).sort((a, b) => a - b);
  
  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
  };
  
  return {
    medianTimeToFirstAction: median(ttfaValues),
    medianDuration: median(durationValues),
    medianStepLatency: median(latencyValues)
  };
}

