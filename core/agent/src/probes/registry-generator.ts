import { discoverAllTools } from '../mcp/tool-discovery.js';

interface ToolSchema {
  name: string;
  description: string;
  inputSchema?: any;
  readOnly: boolean;
}

export class ProbeRegistry {
  private tools: Map<string, ToolSchema> = new Map();

  async initialize(): Promise<void> {
    const discovered = await discoverAllTools();
    
    discovered.data.forEach(tool => {
      const readOnly = 
        tool.name.includes('.get') ||
        tool.name.includes('.list') ||
        tool.name.includes('.read') ||
        tool.annotations?.readOnlyHint === true;
      
      if (readOnly) {
        this.tools.set(tool.name, {
          name: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema,
          readOnly: true
        });
      }
    });
  }

  getTool(name: string): ToolSchema | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolSchema[] {
    return Array.from(this.tools.values());
  }

  isValidTool(name: string): boolean {
    return this.tools.has(name);
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  getToolsFormatted(): string {
    return Array.from(this.tools.values())
      .map(tool => {
        const params = tool.inputSchema?.properties 
          ? Object.keys(tool.inputSchema.properties).join(', ')
          : '';
        return `- ${tool.name}: ${tool.description}${params ? ` (params: ${params})` : ''}`;
      })
      .join('\n');
  }
}


