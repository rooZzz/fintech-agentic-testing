import { Action, SDOM } from '../schema/types.js';

interface Budgets {
  steps: number;
  cost: number;
  time: number;
}

interface GuardResult {
  allowed: boolean;
  reason?: string;
}

export class PolicyGuard {
  private actionTimestamps: number[] = [];
  private readonly maxActionsPerSecond = 3;
  private readonly allowedDomains = ['localhost', '127.0.0.1'];
  private readonly dangerousPatterns = [
    'delete',
    'remove',
    'destroy',
    '[class*="danger"]',
    '[class*="delete"]'
  ];

  check(
    action: Action,
    budgets: Budgets,
    currentStep: number,
    currentCost: number,
    lastSDOM: SDOM | null,
    currentUrl?: string
  ): GuardResult {
    const budgetCheck = this.checkBudgets(budgets, currentStep, currentCost);
    if (!budgetCheck.allowed) return budgetCheck;

    const rateCheck = this.checkRateLimit();
    if (!rateCheck.allowed) return rateCheck;

    if (action.type === 'ui.navigate') {
      const urlCheck = this.checkNavigationSafety(action.params?.url);
      if (!urlCheck.allowed) return urlCheck;
    }

    if (action.type === 'ui.act.click' || action.type === 'ui.act.type' || action.type === 'ui.act.interact') {
      const elementCheck = this.checkElementExists(action, lastSDOM);
      if (!elementCheck.allowed) return elementCheck;

      const selectorCheck = this.checkSelectorSafety(action.params?.selector, action.params?.testId);
      if (!selectorCheck.allowed) return selectorCheck;
    }

    return { allowed: true };
  }

  private checkBudgets(budgets: Budgets, currentStep: number, currentCost: number): GuardResult {
    if (currentStep >= budgets.steps) {
      return {
        allowed: false,
        reason: `Step budget exceeded: ${currentStep} >= ${budgets.steps}`
      };
    }

    if (currentCost >= budgets.cost) {
      return {
        allowed: false,
        reason: `Cost budget exceeded: $${currentCost.toFixed(4)} >= $${budgets.cost}`
      };
    }

    return { allowed: true };
  }

  private checkRateLimit(): GuardResult {
    const now = Date.now();
    this.actionTimestamps = this.actionTimestamps.filter(ts => now - ts < 1000);

    if (this.actionTimestamps.length >= this.maxActionsPerSecond) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.maxActionsPerSecond} actions per second`
      };
    }

    this.actionTimestamps.push(now);
    return { allowed: true };
  }

  private checkNavigationSafety(url?: string): GuardResult {
    if (!url) {
      return { allowed: false, reason: 'Navigation URL is required' };
    }

    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;

      if (!this.allowedDomains.includes(hostname)) {
        return {
          allowed: false,
          reason: `Navigation to ${hostname} not allowed. Allowed domains: ${this.allowedDomains.join(', ')}`
        };
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Invalid navigation URL: ${url}`
      };
    }
  }

  private checkElementExists(action: Action, lastSDOM: SDOM | null): GuardResult {
    if (!lastSDOM) {
      return { allowed: true };
    }

    const testId = action.params?.testId;
    const selector = action.params?.selector;

    if (testId) {
      const exists = [
        ...lastSDOM.interactive,
        ...lastSDOM.content,
        ...lastSDOM.feedback
      ].some(el => el.testId === testId);

      if (!exists) {
        return {
          allowed: false,
          reason: `Element with testId="${testId}" not found in last observation`
        };
      }
    }

    return { allowed: true };
  }

  private checkSelectorSafety(selector?: string, testId?: string): GuardResult {
    if (testId) {
      return { allowed: true };
    }

    if (!selector) {
      return { allowed: true };
    }

    const lowerSelector = selector.toLowerCase();
    
    for (const pattern of this.dangerousPatterns) {
      if (lowerSelector.includes(pattern)) {
        return {
          allowed: false,
          reason: `Selector contains dangerous pattern: ${pattern}`
        };
      }
    }

    if (selector.includes('*') && selector.length < 10) {
      return {
        allowed: false,
        reason: 'Overly broad selector pattern detected'
      };
    }

    return { allowed: true };
  }

  addAllowedDomain(domain: string): void {
    if (!this.allowedDomains.includes(domain)) {
      this.allowedDomains.push(domain);
    }
  }

  reset(): void {
    this.actionTimestamps = [];
  }
}

