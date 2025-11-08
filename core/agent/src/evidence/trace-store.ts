import { ValidationOutcome, SDOM } from '../schema/types.js';

export class TraceStore {
  private outcomes: Map<string, ValidationOutcome> = new Map();
  private sdomSnapshots: Map<string, SDOM> = new Map();
  private screenshotPaths: Map<string, string> = new Map();

  addOutcome(outcome: ValidationOutcome): void {
    this.outcomes.set(outcome.id, outcome);
  }

  getOutcome(id: string): ValidationOutcome | undefined {
    return this.outcomes.get(id);
  }

  getRecent(n: number): ValidationOutcome[] {
    const all = Array.from(this.outcomes.values());
    all.sort((a, b) => b.timestamp - a.timestamp);
    return all.slice(0, n);
  }

  hasConflicts(outcomeIds: string[], currentStepNumber: number): boolean {
    const citedOutcomes = outcomeIds
      .map(id => this.outcomes.get(id))
      .filter((o): o is ValidationOutcome => o !== undefined);

    if (citedOutcomes.length === 0) return true;

    for (const outcome of citedOutcomes) {
      if (!outcome.passed) {
        return true;
      }
      
      if (currentStepNumber - outcome.stepNumber > 5) {
        return true;
      }
    }

    const newerOutcomes = Array.from(this.outcomes.values()).filter(
      o => o.stepNumber > Math.max(...citedOutcomes.map(co => co.stepNumber))
    );

    for (const newer of newerOutcomes) {
      if (!newer.passed) {
        return true;
      }
    }

    return false;
  }

  checkFreshness(outcomeIds: string[], currentStepNumber: number): boolean {
    return outcomeIds.every(id => {
      const outcome = this.outcomes.get(id);
      if (!outcome) return false;
      return currentStepNumber - outcome.stepNumber <= 5;
    });
  }

  checkLayerDiversity(outcomeIds: string[]): { hasDiversity: boolean; layers: string[] } {
    const outcomes = outcomeIds
      .map(id => this.outcomes.get(id))
      .filter((o): o is ValidationOutcome => o !== undefined);

    const hasProbes = outcomes.some(o => o.probeResults && o.probeResults.length > 0);
    const hasUI = outcomes.some(o => o.evidence && o.evidence.some(e => 
      e.toLowerCase().includes('ui') || e.toLowerCase().includes('page') || e.toLowerCase().includes('element')
    ));

    return { 
      hasDiversity: hasProbes && hasUI, 
      layers: [hasUI ? 'ui' : '', hasProbes ? 'backend' : ''].filter(Boolean)
    };
  }

  storeSDOMSnapshot(stepNumber: number, sdom: SDOM): void {
    this.sdomSnapshots.set(`step_${stepNumber}`, sdom);
  }

  getSDOMSnapshot(stepNumber: number): SDOM | undefined {
    return this.sdomSnapshots.get(`step_${stepNumber}`);
  }

  storeScreenshot(stepNumber: number, path: string): void {
    this.screenshotPaths.set(`step_${stepNumber}`, path);
  }

  getScreenshotPath(stepNumber: number): string | undefined {
    return this.screenshotPaths.get(`step_${stepNumber}`);
  }

  getAllOutcomes(): ValidationOutcome[] {
    return Array.from(this.outcomes.values());
  }

  clear(): void {
    this.outcomes.clear();
    this.sdomSnapshots.clear();
    this.screenshotPaths.clear();
  }
}

