interface Tool {
  name: string;
  description: string;
  params: Record<string, string>;
}

interface ToolsResponse {
  tools: Tool[];
}

export async function discoverTools(mcpUrl: string): Promise<Tool[]> {
  try {
    const response = await fetch(`${mcpUrl}/tools`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tools from ${mcpUrl}: ${response.statusText}`);
    }
    
    const data = await response.json() as ToolsResponse;
    return data.tools;
  } catch (error) {
    console.warn(`Could not discover tools from ${mcpUrl}:`, error);
    return [];
  }
}

export async function discoverAllTools(): Promise<{
  web: Tool[];
  data: Tool[];
}> {
  const MCP_WEB_URL = process.env.MCP_WEB_URL || 'http://localhost:7001';
  const MCP_DATA_URL = process.env.MCP_DATA_URL || 'http://localhost:7002';
  
  const [web, data] = await Promise.all([
    discoverTools(MCP_WEB_URL),
    discoverTools(MCP_DATA_URL)
  ]);
  
  return { web, data };
}

export function formatToolsForPrompt(tools: { web: Tool[]; data: Tool[] }): string {
  const uiTools = tools.web
    .filter(t => t.name.startsWith('ui.act.'))
    .map(t => {
      const paramsStr = Object.keys(t.params).length > 0 
        ? `\n  Params: ${JSON.stringify(t.params)}`
        : '';
      return `- ${t.name}: ${t.description}${paramsStr}`;
    })
    .join('\n');
  
  const dataTools = tools.data
    .filter(t => t.name.startsWith('data.'))
    .map(t => {
      const paramsStr = Object.keys(t.params).length > 0 
        ? `\n  Params: ${JSON.stringify(t.params)}`
        : '';
      return `- ${t.name}: ${t.description}${paramsStr}`;
    })
    .join('\n');
  
  return `
Available MCP Operations:

UI ACTIONS (for navigation):
${uiTools}

DATA VERIFICATION (for validation):
${dataTools}

IMPORTANT: Use the exact parameter names shown above. Do not guess or improvise parameter names.
`.trim();
}

