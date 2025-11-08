import OpenAI from 'openai';
import { z } from 'zod';

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || ''
  });
}

const PreconditionPlanSchema = z.object({
  tool: z.string(),
  params: z.record(z.any()),
  suggestedName: z.string(),
  description: z.string()
});

interface PreconditionPlan {
  tool: string;
  params: Record<string, any>;
  suggestedName: string;
  description: string;
}

export class PreconditionPlanner {
  async plan(
    instruction: string,
    availableTools: Array<{ name: string; description: string; inputSchema?: any }>,
    existingContext?: Record<string, any>
  ): Promise<PreconditionPlan> {
    const toolsList = availableTools
      .map(t => {
        const params = t.inputSchema?.properties 
          ? Object.keys(t.inputSchema.properties).join(', ')
          : '';
        return `- ${t.name}: ${t.description}${params ? ` (params: ${params})` : ''}`;
      })
      .join('\n');

    let contextInfo = '';
    if (existingContext && Object.keys(existingContext).length > 0) {
      contextInfo = '\n\nPreviously Created Context:\n';
      for (const [key, value] of Object.entries(existingContext)) {
        if (key !== '_contextId' && value) {
          if ((value as any).userId) {
            contextInfo += `- ${key}.userId: ${(value as any).userId}\n`;
          }
          if ((value as any).email) {
            contextInfo += `- ${key}.email: ${(value as any).email}\n`;
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
- "Reset the database" → {"tool": "data.reset", "params": {}, "suggestedName": "reset", "description": "Database reset confirmation"}`;

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI for precondition planning');
    }

    try {
      const plan = PreconditionPlanSchema.parse(JSON.parse(content));
      return plan;
    } catch (error) {
      throw new Error(`Failed to parse precondition plan: ${content}`);
    }
  }
}

