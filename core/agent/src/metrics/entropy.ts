import { StepEntry, EntropyMetric } from './types.js';

function getElementIdentifier(action: StepEntry['action']): string | null {
  if (action.type === 'ui.act.click') {
    if (action.params.testId) {
      return `click:${action.params.testId}`;
    }
    if (action.params.selector) {
      return `click:${action.params.selector}`;
    }
  }
  
  if (action.type === 'ui.act.type') {
    if (action.params.selector) {
      return `type:${action.params.selector}`;
    }
  }
  
  return null;
}

export function calculateEntropy(steps: StepEntry[]): EntropyMetric {
  const elementFrequencies: Record<string, number> = {};
  let totalInteractions = 0;
  
  for (const step of steps) {
    const identifier = getElementIdentifier(step.action);
    if (identifier) {
      elementFrequencies[identifier] = (elementFrequencies[identifier] || 0) + 1;
      totalInteractions++;
    }
  }
  
  if (totalInteractions === 0) {
    return {
      value: 0,
      elementFrequencies: {},
      totalInteractions: 0
    };
  }
  
  let entropy = 0;
  for (const count of Object.values(elementFrequencies)) {
    const probability = count / totalInteractions;
    if (probability > 0) {
      entropy -= probability * Math.log2(probability);
    }
  }
  
  return {
    value: entropy,
    elementFrequencies,
    totalInteractions
  };
}

export function calculateAggregateEntropy(allSteps: StepEntry[][]): EntropyMetric {
  const combinedFrequencies: Record<string, number> = {};
  let totalInteractions = 0;
  
  for (const steps of allSteps) {
    for (const step of steps) {
      const identifier = getElementIdentifier(step.action);
      if (identifier) {
        combinedFrequencies[identifier] = (combinedFrequencies[identifier] || 0) + 1;
        totalInteractions++;
      }
    }
  }
  
  if (totalInteractions === 0) {
    return {
      value: 0,
      elementFrequencies: {},
      totalInteractions: 0
    };
  }
  
  let entropy = 0;
  for (const count of Object.values(combinedFrequencies)) {
    const probability = count / totalInteractions;
    if (probability > 0) {
      entropy -= probability * Math.log2(probability);
    }
  }
  
  return {
    value: entropy,
    elementFrequencies: combinedFrequencies,
    totalInteractions
  };
}

