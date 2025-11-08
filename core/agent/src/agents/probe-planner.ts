import OpenAI from 'openai';
import { z } from 'zod';
import { ProbeSpec, Action, GoalSpec, SDOM, SDELTA } from '../schema/types.js';

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || ''
  });
}

const ProbePlanSchema = z.object({
  probes: z.array(z.object({
    tool: z.string(),
    params: z.record(z.any()),
    description: z.string().optional()
  }))
});

export class ProbePlanner {
  async plan(
    action: Action,
    sdom: SDOM,
    sdelta: SDELTA | null,
    goal: GoalSpec,
    probeRegistryTools: string,
    credentials: Record<string, any>,
    ids: Record<string, string>
  ): Promise<ProbeSpec[]> {
    if (!probeRegistryTools || probeRegistryTools.trim().length === 0) {
      return [];
    }

    const prompt = this.buildPrompt(action, sdom, sdelta, goal, probeRegistryTools, credentials, ids);

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a backend probe planner for automated testing.
Your job is to select backend API tools that fetch data to validate UI/backend consistency.

PURPOSE: Verify that what the user sees or does in the UI aligns with the actual backend data state.

When to use probes:
- After login/authentication: Fetch user data to verify dashboard shows correct user context
- When viewing user-specific data: If UI shows credit score, profile, account details → fetch that user's data
- After state-changing actions: If data was CREATED, UPDATED, or DELETED → fetch it to confirm backend reflects the change
- When viewing a SPECIFIC record with an ID available: Fetch that exact record to verify UI displays correct data

When NOT to use probes:
- Typing into forms (nothing persisted yet - wait for submit)
- Simple UI interactions (expand/collapse, hover, etc.)
- Navigating to search/list pages (these show dynamically filtered results, not persisted state)
- Browsing catalogs or offers (these are pre-seeded data, not user-specific state)
- When required IDs are NOT available in context (you cannot probe without the necessary ID)
- Landing on FORM pages or SEARCH pages (UI shows empty input fields - nothing to validate yet)
- Before submission actions (clicking "Search", "Submit", "Apply" buttons) - probe AFTER, not before

CRITICAL RULES:
1. DO NOT use probes for search/list/browse pages showing multiple items
2. DO NOT probe without the required IDs available in {{variables}}
3. DO NOT probe loan offers when user is just browsing - only probe when a loan APPLICATION is created
4. DO NOT probe on form/input pages (headings like "Find Your Loan", "Search for") - wait for submission
5. Check UI content: if it shows empty input fields or search forms, return empty probes array
6. Use {{variable}} syntax for IDs/credentials (e.g., {{user.userId}})
7. Keep it minimal - only fetch what's needed to validate UI/backend alignment

Return JSON with empty array if no probes needed:
{
  "probes": [{
    "tool": "data.user.get",
    "params": {"userId": "{{user.userId}}"},
    "description": "Verify dashboard shows correct user data"
  }]
}`
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [];
    }

    try {
      const plan = ProbePlanSchema.parse(JSON.parse(content));
      console.log(`   Probe Plan: ${plan.probes.length} backend probes`);
      return plan.probes;
    } catch (error) {
      console.error('Failed to parse ProbePlanner response:', content);
      return [];
    }
  }

  private buildPrompt(
    action: Action,
    sdom: SDOM,
    sdelta: SDELTA | null,
    goal: GoalSpec,
    probeRegistryTools: string,
    credentials: Record<string, any>,
    ids: Record<string, string>
  ): string {
    let prompt = `Goal: ${goal.goal.description}\n\n`;
    
    prompt += `Action Taken: ${action.type}\n`;
    if (action.params) {
      prompt += `Parameters: ${JSON.stringify(action.params)}\n`;
    }

    if (action.type === 'ui.act.type') {
      prompt += `\n⚠️  This is a TYPE action - just filling in a form field.\n`;
      prompt += `NO backend probes needed unless this action caused data to be DISPLAYED from backend.\n`;
      prompt += `Typing into forms is local UI state, not persisted backend data.\n`;
    }

    // Check if this is a form/search page by looking at interactive elements
    const hasInputFields = sdom.interactive.some(el => el.type === 'input' || el.type === 'select');
    const hasFormHeadings = sdom.content.some(c => 
      c.type === 'heading' && 
      (c.text?.includes('Find') || c.text?.includes('Search') || c.text?.includes('Enter'))
    );
    
    if (hasInputFields && hasFormHeadings) {
      prompt += `\n⚠️  PAGE TYPE: This appears to be a FORM or SEARCH page (empty inputs for user to fill).\n`;
      prompt += `DO NOT probe on form pages - no data has been submitted yet.\n`;
      prompt += `Return empty probes array.\n`;
    }

    if (sdom.content.length > 0 && !hasFormHeadings) {
      prompt += `\n⚠️  DATA CURRENTLY DISPLAYED ON PAGE:\n`;
      sdom.content.slice(0, 30).forEach(c => {
        if (c.type === 'heading') {
          prompt += `  - [H${c.level}] ${c.text}\n`;
        } else if (c.text && c.text.length < 100) {
          prompt += `  - ${c.text}\n`;
        }
      });
      
      prompt += `\nConsider: Do any of these SPECIFIC DATA VALUES need backend verification?\n`;
      prompt += `If credit scores, balances, user info, or specific record details are visible, fetch to verify.\n`;
      prompt += `DO NOT probe if only headings/labels are shown without actual data values.\n`;
    }

    if (sdelta) {
      prompt += `\nUI Changes:\n`;
      if (sdelta.added.length > 0) {
        prompt += `  Added ${sdelta.added.length} elements\n`;
      }
      if (sdelta.removed.length > 0) {
        prompt += `  Removed ${sdelta.removed.length} elements\n`;
      }
      if (sdelta.changed && sdelta.changed.length > 0) {
        prompt += `  Changed ${sdelta.changed.length} elements\n`;
      }
      if (sdelta.urlChanged) {
        prompt += `  URL: ${sdelta.urlChanged.from} → ${sdelta.urlChanged.to}\n`;
      }
    }

    prompt += `\nAvailable Backend Tools (READ THE DESCRIPTIONS CAREFULLY):\n`;
    prompt += probeRegistryTools;

    if (Object.keys(ids).length > 0) {
      prompt += `\n\nAvailable IDs (use {{variable}} syntax):\n`;
      Object.entries(ids).forEach(([key, value]) => {
        prompt += `  - {{${key}}}\n`;
      });
    }

    prompt += `\nQuestion: Which backend probes should we call to validate UI/backend consistency?`;
    prompt += `\nRemember: Only probe if this action caused backend data to be DISPLAYED or PERSISTED.`;
    prompt += `\nPay close attention to the tool descriptions - they tell you exactly when to use each tool.`;
    prompt += `\nReturn empty array if no probes needed.`;

    return prompt;
  }
}

