export interface UINode {
  id: string;
  role: string;
  name: string;
  bounds: { x: number; y: number; w: number; h: number };
  enabled: boolean;
  visible: boolean;
  focused: boolean;
  testId?: string;
  href?: string;
  value?: string;
  tagName?: string;
}

export interface NavigateRequest {
  url: string;
  contextId?: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface NavigateResponse {
  ok: boolean;
  currentUrl: string;
  title: string;
}

export interface QueryRequest {
  role?: string;
  name?: string;
  text?: string;
  selector?: string;
  testId?: string;
  contextId?: string;
}

export interface QueryResponse {
  nodes: UINode[];
}

export interface ObserveRequest {
  contextId?: string;
}

export interface ObserveResponse {
  nodes: UINode[];
  url: string;
  title: string;
}

export interface ClickRequest {
  nodeId?: string;
  selector?: string;
  testId?: string;
  contextId?: string;
}

export interface ClickResponse {
  ok: boolean;
  message?: string;
}

export interface TypeRequest {
  nodeId?: string;
  selector?: string;
  testId?: string;
  text: string;
  clear?: boolean;
  contextId?: string;
}

export interface TypeResponse {
  ok: boolean;
  message?: string;
}

export interface SessionSaveRequest {
  name: string;
  contextId?: string;
}

export interface SessionSaveResponse {
  stateId: string;
  path: string;
}

export interface SessionLoadRequest {
  stateId: string;
  contextId?: string;
}

export interface SessionLoadResponse {
  ok: boolean;
}

