import { GoalSpec, StepResult, ValidationOutcome } from '../schema/types.js';

interface Budgets {
  steps: number;
  cost: number;
  time: number;
}

export interface PlannerContext {
  goal: GoalSpec;
  budgets: Budgets;
  credentials: Record<string, any>;
  ids: Record<string, string>;
  flags: Record<string, boolean>;
  recentOutcomes: ValidationOutcome[];
}

export interface ValidatorContext {
  goal: GoalSpec;
  credentials: Record<string, any>;
  ids: Record<string, string>;
}

export interface CriticContext {
  goal: GoalSpec;
  sharedMemory: Map<string, any>;
  history: StepResult[];
  budgets: Budgets;
}

export class ContextAssembler {
  buildPlannerContext(
    goal: GoalSpec,
    sharedMemory: Map<string, any>,
    recentOutcomes: ValidationOutcome[],
    budgets: Budgets
  ): PlannerContext {
    const credentials: Record<string, any> = {};
    const ids: Record<string, string> = {};
    const flags: Record<string, boolean> = {};

    for (const [key, value] of sharedMemory.entries()) {
      if (key.startsWith('_')) continue;

      if (typeof value === 'object' && value !== null) {
        if (value.userId) ids[`${key}.userId`] = value.userId;
        if (value.email) credentials[`${key}.email`] = value.email;
        if (value.password) credentials[`${key}.password`] = value.password;
        if (value.token) credentials[`${key}.token`] = value.token;
        if (value.otpSecret) credentials[`${key}.otpSecret`] = value.otpSecret;

        Object.entries(value).forEach(([subKey, subValue]) => {
          if (typeof subValue === 'boolean') {
            flags[`${key}.${subKey}`] = subValue;
          }
        });
      }
    }

    return {
      goal,
      budgets,
      credentials,
      ids,
      flags,
      recentOutcomes: recentOutcomes.slice(0, 5)
    };
  }

  buildValidatorContext(
    goal: GoalSpec,
    sharedMemory: Map<string, any>
  ): ValidatorContext {
    const credentials: Record<string, any> = {};
    const ids: Record<string, string> = {};

    for (const [key, value] of sharedMemory.entries()) {
      if (key.startsWith('_')) continue;

      if (typeof value === 'object' && value !== null) {
        if (value.userId) ids[`${key}.userId`] = value.userId;
        if (value.email) credentials[`${key}.email`] = value.email;
        if (value.token) credentials[`${key}.token`] = value.token;
      }
    }

    return {
      goal,
      credentials,
      ids
    };
  }

  buildCriticContext(
    goal: GoalSpec,
    sharedMemory: Map<string, any>,
    history: StepResult[],
    budgets: Budgets
  ): CriticContext {
    return {
      goal,
      sharedMemory,
      history,
      budgets
    };
  }

  formatHistoryForAgent(history: StepResult[], lastN: number = 5): string {
    const recent = history.slice(-lastN);
    return recent
      .map((step, idx) => {
        const stepNum = history.length - lastN + idx + 1;
        return `Step ${stepNum}: ${step.action.type} - ${step.reasoning}`;
      })
      .join('\n');
  }

  extractCredentials(sharedMemory: Map<string, any>): Record<string, any> {
    const creds: Record<string, any> = {};
    
    for (const [key, value] of sharedMemory.entries()) {
      if (key.startsWith('_')) continue;
      
      if (typeof value === 'object' && value !== null) {
        if (value.email) creds.email = value.email;
        if (value.password) creds.password = value.password;
        if (value.token) creds.token = value.token;
        if (value.otpSecret) creds.otpSecret = value.otpSecret;
      }
    }
    
    return creds;
  }

  extractIds(sharedMemory: Map<string, any>): Record<string, string> {
    const ids: Record<string, string> = {};
    
    for (const [key, value] of sharedMemory.entries()) {
      if (key.startsWith('_')) continue;
      
      if (typeof value === 'object' && value !== null) {
        if (value.userId) ids.userId = value.userId;
        if (value.id) ids[`${key}Id`] = value.id;
      }
    }
    
    return ids;
  }
}


