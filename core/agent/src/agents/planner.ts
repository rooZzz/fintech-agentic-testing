import OpenAI from 'openai';
import { z } from 'zod';
import { GoalSpec, SDOM, SDELTA, ValidationOutcome, PlannerMode, ActionPlan } from '../schema/types.js';

const PRICING: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
  'gpt-4o': { prompt: 2.50, completion: 10.00 },
};

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || ''
  });
}

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = PRICING[model] || PRICING['gpt-4o-mini'];
  const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
  const completionCost = (completionTokens / 1_000_000) * pricing.completion;
  return promptCost + completionCost;
}

const ActionPlanSchema = z.object({
  mode: z.enum(['next', 'done']),
  reasoning: z.string(),
  action: z.object({
    type: z.string(),
    params: z.record(z.any()).optional()
  }).optional(),
  evidence_claims: z.array(z.string()).optional(),
  success_signals: z.array(z.string()).optional()
});

export class Planner {
  async plan(
    mode: PlannerMode,
    goal: GoalSpec,
    sdom: SDOM,
    sdelta: SDELTA | null,
    recentOutcomes: ValidationOutcome[],
    credentials: Record<string, any>,
    ids: Record<string, string>,
    currentUrl?: string | null,
    criticHint?: string
  ): Promise<{ plan: ActionPlan; cost: number }> {
    const prompt = this.buildPrompt(mode, goal, sdom, sdelta, recentOutcomes, credentials, ids, currentUrl, criticHint);

    const model = 'gpt-4o-mini';
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(mode)
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Planner');
    }

    const usage = response.usage;
    if (!usage) {
      throw new Error('No usage data from Planner');
    }

    const cost = calculateCost(model, usage.prompt_tokens, usage.completion_tokens);

    try {
      const parsed = ActionPlanSchema.parse(JSON.parse(content));
      return {
        plan: {
          mode: parsed.mode,
          reasoning: parsed.reasoning,
          action: parsed.action as any,
          evidence_claims: parsed.evidence_claims,
          success_signals: parsed.success_signals
        },
        cost
      };
    } catch (error) {
      console.error('Failed to parse Planner response:', content);
      throw new Error(`Invalid plan structure: ${content}`);
    }
  }

  private getSystemPrompt(mode: PlannerMode): string {
    if (mode === 'next') {
      return `You are a test execution planner. Choose the next UI action to progress toward the goal.

Available action types:
- ui.act.click: Click a button or link (use testId when available)
- ui.act.type: Type text into an input field OR select an option from a select/dropdown (use testId when available)
  * For input fields: provide the text to type
  * For select elements: provide the option value or label to select
- ui.navigate: Navigate to a URL

Return JSON:
{
  "mode": "next",
  "reasoning": "why this action moves toward the goal",
  "action": {
    "type": "ui.act.click",
    "params": {"testId": "submit-button"}
  }
}

CRITICAL RULES:
1. Always use testId when available from the SDOM
2. Only choose actions on elements that exist in the current SDOM
3. For SELECT elements (type="select" in SDOM): use ui.act.type with the option value/label, NOT ui.act.click
4. Base your reasoning ONLY on the provided context - do not assume or invent failures
5. Recent validation outcomes show what actually happened - if they PASS, the action succeeded
6. Check the current URL to understand what page you're on
7. If previous validations passed, do not claim they failed
8. If Critic provided a hint, address it in your next action

GROUNDING REQUIREMENT:
Your reasoning must be grounded in the evidence provided:
- If validation outcomes show PASS, acknowledge the success
- If you're already on the target URL, recognize you may have reached the goal
- Do not fabricate failures or issues that aren't shown in the validation outcomes`;
    } else {
      return `You are a test completion verifier. The goal has been detected as met.
Your job is to cite specific ValidationOutcome IDs as evidence.

Return JSON:
{
  "mode": "done",
  "reasoning": "why the goal is complete",
  "evidence_claims": ["validation_id_1", "validation_id_2"],
  "success_signals": ["what confirmed success"]
}

CRITICAL RULES:
1. You MUST cite specific ValidationOutcome IDs that prove goal completion
2. Evidence must include both UI validation AND backend validation (if available)
3. Only cite outcomes that actually passed
4. If Critic rejected your evidence, cite different/additional outcomes`;
    }
  }

  private buildPrompt(
    mode: PlannerMode,
    goal: GoalSpec,
    sdom: SDOM,
    sdelta: SDELTA | null,
    recentOutcomes: ValidationOutcome[],
    credentials: Record<string, any>,
    ids: Record<string, string>,
    currentUrl?: string | null,
    criticHint?: string
  ): string {
    let prompt = `Goal: ${goal.goal.description}\n`;
    prompt += `Success Criteria: ${goal.goal.success}\n\n`;
    
    if (goal.goal.hints && goal.goal.hints.length > 0) {
      prompt += `IMPORTANT HINTS:\n${goal.goal.hints.map(h => `- ${h}`).join('\n')}\n\n`;
    }
    
    if (currentUrl) {
      prompt += `Current URL: ${currentUrl}\n\n`;
    }

    if (mode === 'next') {
      prompt += `Current SDOM (Semantic DOM):\n`;
      prompt += `Interactive Elements (${sdom.interactive.length}):\n`;
      sdom.interactive.slice(0, 15).forEach(el => {
        const valueInfo = el.value ? ` value="${el.value}"` : '';
        const placeholderInfo = el.placeholder && !el.value ? ` placeholder="${el.placeholder}"` : '';
        prompt += `  - ${el.type} "${el.label}"${el.testId ? ` [testId=${el.testId}]` : ''}${valueInfo}${placeholderInfo}${el.disabled ? ' (disabled)' : ''}\n`;
      });

      prompt += `\nFeedback Messages (${sdom.feedback.length}):\n`;
      sdom.feedback.forEach(fb => {
        prompt += `  - ${fb.type}: "${fb.message}"${fb.testId ? ` [testId=${fb.testId}]` : ''}\n`;
      });

      if (sdelta && (sdelta.added.length > 0 || sdelta.removed.length > 0)) {
        prompt += `\nRecent Changes:\n`;
        if (sdelta.added.length > 0) {
          prompt += `  Added: ${sdelta.added.length} elements\n`;
        }
        if (sdelta.removed.length > 0) {
          prompt += `  Removed: ${sdelta.removed.length} elements\n`;
        }
      }

      if (Object.keys(credentials).length > 0) {
        prompt += `\nAvailable Credentials:\n`;
        Object.entries(credentials).forEach(([key, value]) => {
          prompt += `  - ${key}: ${value}\n`;
        });
      }

      if (Object.keys(ids).length > 0) {
        prompt += `\nAvailable IDs:\n`;
        Object.entries(ids).forEach(([key, value]) => {
          prompt += `  - ${key}: ${value}\n`;
        });
      }
    }

    if (recentOutcomes.length > 0) {
      prompt += `\nRecent Validation Outcomes:\n`;
      recentOutcomes.slice(0, 3).forEach(outcome => {
        prompt += `  ${outcome.id}: ${outcome.passed ? 'PASS' : 'FAIL'} (step ${outcome.stepNumber}, confidence: ${outcome.confidence})\n`;
        if (outcome.reasoning) {
          prompt += `    Reasoning: ${outcome.reasoning.substring(0, 300)}\n`;
        }
        if (outcome.url) {
          prompt += `    URL: ${outcome.url}\n`;
        }
      });
    }

    if (criticHint) {
      prompt += `\nCritic Feedback:\n${criticHint}\n`;
    }

    if (mode === 'done') {
      prompt += `\nThe GoalChecker believes the goal is met. Cite ValidationOutcome IDs as evidence.`;
    } else {
      prompt += `\nWhat is the next action to progress toward the goal?`;
      prompt += `\n\nExamples:\n`;
      prompt += `- To select "5 years" from a select: {"type": "ui.act.type", "params": {"testId": "loan-term-select", "text": "5"}}\n`;
      prompt += `- To type into an input: {"type": "ui.act.type", "params": {"testId": "loan-amount-input", "text": "25000"}}\n`;
      prompt += `- To click a button: {"type": "ui.act.click", "params": {"testId": "search-loans-button"}}\n`;
    }

    return prompt;
  }
}

