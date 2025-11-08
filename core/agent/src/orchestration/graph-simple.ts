import { AgentState, GoalSpec } from '../schema/types.js';
import { TraceStore } from '../evidence/trace-store.js';
import { ContextAssembler } from '../context/assembler.js';
import { PolicyGuard } from '../guard/policy-guard.js';
import { UIActor } from '../actor/ui-actor.js';
import { ProbeRegistry } from '../probes/registry-generator.js';
import { ProbeBroker } from '../probes/probe-broker.js';
import { SemanticValidator } from '../validation/semantic-validator.js';
import { Critic } from '../critic/critic.js';
import { PreconditionPlanner } from '../agents/precondition-planner.js';
import { GoalChecker } from '../agents/goal-checker.js';
import { Planner } from '../agents/planner.js';
import { ProbePlanner } from '../agents/probe-planner.js';
import { mcpWeb, mcpData } from '../mcp/client.js';
import { discoverAllTools } from '../mcp/tool-discovery.js';
import { JSONLLogger } from '../logger/jsonl-logger.js';

export class AgenticWorkflow {
  private contextAssembler: ContextAssembler;
  private guard: PolicyGuard;
  private actor: UIActor;
  private probeRegistry: ProbeRegistry;
  private probeBroker!: ProbeBroker;
  private critic!: Critic;
  private preconditionPlanner: PreconditionPlanner;
  private goalChecker: GoalChecker;
  private planner: Planner;
  private probePlanner: ProbePlanner;
  private semanticValidator: SemanticValidator;
  private logger: JSONLLogger | null;

  constructor(logger?: JSONLLogger) {
    this.contextAssembler = new ContextAssembler();
    this.guard = new PolicyGuard();
    this.actor = new UIActor();
    this.probeRegistry = new ProbeRegistry();
    this.preconditionPlanner = new PreconditionPlanner();
    this.goalChecker = new GoalChecker();
    this.planner = new Planner();
    this.probePlanner = new ProbePlanner();
    this.semanticValidator = new SemanticValidator();
    this.logger = logger || null;
  }

  async initialize(): Promise<void> {
    await this.probeRegistry.initialize();
  }

  async run(initialState: AgentState): Promise<AgentState> {
    let state = initialState;

    state = await this.runPreconditions(state);
    
    while (state.phase !== 'complete' && state.history.length < state.budgets.steps) {
      state = await this.observeUI(state);
      state = await this.checkGoal(state);
      
      if (state.phase === 'complete') break;
      
      state = await this.planAction(state);
      
      if (state.plannerMode === 'done') {
        state = await this.evaluateCritic(state);
        if (state.phase === 'complete') break;
        continue;
      }
      
      const guardResult = await this.guardAction(state);
      if (!guardResult.allowed) {
        state.phase = 'complete';
        break;
      }
      
      state = await this.executeAction(state);
      state = await this.planValidation(state);
      state = await this.executeValidation(state);
      state = await this.evaluateCritic(state);
    }

    return state;
  }

  private async runPreconditions(state: AgentState): Promise<AgentState> {
    console.log('\n🔧 Running preconditions...');
    
    if (!state.goal.preconditions || state.goal.preconditions.length === 0) {
      state.phase = 'execution';
      return state;
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

    await new Promise(resolve => setTimeout(resolve, 1000));

    state.phase = 'execution';
    return state;
  }

  private async observeUI(state: AgentState): Promise<AgentState> {
    const lastAction = state.history.length > 0 
      ? state.history[state.history.length - 1].action.type
      : undefined;

    const observation = await mcpWeb.observe({
      contextId: state.contextId,
      goal: state.goal.goal.description,
      lastAction,
      expectingValidation: false
    });

    state.currentSDOM = observation.sdom;
    state.lastSDelta = observation.sdelta;
    state.currentUrl = observation.url;
    state.currentTitle = observation.title;
    return state;
  }

  private async checkGoal(state: AgentState): Promise<AgentState> {
    if (state.budgets.steps <= state.history.length) {
      state.phase = 'complete';
      state.goalCheckerResult = { goalMet: false, confidence: 0, reasoning: 'Budget exceeded' };
      return state;
    }

    const traceStore = state.traceStore as any;
    const allOutcomes = traceStore.outcomes ? Array.from(traceStore.outcomes.values()) : [];
    
    const result = await this.goalChecker.check(
      state.goal,
      allOutcomes as any[],
      state.lastSDelta,
      state.currentUrl
    );

    console.log(`\n🎯 Goal Check: ${result.goalMet ? 'MET' : 'NOT MET'} (confidence: ${result.confidence})`);

    // Log to JSONL
    if (this.logger) {
      this.logger.logGoalCheck({
        step: state.history.length,
        goalMet: result.goalMet,
        confidence: result.confidence,
        reasoning: result.reasoning,
        currentUrl: state.currentUrl || null,
        evaluatedOutcomes: allOutcomes.length,
        successCriteria: state.goal.goal.success,
        suggestedEvidence: result.suggestedEvidence,
        timestamp: new Date().toISOString()
      });
    }

    state.goalCheckerResult = result;
    state.plannerMode = result.goalMet ? 'done' : 'next';
    return state;
  }

  private async planAction(state: AgentState): Promise<AgentState> {
    if (!state.currentSDOM || !state.plannerMode) {
      throw new Error('Invalid state for planning');
    }

    const traceStore = state.traceStore as any;
    this.probeBroker = new ProbeBroker(this.probeRegistry);
    this.critic = new Critic(traceStore);

    if (state.history.length >= 3) {
      const lastThreeActions = state.history.slice(-3).map(h => ({
        type: h.action.type,
        testId: h.action.params?.testId,
        selector: h.action.params?.selector
      }));
      
      const allSame = lastThreeActions.every(a => 
        a.type === lastThreeActions[0].type && 
        a.testId === lastThreeActions[0].testId &&
        a.selector === lastThreeActions[0].selector
      );
      
      if (allSame && lastThreeActions[0].type !== 'ui.navigate') {
        const actionDesc = lastThreeActions[0].testId || lastThreeActions[0].selector || lastThreeActions[0].type;
        console.log(`\n⚠️  INFINITE LOOP DETECTED: Same action repeated 3 times (${actionDesc})`);
        state.criticHint = `CRITICAL: You are repeating the same action "${actionDesc}" without making progress. You MUST try a completely different approach:\n` +
          `- If clicking isn't working, try navigating directly or filling required fields first\n` +
          `- If the element isn't responding, it may be disabled or require prerequisites\n` +
          `- Consider the page state and whether you need to perform different actions first\n` +
          `- Review validation failures to understand what's blocking progress`;
      }
    }

    const context = this.contextAssembler.buildPlannerContext(
      state.goal,
      state.sharedMemory,
      (traceStore.outcomes ? Array.from(traceStore.outcomes.values()) : []).slice(-5) as any[],
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
      state.currentUrl,
      state.criticHint
    );

    console.log(`\n📋 Plan (${plan.mode}): ${plan.reasoning}`);
    if (plan.action) {
      console.log(`   Action: ${plan.action.type}`, plan.action.params);
      
      state.history.push({
        step: state.history.length + 1,
        observation: {
          url: '',
          title: '',
          sdom: state.currentSDOM,
          sdelta: state.lastSDelta
        },
        action: plan.action,
        reasoning: plan.reasoning,
        tokens: {
          prompt: 0,
          completion: 0,
          cost: 0
        },
        timestamp: new Date().toISOString()
      });
    }
    if (plan.evidence_claims) {
      console.log(`   Evidence: ${plan.evidence_claims.join(', ')}`);
    }

    state.plannerMode = plan.mode;
    (state as any).lastEvidenceClaims = plan.evidence_claims;
    return state;
  }

  private async guardAction(state: AgentState): Promise<{ allowed: boolean; reason?: string }> {
    const action = state.history.length > 0 ? state.history[state.history.length - 1]?.action : null;
    
    if (!action) {
      return { allowed: true };
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
    }

    return guardResult;
  }

  private async executeAction(state: AgentState): Promise<AgentState> {
    const lastPlan = state.history[state.history.length - 1];
    if (!lastPlan?.action) {
      return state;
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

    const immediateObservation = await mcpWeb.observe({
      contextId: state.contextId,
      goal: state.goal.goal.description,
      lastAction: lastPlan.action.type,
      expectingValidation: true
    });

    state.currentSDOM = immediateObservation.sdom;
    state.currentUrl = immediateObservation.url;
    state.currentTitle = immediateObservation.title;
    state.lastSDelta = immediateObservation.sdelta;

    await this.waitForPageStabilization(state);

    return state;
  }

  private async waitForPageStabilization(state: AgentState): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async planValidation(state: AgentState): Promise<AgentState> {
    if (!state.currentSDOM || !state.lastSDelta) {
      return state;
    }

    const lastAction = state.history[state.history.length - 1]?.action;
    if (!lastAction) {
      return state;
    }

    const context = this.contextAssembler.buildValidatorContext(state.goal, state.sharedMemory);
    const traceStore = state.traceStore as any;

    try {
      console.log(`\n🔍 Validation:`);
      
      const probeSpecs = await this.probePlanner.plan(
        lastAction,
        state.currentSDOM,
        state.lastSDelta,
        state.goal,
        this.probeRegistry.getToolsFormatted(),
        context.credentials,
        context.ids
      );

      const probeResults = await Promise.all(
        probeSpecs.map(async (spec) => {
          console.log(`   • Probe: ${spec.tool}`);
          console.log(`     Params: ${JSON.stringify(spec.params)}`);
          const result = await this.probeBroker.execute(spec, state.sharedMemory);
          console.log(`     ${result.passed ? '✓' : '✗'} ${result.passed ? 'Success' : result.error || 'Failed'}`);
          if (result.passed && result.response) {
            console.log(`     Response: ${JSON.stringify(result.response).substring(0, 200)}`);
          }
          return {
            tool: spec.tool,
            success: result.passed,
            response: result.response,
            error: result.error
          };
        })
      );

      const outcome = await this.semanticValidator.validate(
        lastAction,
        state.goal,
        state.currentSDOM,
        state.lastSDelta,
        probeResults,
        state.sharedMemory,
        state.history.length,
        state.currentUrl
      );

      traceStore.addOutcome(outcome);

      console.log(`   ${outcome.passed ? '✅ PASS' : '❌ FAIL'} (confidence: ${outcome.confidence})`);
      console.log(`   Reasoning: ${outcome.reasoning}`);
      if (outcome.evidence.length > 0) {
        console.log(`   Evidence (${outcome.evidence.length} checks):`);
        outcome.evidence.slice(0, 10).forEach(e => console.log(`     • ${e}`));
        if (outcome.evidence.length > 10) {
          console.log(`     ... and ${outcome.evidence.length - 10} more`);
        }
      }
      if (outcome.concerns.length > 0) {
        console.log(`   Concerns: ${outcome.concerns.join(', ')}`);
      }

      if (this.logger) {
        this.logger.logValidationOutcome({
          outcomeId: outcome.id,
          stepNumber: outcome.stepNumber,
          passed: outcome.passed,
          confidence: outcome.confidence,
          reasoning: outcome.reasoning,
          evidence: outcome.evidence,
          concerns: outcome.concerns,
          probeResults: outcome.probeResults,
          sdom: state.currentSDOM,
          sdelta: state.lastSDelta,
          timestamp: new Date().toISOString()
        } as any);
      }
    } catch (error) {
      console.error(`   Validation error: ${error}`);
    }

    return state;
  }

  private async executeValidation(state: AgentState): Promise<AgentState> {
    return state;
  }

  private async evaluateCritic(state: AgentState): Promise<AgentState> {
    const traceStore = state.traceStore as any;
    this.critic = new Critic(traceStore);

    const lastOutcome = (traceStore.outcomes 
      ? Array.from(traceStore.outcomes.values()).slice(-1)[0]
      : null) as any;

    const evidenceClaims = (state as any).lastEvidenceClaims;

    const result = this.critic.evaluate(
      state.plannerMode || 'next',
      lastOutcome || null,
      evidenceClaims,
      state.history.length
    );

    console.log(`\n⚖️  Critic: ${result.decision}`);
    if (result.hint) {
      console.log(`   Hint: ${result.hint}`);
    }

    if (result.decision === 'success' || result.decision === 'failure') {
      state.phase = 'complete';
      state.criticHint = undefined;
    } else {
      state.criticHint = result.hint;
    }

    return state;
  }
}

