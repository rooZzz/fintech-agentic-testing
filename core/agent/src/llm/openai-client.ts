import OpenAI from 'openai';
import { GoalSpec, Observation, ActionPlan } from '../schema/types.js';
import { buildSystemPrompt, buildObservationPrompt } from './prompts.js';
import { DebugLogger } from '../logger/debug-logger.js';

const PRICING: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
  'gpt-4o': { prompt: 2.50, completion: 10.00 },
  'gpt-4-turbo': { prompt: 10.00, completion: 30.00 },
  'gpt-3.5-turbo': { prompt: 0.50, completion: 1.50 },
  'gpt-5': { prompt: 2.50, completion: 10.00 },
  'gpt-5-mini': { prompt: 0.20, completion: 0.80 },
};

export class OpenAIClient {
  private client: OpenAI;
  private model: string;
  private systemPrompt: string;
  private debug: DebugLogger;

  constructor(spec: GoalSpec, toolsPrompt: string) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.systemPrompt = buildSystemPrompt(spec, toolsPrompt);
    this.debug = new DebugLogger('PROMPTS');
    
    if (process.env.DEBUG_PROMPTS === 'true') {
      this.debug.log('System Prompt', this.systemPrompt);
    }
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

    this.debug.log(`Prompt for Step ${stepNumber}`, {
      promptLength: userPrompt.length,
      nodeCount: observation.nodes.length,
      url: observation.url,
      model: this.model
    });

    if (process.env.DEBUG_PROMPTS === 'true') {
      this.debug.log('Full User Prompt', userPrompt);
      
      if (observation.nodes) {
        const switchNodes = observation.nodes.filter(n => n.role === 'switch');
        if (switchNodes.length > 0) {
          this.debug.log('Switch Nodes in Observation', switchNodes.map(n => ({
            name: n.name,
            testId: n.testId,
            ariaChecked: n.ariaChecked
          })));
        }
      }
    }

    const isGpt5 = this.model.startsWith('gpt-5');
    let content: string | undefined;
    let promptTokens = 0;
    let completionTokens = 0;

    if (isGpt5) {
      const resp = await this.client.responses.create({
        model: this.model,
        text: { format: { type: 'json_object' } },
        max_output_tokens: 500,
        input: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      } as any);
      content = (resp as any).output_text as string;
      const usage = (resp as any).usage || {};
      promptTokens = usage.input_tokens || usage.prompt_tokens || 0;
      completionTokens = usage.output_tokens || usage.completion_tokens || 0;
    } else {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      content = response.choices[0]?.message?.content || undefined;
      const usage = response.usage;
      if (!usage) {
        throw new Error('No usage data from OpenAI');
      }
      promptTokens = usage.prompt_tokens;
      completionTokens = usage.completion_tokens;
    }

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

    const cost = this.calculateCost(promptTokens, completionTokens);

    this.debug.log(`LLM Response for Step ${stepNumber}`, {
      reasoning: plan.reasoning.substring(0, 100) + '...',
      actionType: plan.action.type,
      goalComplete: plan.action.type === 'goal.complete',
      promptTokens,
      completionTokens,
      cost: cost.toFixed(4)
    });

    return {
      plan,
      tokens: {
      prompt: promptTokens,
      completion: completionTokens,
        cost,
      },
    };
  }

  async planPrecondition(
    instruction: string,
    availableTools: Array<{ name: string; description: string; inputSchema?: any }>,
    context?: Record<string, any>
  ): Promise<{
    tool: string;
    params: any;
    suggestedName: string;
    description: string;
  }> {
    const toolsList = availableTools
      .map(t => {
        const params = t.inputSchema?.properties 
          ? Object.keys(t.inputSchema.properties).join(', ')
          : '';
        return `- ${t.name}: ${t.description}${params ? ` (params: ${params})` : ''}`;
      })
      .join('\n');

    let contextInfo = '';
    if (context && Object.keys(context).length > 0) {
      contextInfo = '\n\nPreviously Created Context:\n';
      for (const [key, value] of Object.entries(context)) {
        if (key !== '_contextId' && value) {
          if (value.userId) {
            contextInfo += `- ${key}.userId: ${value.userId}\n`;
          }
          if (value.email) {
            contextInfo += `- ${key}.email: ${value.email}\n`;
          }
        }
      }
      contextInfo += '\nUse these IDs/values in your params if the instruction refers to "the user" or "the loan".';
    }

    const prompt = `You are a test setup assistant. Convert natural language instructions into MCP tool calls.

Available MCP Tools:
${toolsList}${contextInfo}

User Instruction: "${instruction}"

Your task:
1. Choose the appropriate MCP tool
2. Determine the parameters needed (use context values if instruction refers to existing entities)
3. Suggest a short variable name to store the result (e.g., "user", "loans", "creditReport")
4. Write a brief description of what this data is and how it should be used

Respond ONLY with valid JSON in this format:
{
  "tool": "tool.name.here",
  "params": {"param1": "value1"},
  "suggestedName": "variableName",
  "description": "Brief description of the data and its purpose"
}

Examples:
- "Create a test user" → {"tool": "data.user.create", "params": {"plan": "free", "requires2FA": false}, "suggestedName": "user", "description": "Test user account for login and verification"}
- "Create a premium user with 2FA" → {"tool": "data.user.create", "params": {"plan": "premium", "requires2FA": true}, "suggestedName": "user", "description": "Premium user account with 2FA enabled for authenticated testing"}
- "Seed 5 loan offers" → {"tool": "data.loan.seed", "params": {"count": 5}, "suggestedName": "loans", "description": "Collection of 5 loan offers for browsing and selection"}
- "Reset the database" → {"tool": "data.reset", "params": {}, "suggestedName": "reset", "description": "Database reset confirmation"}
- "Enable credit lock for the user" (with user.userId in context) → {"tool": "data.user.toggleCreditLock", "params": {"userId": "abc-123"}, "suggestedName": "creditLockResult", "description": "Credit lock status after enabling"}`;

    const isGpt5 = this.model.startsWith('gpt-5');
    let content: string | undefined;
    if (isGpt5) {
      const resp = await this.client.responses.create({
        model: this.model,
        text: { format: { type: 'json_object' } },
        max_output_tokens: 400,
        input: [
          { role: 'user', content: prompt },
        ],
      } as any);
      content = (resp as any).output_text as string;
    } else {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'user', content: prompt },
        ],
      });
      content = response.choices[0]?.message?.content || undefined;
    }
    if (!content) {
      throw new Error('No response from OpenAI for precondition planning');
    }

    let plan: { tool: string; params: any; suggestedName: string; description: string };
    try {
      plan = JSON.parse(content);
    } catch (error) {
      if (isGpt5) {
        const resp = await this.client.responses.create({
          model: this.model,
          text: { format: { type: 'json_object' } },
          max_output_tokens: 1024,
          input: [
            { role: 'user', content: prompt },
          ],
        } as any);
        const retryContent = (resp as any).output_text as string;
        try {
          plan = JSON.parse(retryContent);
        } catch {
          throw new Error(`Failed to parse precondition plan as JSON after retry: ${retryContent}`);
        }
      } else {
        const response = await this.client.chat.completions.create({
          model: this.model,
          temperature: 0,
          max_tokens: 1024,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'user', content: prompt },
          ],
        });
        const retryContent = response.choices[0]?.message?.content || '';
        try {
          plan = JSON.parse(retryContent);
        } catch {
          throw new Error(`Failed to parse precondition plan as JSON after retry: ${retryContent}`);
        }
      }
    }

    if (!plan.tool || !plan.suggestedName || !plan.description) {
      throw new Error(`Invalid precondition plan structure: ${JSON.stringify(plan)}`);
    }

    return plan;
  }

  private calculateCost(promptTokens: number, completionTokens: number): number {
    const pricing = PRICING[this.model] || PRICING['gpt-4o-mini'];
    const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
    const completionCost = (completionTokens / 1_000_000) * pricing.completion;
    return promptCost + completionCost;
  }
}

