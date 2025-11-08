import OpenAI from 'openai';
import { z } from 'zod';
import { Action, GoalSpec, SDOM, SDELTA, ValidationOutcome, ProbeResult } from '../schema/types.js';

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

const SemanticValidationSchema = z.object({
  passed: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  evidence: z.array(z.string()),
  concerns: z.array(z.string())
});

export class SemanticValidator {
  async validate(
    action: Action,
    goal: GoalSpec,
    sdom: SDOM,
    sdelta: SDELTA | null,
    probeResults: ProbeResult[],
    sharedMemory: Map<string, any>,
    stepNumber: number,
    currentUrl?: string | null
  ): Promise<{ outcome: ValidationOutcome; cost: number }> {
    const prompt = this.buildPrompt(action, goal, sdom, sdelta, probeResults, sharedMemory, currentUrl);

    const model = 'gpt-4o-mini';
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a semantic validation expert for automated testing.
Your job is to determine if THIS SPECIFIC ACTION succeeded, not whether the overall goal is complete.

PRIMARY VALIDATION GOAL:
When backend probes are present, verify that what the user sees in the UI aligns with the backend data state.
This is the bridge between "what I see/do in the experience" and "what the data shows in the backend".

You evaluate:
1. Action execution (did the UI respond as expected to the action?)
   - Type: field value updated
   - Click: navigation/transition occurred
   - Select: selection changed

2. UI/Backend consistency (CRITICAL when probes are present)
   - Does data displayed in UI match backend probe responses?
   - NOT REQUIRED: Every backend field must be visible in UI
   - REQUIRED: Any values shown in UI must align with backend data
   - If user sees their email "john@example.com", does backend user data confirm this?
   - If UI shows balance "$1,234", does backend account data match?
   - If UI shows user-specific content (dashboard, profile), does backend confirm correct user?

3. Error signals
   - Are there error messages?
   - Do backend probes return errors?
   - Is there a mismatch between UI and backend data?

IMPORTANT: 
- If backend probes were executed, you MUST validate UI/backend data consistency
- Backend probe data is not just about "did it succeed?" but "does UI match reality?"
- An action can succeed as a step toward a goal without completing the goal

COMPREHENSIVE VALIDATION (when backend probes are present):
When backend data is available, you MUST cross-check ALL relevant UI content against backend data.
- Don't just validate one or two fields - check ALL data points that appear in both UI and backend
- Look through the entire content array for values that correspond to backend probe data
- Compare strings, numbers, lists, and structured data between UI and backend
- Be thorough: if backend returns 10 fields and UI shows 8 of them, validate all 8
- For structured data (objects, arrays): validate ALL fields within each item, not just identifying fields
- Example: if backend returns account objects with id, name, balance, status - validate ALL visible fields

REASONING FORMAT:
You MUST cite SPECIFIC values from both UI and backend in your reasoning.
BAD: "The UI shows the correct data"
GOOD: "UI displays email 'john@example.com' matching backend user.email, score '811' matching backend creditScore: 811, rating 'EXCELLENT' matching backend scoreRating, and lists 3 accounts ('Barclaycard Platinum', 'Santander Car Loan', 'Student Loan - SLC') matching backend tradelines[0-2].creditor"

Return JSON:
{
  "passed": boolean,
  "confidence": 0-1,
  "reasoning": "Summarize the action result and list the key data points validated (e.g., 'Action succeeded: UI email, credit score, and 3 tradelines match backend data')",
  "evidence": ["Detailed UI↔backend comparisons, one per validated field"],
  "concerns": ["Any mismatches, errors, or unexpected behavior"]
}

Examples of GOOD reasoning + evidence:
Reasoning: "Field value changed to 'john@example.com' as expected. No backend verification needed for typing."
Evidence: []

Reasoning: "Login succeeded, navigated to /dashboard. Validated 2 data points: email and credit score match backend."
Evidence: ["UI email 'john@example.com' matches backend user.email", "UI credit score '811' matches backend creditScore: 811"]

Reasoning: "Page loaded. Validated 15 data points: email, score, rating, and all visible fields from backend array items."
Evidence: ["UI email 'test@ex.com' matches user.email", "UI score '811' matches creditScore: 811", "UI rating 'EXCELLENT' matches scoreRating", "UI value 'Name1' matches items[0].name", "UI value '$100' matches items[0].amount", "UI value 'Active' matches items[0].status", ... (continue for all visible backend fields in all array items)]

Reasoning: "Update failed: name mismatch detected between UI and backend"
Evidence: []
Concerns: ["UI shows 'John Doe' but backend user.name is 'Jane Doe'"]`
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from SemanticValidator');
    }

    const usage = response.usage;
    if (!usage) {
      throw new Error('No usage data from SemanticValidator');
    }

    const cost = calculateCost(model, usage.prompt_tokens, usage.completion_tokens);

    try {
      const result = SemanticValidationSchema.parse(JSON.parse(content));
      
      return {
        outcome: {
          id: `validation_${stepNumber}_${Date.now()}`,
          timestamp: Date.now(),
          stepNumber,
          passed: result.passed,
          confidence: result.confidence,
          reasoning: result.reasoning,
          evidence: result.evidence,
          concerns: result.concerns,
          probeResults,
          url: currentUrl || undefined,
          sdom,
          sdelta
        },
        cost
      };
    } catch (error) {
      console.error('Failed to parse SemanticValidator response:', content);
      return {
        outcome: {
          id: `validation_${stepNumber}_${Date.now()}`,
          timestamp: Date.now(),
          stepNumber,
          passed: false,
          confidence: 0,
          reasoning: 'Failed to parse validation response',
          evidence: [],
          concerns: ['Validation parsing error'],
          probeResults,
          url: currentUrl || undefined,
          sdom,
          sdelta
        },
        cost
      };
    }
  }

  private buildPrompt(
    action: Action,
    goal: GoalSpec,
    sdom: SDOM,
    sdelta: SDELTA | null,
    probeResults: ProbeResult[],
    sharedMemory: Map<string, any>,
    currentUrl?: string | null
  ): string {
    let prompt = `Goal: ${goal.goal.description}\n`;
    prompt += `Success Criteria: ${goal.goal.success}\n\n`;

    if (currentUrl) {
      prompt += `Current URL: ${currentUrl}\n\n`;
    }

    prompt += `Action Taken: ${action.type}\n`;
    if (action.params) {
      prompt += `Parameters: ${JSON.stringify(action.params)}\n`;
    }

    prompt += `\n=== CURRENT PAGE STATE ===\n`;
    
    if (sdom.interactive.length > 0) {
      prompt += `\nInteractive Elements (${sdom.interactive.length} total):\n`;
      sdom.interactive.slice(0, 15).forEach(el => {
        const testId = el.testId ? ` [testId=${el.testId}]` : '';
        const disabled = el.disabled ? ' (disabled)' : '';
        prompt += `  - ${el.type}: "${el.label}"${testId}${disabled}\n`;
      });
      if (sdom.interactive.length > 15) {
        prompt += `  ... and ${sdom.interactive.length - 15} more\n`;
      }
    }

    if (sdom.content.length > 0) {
      prompt += `\nContent Elements (${sdom.content.length} total):\n`;
      sdom.content.slice(0, 100).forEach(el => {
        prompt += `  - ${el.type}: "${el.text}"\n`;
      });
      if (sdom.content.length > 100) {
        prompt += `  ... and ${sdom.content.length - 100} more content elements\n`;
      }
    }

    if (sdom.feedback.length > 0) {
      prompt += `\nFeedback Messages:\n`;
      sdom.feedback.forEach(fb => {
        prompt += `  - ${fb.type.toUpperCase()}: "${fb.message}"\n`;
      });
    }


    if (sdelta) {
      prompt += `\n=== UI CHANGES FROM ACTION ===\n`;
      
      if (sdelta.changed.length > 0) {
        prompt += `\nChanged ${sdelta.changed.length} elements:\n`;
        sdelta.changed.slice(0, 10).forEach(change => {
          const el = change.element as any;
          const testId = el.testId ? ` [${el.testId}]` : '';
          const label = el.label || el.text || el.message || '';
          prompt += `  ~ ${el.type}${testId}: "${label}"\n`;
          prompt += `    OLD: ${JSON.stringify(change.oldValue)}\n`;
          prompt += `    NEW: ${JSON.stringify(change.newValue)}\n`;
        });
        if (sdelta.changed.length > 10) {
          prompt += `  ... and ${sdelta.changed.length - 10} more changes\n`;
        }
      }
      
      if (sdelta.added.length > 0) {
        prompt += `\nAdded ${sdelta.added.length} elements:\n`;
        sdelta.added.slice(0, 8).forEach(el => {
          if ('label' in el) {
            prompt += `  + ${(el as any).type}: "${el.label}"\n`;
          } else if ('message' in el) {
            prompt += `  + ${el.type}: "${el.message}"\n`;
          } else if ('text' in el) {
            prompt += `  + ${(el as any).type}: "${(el as any).text}"\n`;
          }
        });
        if (sdelta.added.length > 8) {
          prompt += `  ... and ${sdelta.added.length - 8} more additions\n`;
        }
      }
      
      if (sdelta.removed.length > 0) {
        prompt += `\nRemoved ${sdelta.removed.length} elements:\n`;
        sdelta.removed.slice(0, 5).forEach(el => {
          if ('label' in el) {
            prompt += `  - ${(el as any).type}: "${el.label}"\n`;
          }
        });
        if (sdelta.removed.length > 5) {
          prompt += `  ... and ${sdelta.removed.length - 5} more removals\n`;
        }
      }

      if (sdelta.urlChanged) {
        prompt += `\nURL Changed: ${sdelta.urlChanged.from} → ${sdelta.urlChanged.to}\n`;
      }

      if (sdelta.added.length === 0 && sdelta.removed.length === 0 && 
          sdelta.changed.length === 0 && !sdelta.urlChanged) {
        prompt += `\nNo significant UI changes detected.\n`;
      }
    }

    if (probeResults.length > 0) {
      prompt += `\n=== BACKEND DATA (for UI consistency check) ===\n`;
      probeResults.forEach((probe, index) => {
        prompt += `\n[Probe ${index + 1}] ${probe.tool}:\n`;
        if (probe.success) {
          prompt += `  ✓ SUCCESS\n`;
          if (probe.response && typeof probe.response === 'object') {
            const responseStr = JSON.stringify(probe.response, null, 2);
            const maxLength = 2000;
            if (responseStr.length > maxLength) {
              prompt += `  Data: ${responseStr.substring(0, maxLength)}...[truncated, ${responseStr.length} chars total]\n`;
            } else {
              prompt += `  Data: ${responseStr}\n`;
            }
          }
        } else {
          prompt += `  ✗ FAILED\n`;
          if (probe.error) {
            prompt += `  Error: ${probe.error}\n`;
          }
        }
      });
      prompt += `\n⚠️  CRITICAL: Validate UI/backend consistency.\n`;
      prompt += `- NOT REQUIRED: Every backend field visible in UI\n`;
      prompt += `- REQUIRED: Any specific values shown in UI should align with backend data\n`;
      prompt += `- SUFFICIENT: Backend confirms correct user/data context for what's displayed\n`;
      prompt += `- For multiple probes: Each probe validates a separate item (e.g., multiple loan offers)\n`;
    }

    const contextKeys = Array.from(sharedMemory.keys()).filter(k => !k.startsWith('_'));
    if (contextKeys.length > 0) {
      prompt += `\n=== AVAILABLE CONTEXT ===\n`;
      contextKeys.slice(0, 5).forEach(key => {
        const val = sharedMemory.get(key);
        if (val && typeof val === 'object' && '_meta' in val) {
          prompt += `  - ${key}: ${val._meta?.description || 'data available'}\n`;
        } else {
          prompt += `  - ${key}\n`;
        }
      });
    }

    prompt += `\n=== QUESTION ===\n`;
    prompt += `Did the action "${action.type}" succeed?\n`;
    if (probeResults.length > 0) {
      prompt += `\nCRITICAL: Backend probes were executed.\n`;
      prompt += `Your PRIMARY task is to validate UI/backend consistency:\n`;
      prompt += `- If UI shows specific data values, do they match backend?\n`;
      prompt += `- If UI shows user-specific content, does backend confirm correct user context?\n`;
      prompt += `- If UI indicates success/changes, does backend data reflect this?\n`;
      prompt += `\nYou don't need every backend field visible - just ensure what IS visible aligns with backend.\n`;
      prompt += `This is a bridge test: "what I see in the experience" ↔ "what the backend data shows"\n`;
    } else {
      prompt += `\nFocus on:\n`;
      prompt += `- For TYPE actions: Did the target field's value change to the expected text?\n`;
      prompt += `- For CLICK actions: Did the expected transition happen?\n`;
      prompt += `- Are there error messages indicating failure?\n`;
    }
    prompt += `\nDo NOT evaluate overall goal completion - just THIS action's success.`;

    return prompt;
  }
}

