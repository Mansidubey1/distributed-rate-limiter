export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type WorkspaceMode = 'request' | 'response';

export interface KeyValueParam {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface RequestTemplate {
  id: string;
  name: string;
  description?: string;
  method: HttpMethod;
  url: string;
  headers: KeyValueParam[];
  params: KeyValueParam[];
  bodyType: 'json' | 'raw' | 'none';
  bodyJson: string;
  authType: 'none' | 'bearer' | 'apikey';
  bearerToken?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  clientKey?: string;
}

export interface RequestCollectionFolder {
  id: string;
  name: string;
  description?: string;
  requests: RequestTemplate[];
}

export interface RequestCollection {
  id: string;
  name: string;
  description?: string;
  folders: RequestCollectionFolder[];
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface EnvironmentProfile {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
}

export interface ConsoleLogEntry {
  id: string;
  timestamp: number;
  type: 'request' | 'response' | 'error' | 'info';
  method?: HttpMethod;
  url?: string;
  status?: number;
  statusText?: string;
  latencyMs?: number;
  instanceId?: string;
  remaining?: number;
  limit?: number;
  message: string;
  details?: any;
}

export interface ResponseSnapshot {
  timestamp: number;
  status: number;
  statusText: string;
  latencyMs: number;
  sizeBytes: number;
  body: any;
  headers: Record<string, string>;
  instanceId: string;
  requestId: string;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
  algorithm?: 'token_bucket' | 'sliding_window' | string;
  decision?: 'ALLOW' | 'DENY';
  isProxied?: boolean;
  targetUrl?: string;
  error?: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  method: HttpMethod;
  url: string;
  clientKey: string;
  status: number;
  latencyMs: number;
  decision: 'ALLOW' | 'DENY' | 'ERROR';
  request: RequestTemplate;
  response: ResponseSnapshot;
}

export interface DemoApiPreset {
  id: string;
  name: string;
  category: string;
  method: HttpMethod;
  url: string;
  description: string;
  headers?: Record<string, string>;
  body?: any;
}
