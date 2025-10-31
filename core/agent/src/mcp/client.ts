import { Observation, UINode } from '../schema/types.js';

const MCP_WEB_URL = process.env.MCP_WEB_URL || 'http://localhost:7001';
const MCP_DATA_URL = process.env.MCP_DATA_URL || 'http://localhost:7002';

interface McpResponse<T = any> {
  ok?: boolean;
  error?: string;
  [key: string]: any;
}

async function mcpRequest<T>(url: string, endpoint: string, body?: any): Promise<T> {
  try {
    const response = await fetch(`${url}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as McpResponse<T>;
    
    if (data.error) {
      throw new Error(data.error);
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`MCP request failed (${endpoint}): ${error.message}`);
    }
    throw error;
  }
}

export const mcpData = {
  async createUser(params: { plan: string; requires2FA: boolean }): Promise<{
    userId: string;
    email: string;
    password: string;
    otpSecret?: string;
  }> {
    return mcpRequest(MCP_DATA_URL, '/data/user/create', params);
  },

  async loginUser(params: { email: string; password: string; otp?: string }): Promise<{
    token: string;
  }> {
    return mcpRequest(MCP_DATA_URL, '/data/user/login', params);
  },

  async getUser(params: { userId?: string; email?: string }): Promise<{
    user: any;
  }> {
    return mcpRequest(MCP_DATA_URL, '/data/user/get', params);
  },

  async reset(params: { tenant?: string; scope?: string } = {}): Promise<{ ok: boolean }> {
    return mcpRequest(MCP_DATA_URL, '/data/reset', params);
  },

  async seedLoans(params: { count?: number } = {}): Promise<{
    loans: any[];
    count: number;
  }> {
    return mcpRequest(MCP_DATA_URL, '/data/loan/seed', params);
  },

  async listLoans(params: { amount?: number; term?: number; loanType?: string } = {}): Promise<{
    loans: any[];
  }> {
    return mcpRequest(MCP_DATA_URL, '/data/loan/list', params);
  },

  async getLoan(params: { id: string }): Promise<{
    loan: any;
  }> {
    return mcpRequest(MCP_DATA_URL, '/data/loan/get', params);
  },

  async resetLoans(): Promise<{ ok: boolean }> {
    return mcpRequest(MCP_DATA_URL, '/data/loan/reset', {});
  },

  async health(): Promise<{ ok: boolean }> {
    const response = await fetch(`${MCP_DATA_URL}/health`);
    return response.json() as Promise<{ ok: boolean }>;
  },
};

export const mcpWeb = {
  async navigate(params: { url: string; waitUntil?: string; contextId?: string }): Promise<{
    ok: boolean;
    currentUrl: string;
    title: string;
  }> {
    return mcpRequest(MCP_WEB_URL, '/ui/navigate', params);
  },

  async resetBrowser(params: { contextId?: string } = {}): Promise<{
    ok: boolean;
    message: string;
  }> {
    return mcpRequest(MCP_WEB_URL, '/browser/reset', params);
  },

  async observe(contextId?: string): Promise<Observation> {
    const response = await mcpRequest<{
      url: string;
      title: string;
      nodes: any[];
    }>(MCP_WEB_URL, '/ui/observe', contextId ? { contextId } : {});
    
    return {
      url: response.url,
      title: response.title,
      nodes: response.nodes.map((node: any) => ({
        id: node.id || '',
        role: node.role || '',
        name: node.name || '',
        bounds: node.bounds || { x: 0, y: 0, w: 0, h: 0 },
        enabled: node.enabled !== false,
        visible: node.visible !== false,
        testId: node.testId,
        href: node.href,
        value: node.value,
      })),
    };
  },

  async query(params: {
    role?: string;
    name?: string;
    text?: string;
    selector?: string;
    testId?: string;
  }): Promise<{ nodes: UINode[] }> {
    return mcpRequest(MCP_WEB_URL, '/ui/query', params);
  },

  async click(params: { nodeId?: string; selector?: string; testId?: string; contextId?: string }): Promise<{
    ok: boolean;
    traceId?: string;
  }> {
    return mcpRequest(MCP_WEB_URL, '/ui/act/click', params);
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
    return mcpRequest(MCP_WEB_URL, '/ui/act/type', params);
  },

  async saveSession(params: { name: string }): Promise<{
    stateId: string;
    path: string;
  }> {
    return mcpRequest(MCP_WEB_URL, '/session/save', params);
  },

  async loadSession(params: { stateId: string }): Promise<{ ok: boolean }> {
    return mcpRequest(MCP_WEB_URL, '/session/load', params);
  },

  async health(): Promise<{ ok: boolean }> {
    const response = await fetch(`${MCP_WEB_URL}/health`);
    return response.json() as Promise<{ ok: boolean }>;
  },
};

