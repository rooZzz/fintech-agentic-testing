import { GoalSpec, ScenarioResult, AgentState } from '../schema/types.js';
import { TraceStore } from '../evidence/trace-store.js';
import { AgenticWorkflow } from '../orchestration/graph-simple.js';
import { JSONLLogger } from '../logger/jsonl-logger.js';
import { mcpWeb } from '../mcp/client.js';

export async function runScenario(
  spec: GoalSpec,
  outputPath: string
): Promise<ScenarioResult> {
  const startTime = Date.now();
  const logger = new JSONLLogger(outputPath);
  const runId = `run_${Date.now()}`;
  const contextId = `agent_${runId}`;

  logger.logRunStart({
    runId,
    scenarioId: spec.id,
    timestamp: new Date().toISOString()
  });

  logger.logScenarioStart({
    scenarioId: spec.id,
    timestamp: new Date().toISOString()
  });

  console.log('\n🚀 Starting Agentic Testing Team Workflow');
  console.log(`   Scenario: ${spec.id}`);
  console.log(`   Goal: ${spec.goal.description}`);

  try {
    await mcpWeb.resetBrowser({ contextId });
    console.log('   🧹 Browser cleaned up before test');
  } catch (error) {
    console.log('   ⚠️  Browser cleanup before test failed (may not have been open)');
  }

  const workflow = new AgenticWorkflow(logger);
  await workflow.initialize();

  const traceStore = new TraceStore();

  const initialState: AgentState = {
    goal: spec,
    sharedMemory: new Map([['_contextId', contextId]]),
    currentSDOM: null,
    lastSDelta: null,
    currentUrl: null,
    currentTitle: null,
    history: [],
    traceStore: traceStore as any,
    budgets: {
      steps: spec.constraints.max_steps,
      cost: spec.constraints.max_cost_usd,
      time: 300
    },
    criticHint: undefined,
    phase: 'preconditions',
    goalCheckerResult: undefined,
    plannerMode: undefined,
    contextId,
    totalCost: 0,
    startTime
  };

  let finalState: AgentState;
  let status: 'success' | 'failure' | 'error' = 'error';
  let errorMessage: string | undefined;

  try {
    finalState = await workflow.run(initialState);

    if (finalState.phase === 'complete') {
      if (finalState.goalCheckerResult?.goalMet) {
        status = 'success';
        console.log('\n✅ Scenario PASSED');
      } else {
        status = 'failure';
        errorMessage = finalState.goalCheckerResult?.reasoning || 'Goal not met';
        console.log('\n❌ Scenario FAILED:', errorMessage);
      }
    } else {
      status = 'failure';
      errorMessage = 'Workflow did not complete';
      console.log('\n❌ Workflow incomplete');
    }
  } catch (error) {
    status = 'error';
    errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n💥 Error during scenario execution:', errorMessage);
    finalState = initialState;
  }

  const duration = Date.now() - startTime;
  const totalCost = finalState?.totalCost || 0;

  const result: ScenarioResult = {
    scenarioId: spec.id,
    status,
    steps: finalState?.history || [],
    totalSteps: finalState?.history.length || 0,
    duration,
    totalCost,
    error: errorMessage
  };

  logger.logScenarioEnd({
    scenarioId: spec.id,
    status,
    steps: result.totalSteps,
    totalCost,
    duration,
    timestamp: new Date().toISOString()
  });

  logger.logRunEnd({
    runId,
    status,
    duration,
    totalCost,
    timestamp: new Date().toISOString()
  });

  await logger.close();

  try {
    await mcpWeb.resetBrowser({ contextId });
    console.log('\n🧹 Browser cleaned up after test');
  } catch (error) {
    console.log('\n⚠️  Browser cleanup after test failed');
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Status: ${status.toUpperCase()}`);
  console.log(`   Steps: ${result.totalSteps}`);
  console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`   Cost: $${totalCost.toFixed(4)}`);

  return result;
}
