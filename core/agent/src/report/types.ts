import { AggregateMetrics, ScenarioMetrics } from '../metrics/types.js';

export interface ReportData {
  title: string;
  generatedAt: Date;
  aggregate: AggregateMetrics;
  scenarios: ScenarioMetrics[];
}

export interface ReportOptions {
  outputPath: string;
  title?: string;
  includeDetails?: boolean;
}

export interface ChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}

export interface PathNode {
  url: string;
  step: number;
  children: PathNode[];
  backtrack: boolean;
}

