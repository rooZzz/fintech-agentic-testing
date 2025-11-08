import { ProbeSpec } from '../schema/types.js';
import { ProbeRegistry } from './registry-generator.js';
import { mcpData } from '../mcp/client.js';

interface ProbeResult {
  tool: string;
  passed: boolean;
  response: any;
  expectation?: any;
  error?: string;
}

export class ProbeBroker {
  constructor(private registry: ProbeRegistry) {}

  async execute(spec: ProbeSpec, sharedMemory: Map<string, any>): Promise<ProbeResult> {
    if (!this.registry.isValidTool(spec.tool)) {
      return {
        tool: spec.tool,
        passed: false,
        response: null,
        error: `Invalid tool: ${spec.tool} not in registry`
      };
    }

    const params = this.resolveTemplates(spec.params, sharedMemory);

    try {
      const response = await mcpData.callTool(spec.tool, params);

      return {
        tool: spec.tool,
        passed: true,
        response
      };
    } catch (error) {
      return {
        tool: spec.tool,
        passed: false,
        response: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private resolveTemplates(params: Record<string, any>, sharedMemory: Map<string, any>): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const path = value.slice(2, -2).trim();
        resolved[key] = this.resolveVariablePath(path, sharedMemory);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  private resolveVariablePath(path: string, sharedMemory: Map<string, any>): any {
    const parts = path.split('.');
    const rootKey = parts[0];
    const rootValue = sharedMemory.get(rootKey);

    if (!rootValue) {
      return undefined;
    }

    if (parts.length === 1) {
      return rootValue;
    }

    let current = rootValue;
    for (let i = 1; i < parts.length; i++) {
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }
      current = current[parts[i]];
    }

    return current;
  }

}

