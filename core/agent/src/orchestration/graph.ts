// @ts-nocheck
import { StateGraph, END } from '@langchain/langgraph';
import { AgentState, GoalSpec, ScenarioResult } from '../schema/types.js';
import { TraceStore } from '../evidence/trace-store.js';
import { ContextAssembler } from '../context/assembler.js';
import { PolicyGuard } from '../guard/policy-guard.js';
import { UIActor } from '../actor/ui-actor.js';
import { ProbeRegistry } from '../probes/registry-generator.js';
import { ProbeBroker } from '../probes/probe-broker.js';
import { ValidatorExecute } from '../validation/validator-execute.js';
import { Critic } from '../critic/critic.js';
import { PreconditionPlanner } from '../agents/precondition-planner.js';
import { GoalChecker } from '../agents/goal-checker.js';
import { Planner } from '../agents/planner.js';
import { ValidatorPlanner } from '../agents/validator-planner.js';
import { mcpWeb, mcpData } from '../mcp/client.js';
import { discoverAllTools } from '../mcp/tool-discovery.js';

export class AgenticWorkflow {
  private contextAssembler: ContextAssembler;
  private guard: PolicyGuard;
  private actor: UIActor;
  private probeRegistry: ProbeRegistry;
  private probeBroker: ProbeBroker;
  private critic: Critic;
  private preconditionPlanner: PreconditionPlanner;
  private goalChecker: GoalChecker;
  private planner: Planner;
  private validatorPlanner: ValidatorPlanner;

  constructor() {
    this.contextAssembler = new ContextAssembler();
    this.guard = new PolicyGuard();
    this.actor = new UIActor();
    this.probeRegistry = new ProbeRegistry();
    this.preconditionPlanner = new PreconditionPlanner();
    this.goalChecker = new GoalChecker();
    this.planner = new Planner();
    this.validatorPlanner = new ValidatorPlanner();
  }

  async initialize(): Promise<void> {
    await this.probeRegistry.initialize();
  }

  buildGraph() {
    const workflow = new StateGraph<AgentState>({
      channels: {
        goal: null,
        sharedMemory: null,
        currentSDOM: null,
        lastSDelta: null,
        history: null,
        traceStore: null,
        budgets: null,
        criticHint: null,
        phase: null,
        goalCheckerResult: null,
        plannerMode: null,
        contextId: null,
        totalCost: null,
        startTime: null
      }
    });

    workflow.addNode('preconditions', this.runPreconditions.bind(this));
    workflow.addNode('observe', this.observeUI.bind(this));
    workflow.addNode('goalCheck', this.checkGoal.bind(this));
    workflow.addNode('plan', this.planAction.bind(this));
    workflow.addNode('guard', this.guardAction.bind(this));
    workflow.addNode('act', this.executeAction.bind(this));
    workflow.addNode('validatePlan', this.planValidation.bind(this));
    workflow.addNode('validateExecute', this.executeValidation.bind(this));
    workflow.addNode('criticEvaluate', this.evaluateCritic.bind(this));

    workflow.setEntryPoint('preconditions');

    workflow.addEdge('preconditions', 'observe');
    workflow.addEdge('observe', 'goalCheck');
    
    workflow.addConditionalEdges(
      'goalCheck',
      (state: AgentState) => state.goalCheckerResult?.goalMet ? 'done' : 'next',
      {
        'done': 'plan',
        'next': 'plan'
      }
    );

    workflow.addConditionalEdges(
      'plan',
      (state: AgentState) => state.plannerMode || 'next',
      {
        'next': 'guard',
        'done': 'criticEvaluate'
      }
    );

    workflow.addEdge('guard', 'act');
    workflow.addEdge('act', 'observe');
    workflow.addEdge('validatePlan', 'validateExecute');
    workflow.addEdge('validateExecute', 'criticEvaluate');

    workflow.addConditionalEdges(
      'criticEvaluate',
      (state: AgentState) => {
        if (state.phase === 'complete') {
          return 'end';
        }
        if (state.criticHint) {
          return 'retry';
        }
        if (state.plannerMode === 'next') {
          return 'continue';
        }
        return 'end';
      },
      {
        'end': END,
        'retry': 'observe',
        'continue': 'observe'
      }
    );

    return workflow.compile();
  }

  private async runPreconditions(state: AgentState): Promise<Partial<AgentState>> {
    console.log('\n🔧 Running preconditions...');
    
    if (!state.goal.preconditions || state.goal.preconditions.length === 0) {
      return { phase: 'execution' };
    }

    const discovered = await discoverAllTools();
    const dataTools = discovered.data.filter(t => 
      !t.annotations?.readOnlyHint && 
      (t.name.includes('.create') || t.name.includes('.seed') || t.name.includes('.reset'))
    );

    for (let i = 0; i < state.goal.preconditions.length; i++) {
      const precondition = state.goal.preconditions[i];
      
      if (precondition.instruction) {
        console.log(`  ${i + 1}. "${precondition.instruction}"`);
        
        const plan = await this.preconditionPlanner.plan(
          precondition.instruction,
          dataTools,
          Object.fromEntries(state.sharedMemory.entries())
        );

        const result = await mcpData.callTool(plan.tool, plan.params);
        
        const storeName = precondition.as || precondition.store_as || plan.suggestedName;
        if (storeName && storeName !== 'none') {
          state.sharedMemory.set(storeName, {
            _meta: { description: plan.description, createdBy: plan.tool },
            ...result
          });
          console.log(`      ✓ Stored as: ${storeName}`);
        }
      } else if (precondition.mcp) {
        console.log(`  ${i + 1}. ${precondition.mcp}`);
        const result = await mcpData.callTool(precondition.mcp, precondition.params || {});
        
        const storeName = precondition.as || precondition.store_as;
        if (storeName) {
          state.sharedMemory.set(storeName, result);
        }
      }
    }

    await mcpWeb.navigate({
      url: state.goal.context.start_url,
      contextId: state.contextId
    });

    return { phase: 'execution' };
  }

  private async observeUI(state: AgentState): Promise<Partial<AgentState>> {
    const lastAction = state.history.length > 0 
      ? state.history[state.history.length - 1].action.type
      : undefined;

    const observation = await mcpWeb.observe({
      contextId: state.contextId,
      goal: state.goal.goal.description,
      lastAction,
      expectingValidation: lastAction?.includes('submit') || lastAction?.includes('save')
    });

    return {
      currentSDOM: observation.sdom,
      lastSDelta: observation.sdelta
    };
  }

  private async checkGoal(state: AgentState): Promise<Partial<AgentState>> {
    if (state.budgets.steps <= state.history.length) {
      return {
        phase: 'complete',
        goalCheckerResult: { goalMet: false, confidence: 0, reasoning: 'Budget exceeded' }
      };
    }

    const recentOutcomes = state.traceStore.outcomes ? Array.from(state.traceStore.outcomes.values()).slice(-3) : [];
    
    const result = await this.goalChecker.check(
      state.goal,
      recentOutcomes,
      state.lastSDelta
    );

    console.log(`\n🎯 Goal Check: ${result.goalMet ? 'MET' : 'NOT MET'} (confidence: ${result.confidence})`);

    return {
      goalCheckerResult: result,
      plannerMode: result.goalMet ? 'done' : 'next'
    };
  }

  private async planAction(state: AgentState): Promise<Partial<AgentState>> {
    if (!state.currentSDOM || !state.plannerMode) {
      throw new Error('Invalid state for planning');
    }

    this.probeBroker = new ProbeBroker(this.probeRegistry);
    const validatorExecute = new ValidatorExecute(this.probeBroker, state.traceStore as any);
    this.critic = new Critic(state.traceStore as any);

    const context = this.contextAssembler.buildPlannerContext(
      state.goal,
      state.sharedMemory,
      state.traceStore.outcomes ? Array.from(state.traceStore.outcomes.values()).slice(-5) : [],
      state.budgets
    );

    const plan = await this.planner.plan(
      state.plannerMode,
      state.goal,
      state.currentSDOM,
      state.lastSDelta,
      context.recentOutcomes,
      context.credentials,
      context.ids,
      state.criticHint
    );

    console.log(`\n📋 Plan (${plan.mode}): ${plan.reasoning}`);
    if (plan.action) {
      console.log(`   Action: ${plan.action.type}`, plan.action.params);
    }
    if (plan.evidence_claims) {
      console.log(`   Evidence: ${plan.evidence_claims.join(', ')}`);
    }

    return {
      plannerMode: plan.mode,
      ...plan
    };
  }

  private async guardAction(state: AgentState): Promise<Partial<AgentState>> {
    const action = state.history.length > 0 ? state.history[state.history.length - 1]?.action : null;
    
    if (!action) {
      return {};
    }

    const guardResult = this.guard.check(
      action,
      state.budgets,
      state.history.length,
      state.totalCost,
      state.currentSDOM
    );

    if (!guardResult.allowed) {
      console.log(`\n🚫 Guard blocked action: ${guardResult.reason}`);
      return {
        phase: 'complete',
        criticHint: `Action blocked by guard: ${guardResult.reason}`
      };
    }

    return {};
  }

  private async executeAction(state: AgentState): Promise<Partial<AgentState>> {
    const lastPlan = state.history[state.history.length - 1];
    if (!lastPlan?.action) {
      return {};
    }

    console.log(`\n⚡ Executing: ${lastPlan.action.type}`);

    const result = await this.actor.execute(
      lastPlan.action,
      state.contextId,
      state.history.length
    );

    if (!result.success) {
      console.log(`   ✗ Failed: ${result.error}`);
    } else {
      console.log(`   ✓ Success`);
    }

    return {};
  }

  private async planValidation(state: AgentState): Promise<Partial<AgentState>> {
    if (!state.currentSDOM || !state.lastSDelta) {
      return {};
    }

    const lastAction = state.history[state.history.length - 1]?.action;
    if (!lastAction) {
      return {};
    }

    const context = this.contextAssembler.buildValidatorContext(state.goal, state.sharedMemory);

    const plan = await this.validatorPlanner.plan(
      lastAction,
      state.lastSDelta,
      state.goal,
      this.probeRegistry.getToolNames(),
      context.credentials,
      context.ids
    );

    console.log(`\n✓ Validation Plan: ${plan.assertions.length} assertions, ${plan.probes.length} probes`);

    return {};
  }

  private async executeValidation(state: AgentState): Promise<Partial<AgentState>> {
    if (!state.currentSDOM) {
      return {};
    }

    this.probeBroker = new ProbeBroker(this.probeRegistry);
    const validatorExecute = new ValidatorExecute(this.probeBroker, state.traceStore as any);

    const outcome = await validatorExecute.execute(
      [],
      [],
      state.currentSDOM,
      state.sharedMemory,
      state.history.length
    );

    console.log(`   Result: ${outcome.overall} (${outcome.layer})`);

    return {};
  }

  private async evaluateCritic(state: AgentState): Promise<Partial<AgentState>> {
    this.critic = new Critic(state.traceStore as any);

    const lastOutcome = state.traceStore.outcomes 
      ? Array.from(state.traceStore.outcomes.values()).slice(-1)[0]
      : null;

    const result = this.critic.evaluate(
      state.plannerMode || 'next',
      lastOutcome || null,
      undefined,
      state.history.length
    );

    console.log(`\n⚖️  Critic: ${result.decision}`);
    if (result.hint) {
      console.log(`   Hint: ${result.hint}`);
    }

    if (result.decision === 'success' || result.decision === 'failure') {
      return {
        phase: 'complete',
        criticHint: undefined
      };
    }

    return {
      criticHint: result.hint
    };
  }
}

