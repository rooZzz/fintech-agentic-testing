import { ChartData } from './types.js';
import { ScenarioMetrics } from '../metrics/types.js';

export function createEntropyChart(scenarios: ScenarioMetrics[]): ChartData {
  return {
    labels: scenarios.map(s => s.scenarioId),
    values: scenarios.map(s => s.entropy.value),
    colors: scenarios.map(s => 
      s.entropy.value < 2.5 ? '#10b981' :
      s.entropy.value < 3.5 ? '#f59e0b' : '#ef4444'
    )
  };
}

export function createBacktracksChart(scenarios: ScenarioMetrics[]): ChartData {
  return {
    labels: scenarios.map(s => s.scenarioId),
    values: scenarios.map(s => s.backtracks.count),
    colors: scenarios.map(s => 
      s.backtracks.count <= 2 ? '#10b981' :
      s.backtracks.count <= 4 ? '#f59e0b' : '#ef4444'
    )
  };
}

export function createOptimalityChart(scenarios: ScenarioMetrics[]): ChartData {
  return {
    labels: scenarios.map(s => s.scenarioId),
    values: scenarios.map(s => s.optimality.ratio),
    colors: scenarios.map(s => 
      s.optimality.ratio >= 0.75 ? '#10b981' :
      s.optimality.ratio >= 0.5 ? '#f59e0b' : '#ef4444'
    )
  };
}

export function createDurationChart(scenarios: ScenarioMetrics[]): ChartData {
  return {
    labels: scenarios.map(s => s.scenarioId),
    values: scenarios.map(s => s.timing.totalDuration)
  };
}

