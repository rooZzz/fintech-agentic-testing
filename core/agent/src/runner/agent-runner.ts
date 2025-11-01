import { GoalSpec, ScenarioResult, StepResult, AgentContext } from '../schema/types.js';
import { mcpData, mcpWeb } from '../mcp/client.js';
import { OpenAIClient } from '../llm/openai-client.js';
import { JSONLLogger } from '../logger/jsonl-logger.js';
import { discoverAllTools, formatToolsForPrompt } from '../mcp/tool-discovery.js';

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
    timestamp: new Date().toISOString(),
  });

  logger.logScenarioStart({
    scenarioId: spec.id,
    timestamp: new Date().toISOString(),
  });

  console.log('Discovering available MCP operations...');
  const discoveredTools = await discoverAllTools();
  const toolsPrompt = formatToolsForPrompt(discoveredTools);
  console.log(`✓ Discovered ${discoveredTools.web.length + discoveredTools.data.length} operations`);

  const context: AgentContext = {
    spec,
    variables: { _contextId: contextId },
    steps: [],
    startTime,
    totalCost: 0,
  };

  try {
    await runPreconditions(spec, context, logger);

    const client = new OpenAIClient(spec, toolsPrompt);

    await mcpWeb.navigate({ url: spec.context.start_url, contextId });

    for (let step = 1; step <= spec.constraints.max_steps; step++) {
      const observation = await mcpWeb.observe(contextId);

      console.log(`\nStep ${step}:`);
      console.log(`URL: ${observation.url}`);
      console.log(`Interactive elements: ${observation.nodes.filter(n => n.visible && n.enabled).length}`);

      const recentActions = context.steps.slice(-3).map(s => ({
        step: s.step,
        action: s.action,
        reasoning: s.reasoning
      }));

      const { plan, tokens } = await client.planNextAction(
        observation,
        step,
        context.variables,
        recentActions
      );

      context.totalCost += tokens.cost;

      console.log(`Reasoning: ${plan.reasoning}`);
      console.log(`Action: ${plan.action.type} ${JSON.stringify(plan.action.params)}`);
      console.log(`Cost: $${tokens.cost.toFixed(4)} (total: $${context.totalCost.toFixed(4)})`);

      if (context.totalCost > spec.constraints.max_cost_usd) {
        throw new Error(
          `Cost limit exceeded: $${context.totalCost.toFixed(4)} > $${spec.constraints.max_cost_usd}`
        );
      }

      if (plan.goalMet) {
        console.log(`✓ Agent declares goal met: ${plan.reasoning}`);
        
        const duration = (Date.now() - startTime) / 1000;
        logger.logScenarioEnd({
          scenarioId: spec.id,
          status: 'success',
          steps: step,
          duration,
          totalCost: context.totalCost,
          timestamp: new Date().toISOString(),
        });

        logger.logRunEnd({
          runId,
          status: 'success',
          duration,
          totalCost: context.totalCost,
          timestamp: new Date().toISOString(),
        });

        await mcpWeb.resetBrowser({ contextId });

        return {
          scenarioId: spec.id,
          status: 'success',
          steps: context.steps,
          totalSteps: step,
          duration,
          totalCost: context.totalCost,
        };
      }

      const actionResult = await dispatchAction(plan.action, contextId);

      const stepResult: StepResult = {
        step,
        observation,
        action: plan.action,
        reasoning: plan.reasoning,
        tokens,
        timestamp: new Date().toISOString(),
      };

      context.steps.push(stepResult);

      logger.logStep({
        step,
        observation: {
          url: observation.url,
          title: observation.title,
          nodeCount: observation.nodes.length,
        },
        action: plan.action,
        reasoning: plan.reasoning,
        result: plan.action.type.startsWith('data.') ? actionResult : undefined,
        tokens,
        timestamp: new Date().toISOString(),
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await mcpWeb.resetBrowser({ contextId }).catch(() => {});
    throw new Error(`Max steps (${spec.constraints.max_steps}) reached without success`);
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`\n✗ Scenario failed: ${errorMessage}`);

    logger.logScenarioEnd({
      scenarioId: spec.id,
      status: 'error',
      steps: context.steps.length,
      duration,
      totalCost: context.totalCost,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });

    logger.logRunEnd({
      runId,
      status: 'error',
      duration,
      totalCost: context.totalCost,
      timestamp: new Date().toISOString(),
    });

    await mcpWeb.resetBrowser({ contextId }).catch(() => {});

    return {
      scenarioId: spec.id,
      status: 'error',
      steps: context.steps,
      totalSteps: context.steps.length,
      duration,
      totalCost: context.totalCost,
      error: errorMessage,
    };
  }
}

async function runPreconditions(
  spec: GoalSpec,
  context: AgentContext,
  logger: JSONLLogger
): Promise<void> {
  if (!spec.preconditions || spec.preconditions.length === 0) {
    return;
  }

  console.log('\nRunning preconditions:');

  for (let i = 0; i < spec.preconditions.length; i++) {
    const precondition = spec.preconditions[i];
    console.log(`  ${i + 1}. ${precondition.mcp}(${JSON.stringify(precondition.params)})`);

    let result: any;

    if (precondition.mcp === 'data.user.create') {
      result = await mcpData.createUser(precondition.params as { plan: string; requires2FA: boolean });
    } else if (precondition.mcp === 'data.reset') {
      result = await mcpData.reset(precondition.params);
    } else if (precondition.mcp === 'data.loan.seed') {
      result = await mcpData.seedLoans(precondition.params as { count?: number });
    } else if (precondition.mcp === 'data.loan.list') {
      result = await mcpData.listLoans(precondition.params as { amount?: number; term?: number; loanType?: string });
    } else if (precondition.mcp === 'data.loan.reset') {
      result = await mcpData.resetLoans();
    } else {
      throw new Error(`Unknown precondition MCP: ${precondition.mcp}`);
    }

    if (precondition.store_as) {
      context.variables[precondition.store_as] = result;
      console.log(`    Stored as: ${precondition.store_as}`);
    }

    logger.logPrecondition({
      step: i,
      action: precondition.mcp,
      params: precondition.params,
      result,
      timestamp: new Date().toISOString(),
    });
  }
}

async function dispatchAction(action: any, contextId: string): Promise<any> {
  if (action.type === 'ui.act.click') {
    return await mcpWeb.click({ ...action.params, contextId });
  } else if (action.type === 'ui.act.type') {
    return await mcpWeb.type({ ...action.params, contextId });
  } else if (action.type === 'ui.navigate') {
    return await mcpWeb.navigate({ ...action.params, contextId });
  } else if (action.type === 'data.user.get') {
    return await mcpData.getUser(action.params);
  } else if (action.type === 'data.loan.list') {
    return await mcpData.listLoans(action.params);
  } else if (action.type === 'data.loan.get') {
    return await mcpData.getLoan(action.params);
  } else {
    throw new Error(`Unknown action type: ${action.type}`);
  }
}

