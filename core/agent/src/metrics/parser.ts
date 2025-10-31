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

export function parseScenario(filePath: string): ParsedScenario | null {
  try {
    const entries = parseJSONL(filePath);
    
    const runStart = entries.find(e => e.type === 'run_start') as RunStartEntry;
    const scenarioStart = entries.find(e => e.type === 'scenario_start') as ScenarioStartEntry;
    const scenarioEnd = entries.find(e => e.type === 'scenario_end') as ScenarioEndEntry;
    const steps = entries.filter(e => e.type === 'step') as StepEntry[];
    const preconditions = entries.filter(e => e.type === 'precondition') as PreconditionEntry[];
    
    if (!runStart || !scenarioStart || !scenarioEnd) {
      console.warn(`⚠ Skipping incomplete run: ${filePath} (missing required entries)`);
      return null;
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
  } catch (error) {
    console.warn(`⚠ Skipping invalid file: ${filePath} (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}

export function parseMultipleScenarios(filePaths: string[]): ParsedScenario[] {
  const scenarios = filePaths.map(parseScenario).filter((s): s is ParsedScenario => s !== null);
  
  if (scenarios.length === 0) {
    throw new Error('No valid scenario files found. All files were incomplete or invalid.');
  }
  
  console.log(`\n✓ Parsed ${scenarios.length} valid scenario(s) from ${filePaths.length} file(s)\n`);
  
  return scenarios;
}

