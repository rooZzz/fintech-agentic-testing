import OpenAI from 'openai';
import { z } from 'zod';
import { GoalSpec, ValidationOutcome, SDELTA } from '../schema/types.js';

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

const GoalCheckSchema = z.object({
  goalMet: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  suggestedEvidence: z.array(z.string()).optional()
});

export interface GoalCheckResult {
  goalMet: boolean;
  confidence: number;
  reasoning: string;
  suggestedEvidence?: string[];
}

export class GoalChecker {
  async check(
    goal: GoalSpec,
    recentOutcomes: ValidationOutcome[],
    sdelta: SDELTA | null,
    currentUrl?: string | null
  ): Promise<{ result: GoalCheckResult; cost: number }> {
    const prompt = this.buildPrompt(goal, recentOutcomes, sdelta, currentUrl);

    const model = 'gpt-4o-mini';
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a goal completion checker for automated testing. 
Your job is to determine if a test goal has been met based on recent validation outcomes and UI changes.

Evaluate whether the goal is met based on EVIDENCE from ValidationOutcomes:

Strong evidence of success:
- ValidationOutcomes show "pass" or "flaky" status with passing backend probes
- Backend probes confirm persistent state changes (user authenticated, data saved, etc.)
- UI changes align with expected outcome (new page loaded, success messages, expected elements appear)
- URL changes match expected destination
- Evidence array shows comprehensive data validation (many UI↔backend matches)
- No blocking errors or failures

Consider the SEMANTIC MEANING of the goal:
- Authentication/login goals: Backend confirmation (user API returns data) + UI shows authenticated state
- Navigation goals: URL changed + expected page elements present + comprehensive backend data visible
- Data submission goals: Backend probes verify data persisted + UI shows confirmation

If the success criteria mentions specific URLs, pages, or data:
- Check Current URL matches the expected URL pattern
- Check Evidence shows the expected data is validated against backend
- Check ValidationOutcome status is PASS with high confidence

Be evidence-driven, not assumption-driven:
- Don't assume based on keywords - evaluate actual validation results
- Backend probe success is STRONG evidence even if some UI assertions failed (UI expectations might be wrong)
- Multiple passing backend probes + some passing UI assertions = likely success
- Zero passing validations = not complete

CRITICAL: Handle temporal evidence correctly:
- RECENT evidence SUPERSEDES older evidence (e.g., "application now exists" > "application didn't exist earlier")
- If an earlier validation failed because data didn't exist, but a later validation passes with that data present → THE GOAL WAS ACHIEVED
- Example: Step 4 shows "no loan application" → Step 9 shows "loan application exists with correct data" = SUCCESS (data was created between steps)
- Only treat evidence as contradictory if RECENT validations conflict with each other
- Weight the MOST RECENT 3 validations most heavily - they show the current state

If evidence clearly shows goal achievement in recent validations, return goalMet=true with high confidence.
If unsure because NO recent validations address the goal, return goalMet=false with low confidence.

Return JSON: {"goalMet": boolean, "confidence": 0-1, "reasoning": "...", "suggestedEvidence": ["validation_id_1"]}`
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GoalChecker');
    }

    const usage = response.usage;
    if (!usage) {
      throw new Error('No usage data from GoalChecker');
    }

    const cost = calculateCost(model, usage.prompt_tokens, usage.completion_tokens);

    try {
      const result = GoalCheckSchema.parse(JSON.parse(content));
      return { result, cost };
    } catch (error) {
      console.error('Failed to parse GoalChecker response:', content);
      return {
        result: {
          goalMet: false,
          confidence: 0,
          reasoning: 'Failed to parse goal check result'
        },
        cost
      };
    }
  }

  private buildPrompt(
    goal: GoalSpec,
    recentOutcomes: ValidationOutcome[],
    sdelta: SDELTA | null,
    currentUrl?: string | null
  ): string {
    let prompt = `Goal: ${goal.goal.description}\n\n`;
    prompt += `Success Criteria: ${goal.goal.success}\n\n`;

    if (currentUrl) {
      prompt += `Current URL: ${currentUrl}\n\n`;
    }

    if (goal.goal.hints && goal.goal.hints.length > 0) {
      prompt += `Hints:\n${goal.goal.hints.map(h => `- ${h}`).join('\n')}\n\n`;
    }

    if (recentOutcomes.length > 0) {
      prompt += `Validation Outcomes (most recent first, showing last ${Math.min(recentOutcomes.length, 15)}):\n`;
      recentOutcomes.slice(-15).reverse().forEach(outcome => {
        prompt += `\n${outcome.id} (step ${outcome.stepNumber}):\n`;
        prompt += `  Status: ${outcome.passed ? 'PASS' : 'FAIL'}\n`;
        prompt += `  Confidence: ${outcome.confidence}\n`;
        prompt += `  Reasoning: ${outcome.reasoning}\n`;
        
        if (outcome.evidence.length > 0) {
          prompt += `  Evidence (${outcome.evidence.length} checks):\n`;
          outcome.evidence.slice(0, 100).forEach(e => {
            prompt += `    - ${e}\n`;
          });
          if (outcome.evidence.length > 100) {
            prompt += `    ... and ${outcome.evidence.length - 100} more\n`;
          }
        }

        if (outcome.concerns.length > 0) {
          prompt += `  Concerns:\n`;
          outcome.concerns.forEach(c => {
            prompt += `    ⚠️  ${c}\n`;
          });
        }

        if (outcome.probeResults.length > 0) {
          const successfulProbes = outcome.probeResults.filter(p => p.success).length;
          prompt += `  Backend Probes: ${successfulProbes}/${outcome.probeResults.length} successful\n`;
        }
      });
    } else {
      prompt += `No validation outcomes yet.\n`;
    }

    if (sdelta) {
      prompt += `\nRecent UI Changes:\n`;
      if (sdelta.added.length > 0) {
        prompt += `  Added ${sdelta.added.length} elements\n`;
      }
      if (sdelta.removed.length > 0) {
        prompt += `  Removed ${sdelta.removed.length} elements\n`;
      }
      if (sdelta.changed.length > 0) {
        prompt += `  Changed ${sdelta.changed.length} elements\n`;
      }
      if (sdelta.urlChanged) {
        prompt += `  URL changed: ${sdelta.urlChanged.from} → ${sdelta.urlChanged.to}\n`;
      }
    }

    prompt += `\n\nQuestion: Based on the validation outcomes and UI state, has the goal been met?`;
    prompt += `\n\nAnalyze the EVIDENCE:`;
    prompt += `\n1. Look at ValidationOutcome statuses (pass/fail/flaky)`;
    prompt += `\n2. Check which backend probes passed (strong evidence of persistent state)`;
    prompt += `\n3. Evaluate UI changes and assertions`;
    prompt += `\n4. Consider URL changes if applicable`;
    prompt += `\n5. Weigh backend evidence more heavily than UI assertions`;
    prompt += `\n\nIf goalMet=true, include suggestedEvidence array with ValidationOutcome IDs that prove it.`;
    prompt += `\nSelect the outcomes that best demonstrate goal completion.`;

    return prompt;
  }
}

