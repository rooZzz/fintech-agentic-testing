import { readFileSync } from 'fs';
import {
  JSONLEntry,
  RunStartEntry,
  ScenarioStartEntry,
  PreconditionEntry,
  StepEntry,
  ScenarioEndEntry,
  RunEndEntry,
  ParsedScenario
} from './types.js';

export function parseJSONL(filePath: string): JSONLEntry[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());
  
  return lines.map(line => {
    try {
      return JSON.parse(line) as JSONLEntry;
    } catch (error) {
      throw new Error(`Failed to parse JSONL line: ${line}`);
    }
  });
}

export function parseScenario(filePath: string): ParsedScenario {
  const entries = parseJSONL(filePath);
  
  const runStart = entries.find(e => e.type === 'run_start') as RunStartEntry;
  const scenarioStart = entries.find(e => e.type === 'scenario_start') as ScenarioStartEntry;
  const scenarioEnd = entries.find(e => e.type === 'scenario_end') as ScenarioEndEntry;
  const steps = entries.filter(e => e.type === 'step') as StepEntry[];
  const preconditions = entries.filter(e => e.type === 'precondition') as PreconditionEntry[];
  
  if (!runStart || !scenarioStart || !scenarioEnd) {
    throw new Error(`Invalid JSONL file: missing required entries in ${filePath}`);
  }
  
  return {
    runId: runStart.runId,
    scenarioId: scenarioEnd.scenarioId,
    status: scenarioEnd.status,
    steps,
    preconditions,
    totalSteps: scenarioEnd.steps,
    duration: scenarioEnd.duration,
    totalCost: scenarioEnd.totalCost,
    startTime: new Date(scenarioStart.timestamp),
    endTime: new Date(scenarioEnd.timestamp)
  };
}

export function parseMultipleScenarios(filePaths: string[]): ParsedScenario[] {
  return filePaths.map(parseScenario);
}

