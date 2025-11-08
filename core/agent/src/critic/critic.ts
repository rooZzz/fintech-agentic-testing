import { CriticDecision, CriticResult, PlannerMode, ValidationOutcome } from '../schema/types.js';
import { TraceStore } from '../evidence/trace-store.js';

export class Critic {
  constructor(private traceStore: TraceStore) {}

  evaluate(
    plannerMode: PlannerMode,
    lastValidationOutcome: ValidationOutcome | null,
    evidenceClaims: string[] | undefined,
    currentStepNumber: number
  ): CriticResult {
    if (plannerMode === 'next') {
      return this.evaluateNextAction(lastValidationOutcome);
    } else {
      return this.evaluateDoneDeclaration(evidenceClaims, currentStepNumber);
    }
  }

  private evaluateNextAction(lastValidationOutcome: ValidationOutcome | null): CriticResult {
    if (!lastValidationOutcome) {
      return {
        decision: 'continue',
        reasoning: 'No validation outcome available, continuing'
      };
    }

    if (lastValidationOutcome.passed && lastValidationOutcome.confidence >= 0.7) {
      return {
        decision: 'continue',
        reasoning: 'Validation passed with good confidence, continuing to next action'
      };
    }

    if (!lastValidationOutcome.passed && lastValidationOutcome.confidence >= 0.7) {
      const hasBackendData = lastValidationOutcome.probeResults.some(p => p.success);
      const hasDataMismatch = lastValidationOutcome.concerns.some(c => 
        c.toLowerCase().includes('does not match') || 
        c.toLowerCase().includes('mismatch') || 
        c.toLowerCase().includes('but backend') ||
        c.toLowerCase().includes('backend data shows') ||
        c.toLowerCase().includes('backend confirms')
      );
      
      if (hasBackendData && hasDataMismatch) {
        const hint = this.generateRetryHint(lastValidationOutcome);
        return {
          decision: 'failure',
          hint: `🐛 CRITICAL BUG DETECTED:\n${hint}`,
          reasoning: 'High-confidence validation failure with UI/backend data mismatch - this is a real bug, not a transient issue'
        };
      }
    }

    if (!lastValidationOutcome.passed) {
      const hint = this.generateRetryHint(lastValidationOutcome);

      return {
        decision: 'retry',
        hint,
        reasoning: 'Validation failed, suggesting retry with different approach'
      };
    }

    if (lastValidationOutcome.confidence < 0.7) {
      return {
        decision: 'retry',
        hint: `Low confidence validation (${lastValidationOutcome.confidence}). ${lastValidationOutcome.concerns.join('. ')}`,
        reasoning: 'Low confidence validation, needs verification'
      };
    }

    return {
      decision: 'continue',
      reasoning: 'Validation unclear, continuing cautiously'
    };
  }

  private evaluateDoneDeclaration(
    evidenceClaims: string[] | undefined,
    currentStepNumber: number
  ): CriticResult {
    if (!evidenceClaims || evidenceClaims.length === 0) {
      return {
        decision: 'retry',
        hint: 'No evidence claims provided. You must cite specific ValidationOutcome IDs to declare completion.',
        reasoning: 'Missing evidence claims'
      };
    }

    const missingOutcomes: string[] = [];
    const failedOutcomes: string[] = [];
    const staleOutcomes: string[] = [];
    const lowConfidenceOutcomes: string[] = [];

    for (const claimId of evidenceClaims) {
      const outcome = this.traceStore.getOutcome(claimId);
      
      if (!outcome) {
        missingOutcomes.push(claimId);
        continue;
      }

      if (!outcome.passed) {
        failedOutcomes.push(claimId);
      }

      if (outcome.confidence < 0.7) {
        lowConfidenceOutcomes.push(claimId);
      }

      if (currentStepNumber - outcome.stepNumber > 5) {
        staleOutcomes.push(claimId);
      }
    }

    if (missingOutcomes.length > 0) {
      return {
        decision: 'retry',
        hint: `Evidence claims reference non-existent outcomes: ${missingOutcomes.join(', ')}. Only cite ValidationOutcome IDs that exist.`,
        reasoning: 'Cited non-existent outcomes'
      };
    }

    if (failedOutcomes.length > 0) {
      return {
        decision: 'retry',
        hint: `Evidence claims include failed validations: ${failedOutcomes.join(', ')}. Goal cannot be complete if cited evidence shows failure.`,
        reasoning: 'Cited failed validation outcomes'
      };
    }

    if (lowConfidenceOutcomes.length > 0) {
      return {
        decision: 'retry',
        hint: `Evidence has low confidence: ${lowConfidenceOutcomes.join(', ')}. Need stronger validation before declaring completion.`,
        reasoning: 'Cited low-confidence outcomes'
      };
    }

    if (staleOutcomes.length > 0) {
      return {
        decision: 'retry',
        hint: `Evidence is stale (>5 steps old): ${staleOutcomes.join(', ')}. Re-validate to ensure current state still matches goal.`,
        reasoning: 'Cited stale evidence'
      };
    }

    const recentOutcomes = this.traceStore.getRecent(3);
    const recentHaveGoodEvidence = recentOutcomes.some(o => 
      o.passed && o.confidence >= 0.8
    );

    const conflicts = this.traceStore.hasConflicts(evidenceClaims, currentStepNumber);
    if (conflicts && !recentHaveGoodEvidence) {
      return {
        decision: 'retry',
        hint: 'Newer validation outcomes contradict your cited evidence. Re-validate current state.',
        reasoning: 'Conflicting evidence detected'
      };
    }

    return {
      decision: 'success',
      reasoning: 'All evidence claims verified: outcomes exist, passed, fresh, consistent, and layer-diverse'
    };
  }

  private generateRetryHint(outcome: ValidationOutcome): string {
    const hints: string[] = [];

    hints.push(`Validation failed: ${outcome.reasoning}`);
    
    if (outcome.concerns.length > 0) {
      hints.push('\nConcerns:');
      outcome.concerns.forEach(c => {
        hints.push(`  - ${c}`);
      });
    }

    if (outcome.probeResults.some(p => !p.success)) {
      hints.push('\nBackend probes failed - action may not have persisted.');
    }

    hints.push('\nConsider: verify action completed successfully, or try a different approach.');

    return hints.join('\n');
  }
}

