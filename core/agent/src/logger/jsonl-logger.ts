import { appendFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export class JSONLLogger {
  private outputPath: string;

  constructor(outputPath: string) {
    this.outputPath = outputPath;
    
    const dir = dirname(outputPath);
    mkdirSync(dir, { recursive: true });
    
    writeFileSync(outputPath, '');
  }

  logRunStart(data: { runId: string; scenarioId: string; timestamp: string }) {
    this.log({ type: 'run_start', ...data });
  }

  logScenarioStart(data: { scenarioId: string; timestamp: string }) {
    this.log({ type: 'scenario_start', ...data });
  }

  logPrecondition(data: {
    step: number;
    action: string;
    params: any;
    result: any;
    timestamp: string;
  }) {
    this.log({ type: 'precondition', ...data });
  }

  logStep(data: {
    step: number;
    observation: {
      url: string;
      title: string;
      nodeCount: number;
    };
    action: any;
    reasoning: string;
    tokens: {
      prompt: number;
      completion: number;
      cost: number;
    };
    timestamp: string;
  }) {
    this.log({ type: 'step', ...data });
  }

  logScenarioEnd(data: {
    scenarioId: string;
    status: 'success' | 'failure' | 'error';
    steps: number;
    duration: number;
    totalCost: number;
    timestamp: string;
    error?: string;
  }) {
    this.log({ type: 'scenario_end', ...data });
  }

  logRunEnd(data: {
    runId: string;
    status: 'success' | 'failure' | 'error';
    duration: number;
    totalCost: number;
    timestamp: string;
  }) {
    this.log({ type: 'run_end', ...data });
  }

  private log(data: Record<string, any>) {
    const line = JSON.stringify(data) + '\n';
    appendFileSync(this.outputPath, line);
  }
}

