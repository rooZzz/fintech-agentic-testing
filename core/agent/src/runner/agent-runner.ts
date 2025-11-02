import { GoalSpec, ScenarioResult, StepResult, AgentContext } from '../schema/types.js';
import { mcpData, mcpWeb } from '../mcp/client.js';
import { OpenAIClient } from '../llm/openai-client.js';
import { JSONLLogger } from '../logger/jsonl-logger.js';
import { DebugLogger } from '../logger/debug-logger.js';
import { discoverAllTools, formatToolsForPrompt, filterToolsForPreconditioner, filterToolsForValidator } from '../mcp/tool-discovery.js';

export async function runScenario(
  spec: GoalSpec,
  outputPath: string
): Promise<ScenarioResult> {
  const startTime = Date.now();
  const logger = new JSONLLogger(outputPath);
  const debug = new DebugLogger('AGENT');
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
  console.log(`✓ Discovered ${discoveredTools.web.length + discoveredTools.data.length} operations`);

  const context: AgentContext = {
    spec,
    variables: { _contextId: contextId },
    steps: [],
    startTime,
    totalCost: 0,
  };

  try {
    await runPreconditions(spec, context, logger, discoveredTools);
    
    const validatorTools = filterToolsForValidator(discoveredTools);
    const toolsPrompt = formatToolsForPrompt(validatorTools);
    console.log(`✓ Validator agent: ${validatorTools.web.length} UI tools, ${validatorTools.data.length} read-only data tools`);
    
    const client = new OpenAIClient(spec, toolsPrompt);

    await mcpWeb.navigate({ url: spec.context.start_url, contextId });

    for (let step = 1; step <= spec.constraints.max_steps; step++) {
      const observation = await mcpWeb.observe(contextId);

      debug.log(`Step ${step} Observation`, {
        url: observation.url,
        nodeCount: observation.nodes.length
      });

      console.log(`\nStep ${step}:`);
      console.log(`URL: ${observation.url}`);

      const recentActions = context.steps.slice(-5).map(s => ({
        step: s.step,
        action: s.action,
        reasoning: s.reasoning,
        result: s.action.type.startsWith('data.') ? s.result : undefined
      }));

      const { plan, tokens } = await client.planNextAction(
        observation,
        step,
        context.variables,
        recentActions
      );

      context.totalCost += tokens.cost;

      debug.log(`Step ${step} Decision`, {
        reasoning: plan.reasoning,
        actionType: plan.action.type,
        actionParams: plan.action.params,
        tokens: { prompt: tokens.prompt, completion: tokens.completion, cost: tokens.cost }
      });

      console.log(`Reasoning: ${plan.reasoning}`);
      console.log(`Action: ${plan.action.type} ${JSON.stringify(plan.action.params || {})}`);
      console.log(`Cost: $${tokens.cost.toFixed(4)} (total: $${context.totalCost.toFixed(4)})`);

      if (context.totalCost > spec.constraints.max_cost_usd) {
        throw new Error(
          `Cost limit exceeded: $${context.totalCost.toFixed(4)} > $${spec.constraints.max_cost_usd}`
        );
      }

      if (plan.action.type === 'goal.complete') {
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

      if (plan.action.type === 'goal.fail') {
        console.log(`✗ Agent declares failure: ${plan.reasoning}`);

        const duration = (Date.now() - startTime) / 1000;
        logger.logScenarioEnd({
          scenarioId: spec.id,
          status: 'failure',
          steps: step,
          duration,
          totalCost: context.totalCost,
          timestamp: new Date().toISOString(),
          error: plan.reasoning,
        });

        logger.logRunEnd({
          runId,
          status: 'failure',
          duration,
          totalCost: context.totalCost,
          timestamp: new Date().toISOString(),
        });

        await mcpWeb.resetBrowser({ contextId });

        return {
          scenarioId: spec.id,
          status: 'failure',
          steps: context.steps,
          totalSteps: step,
          duration,
          totalCost: context.totalCost,
          error: plan.reasoning,
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
        result: plan.action.type.startsWith('data.') ? actionResult : undefined,
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
  logger: JSONLLogger,
  discoveredTools: { web: any[]; data: any[] }
): Promise<void> {
  if (!spec.preconditions || spec.preconditions.length === 0) {
    return;
  }

  console.log('\nRunning preconditions:');
  
  const preconditionTools = filterToolsForPreconditioner(discoveredTools);
  console.log(`✓ Preconditioner agent: ${preconditionTools.length} write-only data tools`);
  
  const preconditionPrompt = `Available Data Tools:\n${preconditionTools
    .map(t => `- ${t.name}: ${t.description}`)
    .join('\n')}`;
  const preconditionClient = new OpenAIClient(spec, preconditionPrompt);

  for (let i = 0; i < spec.preconditions.length; i++) {
    const precondition: any = spec.preconditions[i];
    let toolName: string;
    let params: any;
    let suggestedName: string | undefined;

    let description: string | undefined;
    
    if (precondition.instruction) {
      console.log(`  ${i + 1}. "${precondition.instruction}"`);
      
      const plan = await preconditionClient.planPrecondition(
        precondition.instruction,
        preconditionTools,
        context.variables
      );
      
      toolName = plan.tool;
      params = plan.params;
      suggestedName = plan.suggestedName;
      description = plan.description;
      
      console.log(`      → ${toolName}(${JSON.stringify(params)})`);
    } else if (precondition.mcp) {
      toolName = precondition.mcp;
      params = precondition.params || {};
      console.log(`  ${i + 1}. ${toolName}(${JSON.stringify(params)})`);
    } else {
      throw new Error('Precondition must have either "instruction" or "mcp" field');
    }

    const result = await dispatchAction(
      { type: toolName, params },
      'precondition'
    );

    const storeName = precondition.as 
      || precondition.store_as 
      || suggestedName 
      || inferStorageName(toolName);

    if (storeName && storeName !== 'none') {
      context.variables[storeName] = {
        _meta: {
          description: description || `Data from ${toolName}`,
          createdBy: toolName,
        },
        ...result
      };
      console.log(`      Stored as: ${storeName}`);
    }

    logger.logPrecondition({
      step: i,
      action: toolName,
      params: params,
      result,
      timestamp: new Date().toISOString(),
    });
  }
}

function inferStorageName(toolName: string): string {
  if (toolName.includes('user.create') || toolName.includes('user.get')) {
    return 'user';
  }
  if (toolName.includes('loan.seed') || toolName.includes('loan.list')) {
    return 'loans';
  }
  if (toolName.includes('loan.get')) {
    return 'loan';
  }
  if (toolName.includes('reset')) {
    return 'none';
  }
  
  const parts = toolName.split('.');
  return parts[parts.length - 1] || 'result';
}

async function dispatchAction(action: any, contextId: string): Promise<any> {
  const { type, params } = action;
  
  if (type.startsWith('ui.')) {
    return await mcpWeb.callTool(type, { ...params, contextId });
  } else if (type.startsWith('data.')) {
    return await mcpData.callTool(type, params);
  } else if (type.startsWith('session.')) {
    return await mcpWeb.callTool(type, { ...params, contextId });
  } else if (type.startsWith('browser.')) {
    return await mcpWeb.callTool(type, { ...params, contextId });
  } else {
    throw new Error(`Unknown action type: ${type}`);
  }
}

