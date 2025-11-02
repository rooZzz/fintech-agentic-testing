import { GoalSpec, Observation } from '../schema/types.js';

export function buildSystemPrompt(spec: GoalSpec, availableTools: string): string {
  return `You are a testing agent for end-to-end web scenarios.

=== YOUR GOAL ===
${spec.goal.description}

=== SUCCESS CONDITIONS ===
${spec.goal.success}

=== CONSTRAINTS ===
- Max steps: ${spec.constraints.max_steps}
- Cost limit: $${spec.constraints.max_cost_usd}

=== AVAILABLE OPERATIONS ===
${availableTools}
- goal.complete: Use when success conditions are met
- goal.fail: Use when success conditions are not met

=== DECISION CHECKLIST (PER STEP) ===
1) If UI already matches success conditions:
   - If backend validation is available AND not yet performed: call the relevant data.* tool to verify, wait for result, then decide in next turn
   - If backend validation performed AND matches UI: call goal.complete
   - If backend validation performed AND does NOT match UI: call goal.fail
   - If no backend validation needed: call goal.complete
2) Take the single best UI action toward achieving the goal. Only interact with UI elements you can see. You MUST only use ui.* actions for UI interaction. Use INITIAL SETUP DATA for logins/forms over creating new data.
3) Do not repeat the same action with identical parameters twice in a row
4) Respond only with JSON: {"reasoning": "...", "action": {"type": "...", "params": {...}}}

IMPORTANT: Verify success via persistent UI state (forms, text displays, data tables) or backend validation (data.* tools), not temporary feedback messages.

NOTE: You can validate multiple sources across multiple turns before calling goal.complete`;
}

export function buildObservationPrompt(
  observation: Observation,
  stepNumber: number,
  variables: Record<string, any>,
  recentActions?: Array<{ step: number; action: any; reasoning: string; result?: any }>
): string {
  const interactiveElements = observation.nodes
    .filter((node) => node.visible && node.enabled)
    .slice(0, 30)
    .map((node) => {
      const parts: string[] = [`- ${node.role}`];
      if (node.testId) parts.push(`testId="${node.testId}"`);
      if (node.label) parts.push(`label="${node.label}"`);
      if (node.name) parts.push(`"${node.name}"`);
      if (node.placeholder) parts.push(`placeholder="${node.placeholder}"`);
      if (node.context) parts.push(`in="${node.context}"`);
      if (node.href) parts.push(`href="${node.href}"`);
      if (node.value !== undefined) parts.push(`value="${node.value}"`);
      if (node.ariaChecked !== undefined) parts.push(`checked=${node.ariaChecked}`);
      if (node.required) parts.push(`required`);
      if (node.disabled) parts.push(`disabled`);
      return parts.join(' ');
    });
  const pageStructure = interactiveElements.join('\n');

  let contextInfo = '';
  if (Object.keys(variables).some(k => k !== '_contextId')) {
    contextInfo += '\n=== INITIAL SETUP DATA (pre-conditioned, NOT current state) ===\n';
    for (const [key, value] of Object.entries(variables)) {
      if (key === '_contextId') continue;
      const meta = (value as any)?._meta;
      const description = meta?.description || 'Test data';
      const data = meta ? { ...(value as any) } : value;
      if ((data as any)._meta) delete (data as any)._meta;
      contextInfo += `\n${key}: ${description}\n${JSON.stringify(data, null, 2)}\n`;
    }
  }

  let recentActionsText = '';
  if (recentActions && recentActions.length > 0) {
    recentActionsText = `\n=== RECENT ACTIONS (last ${recentActions.length} steps) ===\n`;
    recentActions.forEach(a => {
      const params = JSON.stringify(a.action.params || {});
      recentActionsText += `Step ${a.step}: ${a.action.type} ${params}\n`;
      recentActionsText += `  Reasoning: ${a.reasoning}\n`;
      if (a.result) {
        recentActionsText += `  Result: ${JSON.stringify(a.result)}\n`;
      }
    });
    
    if (recentActions.length >= 2) {
      const prev = recentActions[recentActions.length - 2];
      const last = recentActions[recentActions.length - 1];
      const sameType = prev.action.type === last.action.type;
      const sameParams = JSON.stringify(prev.action.params || {}) === JSON.stringify(last.action.params || {});
      if (sameType && sameParams) {
        recentActionsText += `\nNote: You repeated the same action twice. Do not repeat the same action with identical params. Choose a different step (verify or a different UI action).\n`;
      }
    }
  }

  return `Step ${stepNumber}

=== CURRENT PAGE (You MUST treat as AUTHORITATIVE UI current state) ===
URL: ${observation.url}
Title: ${observation.title}
Interactive Elements:
${pageStructure}
${contextInfo}
${recentActionsText}

What is your next action?`;
}

