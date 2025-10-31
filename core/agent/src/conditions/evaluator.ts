import { Observation, SuccessCondition } from '../schema/types.js';

export interface EvaluationResult {
  met: boolean;
  matchedCondition?: string;
}

export function evaluateSuccess(
  observation: Observation,
  conditions: SuccessCondition[]
): EvaluationResult {
  for (const condition of conditions) {
    if ('url_contains' in condition) {
      if (observation.url.includes(condition.url_contains)) {
        return {
          met: true,
          matchedCondition: `url_contains: "${condition.url_contains}"`,
        };
      }
    }

    if ('element_visible' in condition) {
      const found = observation.nodes.some(
        (node) => node.testId === condition.element_visible && node.visible
      );
      if (found) {
        return {
          met: true,
          matchedCondition: `element_visible: "${condition.element_visible}"`,
        };
      }
    }

    if ('heading_text' in condition) {
      const found = observation.nodes.some(
        (node) =>
          (node.role === 'heading' || node.role.startsWith('h')) &&
          node.name.toLowerCase().includes(condition.heading_text.toLowerCase())
      );
      if (found) {
        return {
          met: true,
          matchedCondition: `heading_text: "${condition.heading_text}"`,
        };
      }
    }
  }

  return { met: false };
}

