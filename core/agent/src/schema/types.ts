export interface GoalSpec {
  version: string;
  id: string;
  goal: Goal;
  context: Context;
  preconditions?: Precondition[];
  constraints: Constraints;
}

export interface Goal {
  description: string;
  success: SuccessCondition[];
}

export type SuccessCondition =
  | { url_contains: string }
  | { element_visible: string }
  | { heading_text: string };

export interface Context {
  start_url: string;
}

export interface Precondition {
  mcp: string;
  params: Record<string, any>;
  store_as?: string;
}

export interface Constraints {
  max_steps: number;
  max_cost_usd: number;
}

export interface UINode {
  id: string;
  role: string;
  name: string;
  bounds: { x: number; y: number; w: number; h: number };
  enabled: boolean;
  visible: boolean;
  testId?: string;
  href?: string;
  value?: string;
}

export interface Observation {
  url: string;
  title: string;
  nodes: UINode[];
}

export interface Action {
  type: 'ui.act.click' | 'ui.act.type' | 'ui.navigate';
  params: Record<string, any>;
}

export interface ActionPlan {
  reasoning: string;
  action: Action;
}

export interface StepResult {
  step: number;
  observation: Observation;
  action: Action;
  reasoning: string;
  tokens: {
    prompt: number;
    completion: number;
    cost: number;
  };
  timestamp: string;
}

export interface ScenarioResult {
  scenarioId: string;
  status: 'success' | 'failure' | 'error';
  steps: StepResult[];
  totalSteps: number;
  duration: number;
  totalCost: number;
  error?: string;
}

export interface AgentContext {
  spec: GoalSpec;
  variables: Record<string, any>;
  steps: StepResult[];
  startTime: number;
  totalCost: number;
}

