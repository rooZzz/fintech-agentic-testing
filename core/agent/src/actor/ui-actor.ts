import { Action } from '../schema/types.js';
import { mcpWeb } from '../mcp/client.js';
import * as fs from 'fs';
import * as path from 'path';

interface ActorResult {
  success: boolean;
  evidenceId: string;
  error?: string;
}

export class UIActor {
  private evidenceDir: string;
  
  constructor(evidenceDir: string = './out/evidence') {
    this.evidenceDir = evidenceDir;
    this.ensureEvidenceDir();
  }

  private ensureEvidenceDir(): void {
    if (!fs.existsSync(this.evidenceDir)) {
      fs.mkdirSync(this.evidenceDir, { recursive: true });
    }
  }

  async execute(action: Action, contextId: string, stepNumber: number): Promise<ActorResult> {
    const evidenceId = `step_${stepNumber}_${Date.now()}`;
    
    try {
      let result: any;
      
      switch (action.type) {
        case 'ui.act.click':
          result = await mcpWeb.click({
            contextId,
            ...(action.params || {})
          });
          break;
          
        case 'ui.act.type':
          result = await mcpWeb.type({
            contextId,
            text: '',
            ...(action.params || {})
          });
          break;
          
        case 'ui.act.interact':
          result = await mcpWeb.callTool('ui.act.interact', {
            contextId,
            ...(action.params || {})
          });
          break;
          
        case 'ui.navigate':
          result = await mcpWeb.navigate({
            contextId,
            url: '',
            ...(action.params || {})
          });
          await new Promise(resolve => setTimeout(resolve, 1000));
          break;
          
        default:
          return {
            success: false,
            evidenceId,
            error: `Unknown action type: ${action.type}`
          };
      }
      
      return {
        success: true,
        evidenceId
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        evidenceId,
        error: errorMessage
      };
    }
  }

  private getScreenshotPath(evidenceId: string): string {
    return path.join(this.evidenceDir, `${evidenceId}.png`);
  }
}

