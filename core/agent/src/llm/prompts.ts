import { GoalSpec, Observation, SuccessCondition } from '../schema/types.js';

export function buildSystemPrompt(spec: GoalSpec): string {
  const successConditions = spec.goal.success
    .map((cond) => formatCondition(cond))
    .join('\n');

  return `You are an autonomous testing agent. Your goal is to navigate a web application to achieve a specific user objective.

You interact ONLY through MCP tool calls. Available actions:
- ui.act.click - Click an element using its selector or testId
- ui.act.type - Type text into an input field
- ui.navigate - Navigate to a URL (rarely needed)

Current Goal: ${spec.goal.description}

Success Conditions (any one met = success):
${successConditions}

Constraints:
- Maximum ${spec.constraints.max_steps} steps
- Cost limit: $${spec.constraints.max_cost_usd}

IMPORTANT RULES:
- Only click visible, enabled elements
- Prefer elements with data-testid attributes
- Use testId parameter when available (e.g., {"testId": "login-button"})
- For text inputs, use selector like [data-testid="email-input"]
- For SELECT dropdowns, use ui.act.type to enter the value (e.g., type "5" to select 5 years, type "personal" to select personal loan)
- Do NOT click select elements - always TYPE the value you want to select
- If stuck, try a different approach
- Be concise in reasoning (1-2 sentences)

Respond ONLY with valid JSON in this exact format:
{
  "reasoning": "brief explanation of why this action",
  "action": {
    "type": "ui.act.click",
    "params": {"testId": "element-id"}
  }
}

OR for typing into text inputs:
{
  "reasoning": "entering email address",
  "action": {
    "type": "ui.act.type",
    "params": {"selector": "[data-testid='email-input']", "text": "value"}
  }
}

OR for selecting from dropdowns (select elements):
{
  "reasoning": "selecting loan term of 5 years",
  "action": {
    "type": "ui.act.type",
    "params": {"testId": "loan-term-select", "text": "5"}
  }
}`;
}

function formatCondition(condition: SuccessCondition): string {
  if ('url_contains' in condition) {
    return `- URL contains: "${condition.url_contains}"`;
  }
  if ('element_visible' in condition) {
    return `- Element visible with testId: "${condition.element_visible}"`;
  }
  if ('heading_text' in condition) {
    return `- Heading text equals: "${condition.heading_text}"`;
  }
  return '- Unknown condition';
}

export function buildObservationPrompt(
  observation: Observation,
  stepNumber: number,
  variables: Record<string, any>,
  recentActions?: Array<{ step: number; action: any; reasoning: string }>
): string {
  const interactiveElements = observation.nodes
    .filter((node) => node.visible && node.enabled)
    .slice(0, 30)
    .map((node) => {
      const parts: string[] = [
        `- ${node.role}: "${node.name}"`,
      ];
      if (node.testId) {
        parts.push(`testId="${node.testId}"`);
      }
      if (node.href) {
        parts.push(`href="${node.href}"`);
      }
      if (node.value !== undefined) {
        parts.push(`value="${node.value}"`);
      }
      return parts.join(' ');
    });

  let contextInfo = '';
  if (variables.testUser) {
    contextInfo = `\nTest User Credentials:
- Email: ${variables.testUser.email}
- Password: ${variables.testUser.password}`;
  }

  let recentActionsText = '';
  if (recentActions && recentActions.length > 0) {
    recentActionsText = `\nRecent Actions You Took:
${recentActions.map(a => `- Step ${a.step}: ${a.action.type} - ${a.reasoning}`).join('\n')}

IMPORTANT: Don't repeat the same action you just took. Move forward with the next logical step.`;
  }

  return `Step ${stepNumber}

Current Page:
- URL: ${observation.url}
- Title: ${observation.title}

Available Interactive Elements (visible, enabled):
${interactiveElements.join('\n')}
${contextInfo}
${recentActionsText}

What is your next action?`;
}

