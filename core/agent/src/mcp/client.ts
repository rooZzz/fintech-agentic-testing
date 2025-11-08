import { Observation } from '../schema/types.js';

const MCP_WEB_URL = process.env.MCP_WEB_URL || 'http://localhost:7001';
const MCP_DATA_URL = process.env.MCP_DATA_URL || 'http://localhost:7002';

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

async function callTool(url: string, toolName: string, args: any = {}): Promise<any> {
  const response = await jsonRpcRequest(url, 'tools/call', {
    name: toolName,
    arguments: args
  });
  
  if (response.isError) {
    const errorContent = response.content?.[0]?.text;
    if (errorContent) {
      const errorData = JSON.parse(errorContent);
      throw new Error(errorData.error || 'Tool execution failed');
    }
    throw new Error('Tool execution failed');
  }
  
  const resultText = response.content?.[0]?.text;
  if (!resultText) {
    return {};
  }
  
  try {
    return JSON.parse(resultText);
  } catch {
    return resultText;
  }
}

export const mcpData = {
  async callTool(toolName: string, args: any = {}): Promise<any> {
    return callTool(MCP_DATA_URL, toolName, args);
  },

  async createUser(params: { plan: string; requires2FA: boolean; email?: string }): Promise<{
    userId: string;
    email: string;
    password: string;
    otpSecret?: string;
  }> {
    return callTool(MCP_DATA_URL, 'data.user.create', params);
  },

  async loginUser(params: { email: string; password: string; otp?: string }): Promise<{
    token: string;
  }> {
    return callTool(MCP_DATA_URL, 'data.user.login', params);
  },

  async getUser(params: { userId?: string; email?: string }): Promise<{
    user: any;
  }> {
    return callTool(MCP_DATA_URL, 'data.user.get', params);
  },

  async reset(params: { tenant?: string; scope?: string } = {}): Promise<{ ok: boolean }> {
    return callTool(MCP_DATA_URL, 'data.reset', params);
  },

  async seedLoans(params: { count?: number } = {}): Promise<{
    loans: any[];
    count: number;
  }> {
    return callTool(MCP_DATA_URL, 'data.loan.seed', params);
  },

  async getLoan(params: { id: string }): Promise<{
    loan: any;
  }> {
    return callTool(MCP_DATA_URL, 'data.loan.get', params);
  },

  async resetLoans(): Promise<{ ok: boolean }> {
    return callTool(MCP_DATA_URL, 'data.loan.reset', {});
  },

  async getCreditReport(params: { userId: string }): Promise<any> {
    return callTool(MCP_DATA_URL, 'data.creditReport.get', params);
  },

  async health(): Promise<{ ok: boolean }> {
    const response = await fetch(`${MCP_DATA_URL}/health`);
    return response.json() as Promise<{ ok: boolean }>;
  },
};

export const mcpWeb = {
  async callTool(toolName: string, args: any = {}): Promise<any> {
    return callTool(MCP_WEB_URL, toolName, args);
  },

  async navigate(params: { url: string; waitUntil?: string; contextId?: string }): Promise<{
    ok: boolean;
    currentUrl: string;
    title: string;
  }> {
    return callTool(MCP_WEB_URL, 'ui.navigate', params);
  },

  async resetBrowser(params: { contextId?: string } = {}): Promise<{
    ok: boolean;
    message: string;
  }> {
    return callTool(MCP_WEB_URL, 'browser.reset', params);
  },

  async observe(params: {
    contextId?: string;
    goal?: string;
    lastAction?: string;
    expectingValidation?: boolean;
  } = {}): Promise<Observation> {
    const response = await callTool(MCP_WEB_URL, 'ui.observe', params);
    
    return {
      url: response.url,
      title: response.title,
      sdom: response.sdom || { interactive: [], content: [], feedback: [], data: [] },
      sdelta: response.sdelta || null
    };
  },

  async query(params: {
    role?: string;
    name?: string;
    text?: string;
    selector?: string;
    testId?: string;
    contextId?: string;
  }): Promise<{ nodes: any[] }> {
    return callTool(MCP_WEB_URL, 'ui.query', params);
  },

  async click(params: { nodeId?: string; selector?: string; testId?: string; contextId?: string }): Promise<{
    ok: boolean;
    traceId?: string;
  }> {
    return callTool(MCP_WEB_URL, 'ui.act.click', params);
  },

  async type(params: {
    nodeId?: string;
    selector?: string;
    testId?: string;
    text: string;
    clear?: boolean;
    contextId?: string;
  }): Promise<{
    ok: boolean;
    traceId?: string;
  }> {
    return callTool(MCP_WEB_URL, 'ui.act.type', params);
  },

  async saveSession(params: { name: string; contextId?: string }): Promise<{
    stateId: string;
    path: string;
  }> {
    return callTool(MCP_WEB_URL, 'session.save', params);
  },

  async loadSession(params: { stateId: string; contextId?: string }): Promise<{ ok: boolean }> {
    return callTool(MCP_WEB_URL, 'session.load', params);
  },

  async health(): Promise<{ ok: boolean }> {
    const response = await fetch(`${MCP_WEB_URL}/health`);
    return response.json() as Promise<{ ok: boolean }>;
  },
};
