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
  success: string;
  hints?: string[];
}

export interface Context {
  start_url: string;
}

export interface Precondition {
  instruction?: string;
  mcp?: string;
  params?: Record<string, any>;
  store_as?: string;
  as?: string;
}

export interface Constraints {
  max_steps: number;
  max_cost_usd: number;
}

export interface InteractiveElement {
  type: 'button' | 'input' | 'select' | 'link' | 'checkbox' | 'radio';
  label: string;
  testId?: string;
  value?: string;
  disabled: boolean;
  required?: boolean;
  placeholder?: string;
  href?: string;
  relevance?: string;
}

export interface ContentElement {
  type: 'heading' | 'label' | 'text' | 'paragraph';
  text: string;
  testId?: string;
  context?: string;
  level?: number;
}

export interface FeedbackElement {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  field?: string;
  testId?: string;
}

export interface SDOM {
  interactive: InteractiveElement[];
  content: ContentElement[];
  feedback: FeedbackElement[];
}

export type SDOMElement = InteractiveElement | ContentElement | FeedbackElement;

export interface SDELTA {
  added: SDOMElement[];
  removed: SDOMElement[];
  changed: Array<{
    element: SDOMElement;
    oldValue: any;
    newValue: any;
  }>;
  urlChanged?: {
    from: string;
    to: string;
  };
}

export interface Observation {
  url: string;
  title: string;
  sdom: SDOM;
  sdelta: SDELTA | null;
}

export interface ProbeSpec {
  tool: string;
  params: Record<string, any>;
  description?: string;
}

export interface ProbeResult {
  tool: string;
  success: boolean;
  response: any;
  error?: string;
}

export interface ValidationOutcome {
  id: string;
  timestamp: number;
  stepNumber: number;
  passed: boolean;
  confidence: number;
  reasoning: string;
  evidence: string[];
  concerns: string[];
  probeResults: ProbeResult[];
  url?: string;
  sdom?: SDOM;
  sdelta?: SDELTA | null;
}

export type PlannerMode = 'next' | 'done';

export interface Action {
  type: 'ui.act.click' | 'ui.act.type' | 'ui.act.interact' | 'ui.navigate' | 'validate.check' | 'goal.complete' | 'goal.fail';
  params?: Record<string, any>;
}

export interface ActionPlan {
  mode: PlannerMode;
  reasoning: string;
  action?: Action;
  evidence_claims?: string[];
  success_signals?: string[];
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
  result?: any;
  validationOutcomeId?: string;
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

export type CriticDecision = 'continue' | 'retry' | 'success' | 'failure';

export interface CriticResult {
  decision: CriticDecision;
  hint?: string;
  reasoning?: string;
}

export interface TraceStore {
  outcomes: Map<string, ValidationOutcome>;
  sdomSnapshots: Map<string, SDOM>;
  screenshotPaths: Map<string, string>;
}

export interface AgentState {
  goal: GoalSpec;
  sharedMemory: Map<string, any>;
  currentSDOM: SDOM | null;
  lastSDelta: SDELTA | null;
  currentUrl: string | null;
  currentTitle: string | null;
  history: StepResult[];
  traceStore: TraceStore;
  budgets: {
    steps: number;
    cost: number;
    time: number;
  };
  criticHint?: string;
  phase: 'preconditions' | 'execution' | 'complete';
  goalCheckerResult?: {
    goalMet: boolean;
    confidence: number;
    reasoning: string;
  };
  plannerMode?: PlannerMode;
  contextId: string;
  totalCost: number;
  startTime: number;
}

