export interface JSONLEntry {
  type: 'run_start' | 'scenario_start' | 'precondition' | 'step' | 'scenario_end' | 'run_end';
  timestamp: string;
  [key: string]: any;
}

export interface RunStartEntry extends JSONLEntry {
  type: 'run_start';
  runId: string;
  scenarioId: string;
}

export interface ScenarioStartEntry extends JSONLEntry {
  type: 'scenario_start';
  scenarioId: string;
}

export interface PreconditionEntry extends JSONLEntry {
  type: 'precondition';
  step: number;
  action: string;
  params: any;
  result: any;
}

export interface StepEntry extends JSONLEntry {
  type: 'step';
  step: number;
  observation: {
    url: string;
    title: string;
    nodeCount: number;
  };
  action: {
    type: string;
    params: any;
  };
  reasoning: string;
  tokens: {
    prompt: number;
    completion: number;
    cost: number;
  };
}

export interface ScenarioEndEntry extends JSONLEntry {
  type: 'scenario_end';
  scenarioId: string;
  status: 'success' | 'failure' | 'error';
  steps: number;
  duration: number;
  totalCost: number;
}

export interface RunEndEntry extends JSONLEntry {
  type: 'run_end';
  runId: string;
  status: 'success' | 'failure' | 'error';
  duration: number;
  totalCost: number;
}

export interface ParsedScenario {
  runId: string;
  scenarioId: string;
  status: 'success' | 'failure' | 'error';
  steps: StepEntry[];
  preconditions: PreconditionEntry[];
  totalSteps: number;
  duration: number;
  totalCost: number;
  startTime: Date;
  endTime: Date;
}

export interface EntropyMetric {
  value: number;
  elementFrequencies: Record<string, number>;
  totalInteractions: number;
}

export interface BacktrackMetric {
  count: number;
  urlHistory: string[];
  backtrackPoints: Array<{
    step: number;
    url: string;
    previousStep: number;
  }>;
}

export interface OptimalityMetric {
  ratio: number;
  actualSteps: number;
  optimalSteps: number;
}

export interface TimingMetric {
  timeToFirstAction: number;
  totalDuration: number;
  avgStepLatency: number;
  stepLatencies: number[];
}

export interface ScenarioMetrics {
  scenarioId: string;
  runId: string;
  status: 'success' | 'failure' | 'error';
  entropy: EntropyMetric;
  backtracks: BacktrackMetric;
  optimality: OptimalityMetric;
  timing: TimingMetric;
  totalSteps: number;
  totalCost: number;
  dataVerificationCount: number;
  verificationSteps: number[];
  endTime: Date;
}

export interface AggregateMetrics {
  totalScenarios: number;
  successCount: number;
  failureCount: number;
  errorCount: number;
  passRate: number;
  medianSteps: number;
  medianDuration: number;
  medianEntropy: number;
  medianBacktracks: number;
  medianOptimality: number;
  totalCost: number;
  scenarios: ScenarioMetrics[];
}

