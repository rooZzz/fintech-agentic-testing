import OpenAI from 'openai';
import { GoalSpec, Observation, ActionPlan } from '../schema/types.js';
import { buildSystemPrompt, buildObservationPrompt } from './prompts.js';

const PRICING: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
  'gpt-4o': { prompt: 2.50, completion: 10.00 },
  'gpt-4-turbo': { prompt: 10.00, completion: 30.00 },
  'gpt-3.5-turbo': { prompt: 0.50, completion: 1.50 },
};

export class OpenAIClient {
  private client: OpenAI;
  private model: string;
  private systemPrompt: string;

  constructor(spec: GoalSpec, toolsPrompt: string) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.systemPrompt = buildSystemPrompt(spec, toolsPrompt);
  }

  async planNextAction(
    observation: Observation,
    stepNumber: number,
    variables: Record<string, any>,
    recentActions?: Array<{ step: number; action: any; reasoning: string }>
  ): Promise<{
    plan: ActionPlan;
    tokens: { prompt: number; completion: number; cost: number };
  }> {
    const userPrompt = buildObservationPrompt(observation, stepNumber, variables, recentActions);

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    let plan: ActionPlan;
    try {
      plan = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse OpenAI response as JSON: ${content}`);
    }

    if (!plan.reasoning || !plan.action) {
      throw new Error(`Invalid action plan structure: ${JSON.stringify(plan)}`);
    }

    const usage = response.usage;
    if (!usage) {
      throw new Error('No usage data from OpenAI');
    }

    const cost = this.calculateCost(usage.prompt_tokens, usage.completion_tokens);

    return {
      plan,
      tokens: {
        prompt: usage.prompt_tokens,
        completion: usage.completion_tokens,
        cost,
      },
    };
  }

  private calculateCost(promptTokens: number, completionTokens: number): number {
    const pricing = PRICING[this.model] || PRICING['gpt-4o-mini'];
    const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
    const completionCost = (completionTokens / 1_000_000) * pricing.completion;
    return promptCost + completionCost;
  }
}

