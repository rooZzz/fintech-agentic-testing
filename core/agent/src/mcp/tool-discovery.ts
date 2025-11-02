interface Tool {
  name: string;
  description: string;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

let requestId = 1;

async function jsonRpcRequest(url: string, method: string, params?: any): Promise<any> {
  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params
  };

  try {
    const response = await fetch(`${url}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as JsonRpcResponse;
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`MCP request failed (${method}): ${error.message}`);
    }
    throw error;
  }
}

export async function discoverTools(mcpUrl: string): Promise<Tool[]> {
  try {
    const response = await jsonRpcRequest(mcpUrl, 'tools/list', {});
    return response.tools || [];
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

function formatToolParams(tool: Tool): string {
  if (!tool.inputSchema?.properties) {
    return '';
  }

  const required = tool.inputSchema.required || [];
  const params = Object.entries(tool.inputSchema.properties).map(([key, schema]) => {
    const isRequired = required.includes(key);
    const typeStr = schema.type || 'any';
    const description = schema.description || '';
    return `${key} (${typeStr}${isRequired ? ', required' : ', optional'}): ${description}`;
  });

  if (params.length === 0) {
    return '';
  }

  return `\n  Params:\n    ${params.join('\n    ')}`;
}

export function filterToolsForPreconditioner(tools: { data: Tool[] }): Tool[] {
  return tools.data.filter(t => t.annotations?.readOnlyHint === false);
}

export function filterToolsForValidator(tools: { web: Tool[]; data: Tool[] }): { web: Tool[]; data: Tool[] } {
  return {
    web: tools.web,
    data: tools.data.filter(t => t.annotations?.readOnlyHint === true)
  };
}

export function formatToolsForPrompt(tools: { web: Tool[]; data: Tool[] }): string {
  const webTools = tools.web || [];
  const dataTools = tools.data || [];
  
  const uiTools = webTools
    .filter(t => t.name.startsWith('ui.act.') || t.name.startsWith('ui.navigate'))
    .map(t => `- ${t.name}: ${t.description}${formatToolParams(t)}`)
    .join('\n');
  
  const dataToolsList = dataTools
    .filter(t => t.name.startsWith('data.'))
    .map(t => `- ${t.name}: ${t.description}${formatToolParams(t)}`)
    .join('\n');
  
  return `
Available MCP Operations:

UI ACTIONS (for navigation and inspection):
${uiTools}

DATA VERIFICATION (for validation):
${dataToolsList}

IMPORTANT: Use the exact parameter names shown above. Do not guess or improvise parameter names.
`.trim();
}
