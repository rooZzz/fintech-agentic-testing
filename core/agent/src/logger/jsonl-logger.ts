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
    result?: any;
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

  logAgentTransition(data: {
    from: string;
    to: string;
    step: number;
    timestamp: string;
    state?: Record<string, any>;
  }) {
    this.log({ type: 'agent_transition', ...data });
  }

  logValidationOutcome(data: {
    outcomeId: string;
    stepNumber: number;
    layer: 'ui_only' | 'backend_only' | 'both';
    overall: 'pass' | 'fail' | 'flaky';
    assertions: Array<{
      query: string;
      passed: boolean;
      actual: any;
      expected: string;
    }>;
    probes: Array<{
      tool: string;
      passed: boolean;
      response?: any;
      expectation?: any;
    }>;
    timestamp: string;
  }) {
    this.log({ type: 'validation_outcome', ...data });
  }

  logEvidenceCitation(data: {
    step: number;
    evidenceIds: string[];
    planner: string;
    reasoning: string;
    timestamp: string;
  }) {
    this.log({ type: 'evidence_citation', ...data });
  }

  logCriticDecision(data: {
    step: number;
    decision: 'continue' | 'retry' | 'success' | 'failure';
    hint?: string;
    reasoning?: string;
    timestamp: string;
  }) {
    this.log({ type: 'critic_decision', ...data });
  }

  logGoalCheck(data: {
    step: number;
    goalMet: boolean;
    confidence: number;
    reasoning: string;
    currentUrl: string | null;
    evaluatedOutcomes: number;
    successCriteria: string;
    suggestedEvidence?: string[];
    timestamp: string;
  }) {
    this.log({ type: 'goal_check', ...data });
  }

  async close() {
    return Promise.resolve();
  }

  private log(data: Record<string, any>) {
    const line = JSON.stringify(data) + '\n';
    appendFileSync(this.outputPath, line);
  }
}

