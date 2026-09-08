export type AlgorithmType = 'token_bucket' | 'sliding_window';

export interface Metrics {
  totalRequests: number;
  allowedRequests: number;
  deniedRequests: number;
  clients: number;
  requestsPerSecond?: number;
  instances?: number;
  distributedMode?: boolean;
}

export interface Health {
  status: 'ok' | 'degraded' | 'unhealthy';
  database: 'connected' | 'disconnected';
  instanceId: string;
  services: {
    api: string;
    postgres: string;
    redis: string;
  };
}

export interface Client {
  clientKey: string;
  algorithm: AlgorithmType;
  requestsPerSecond: number;
  burstSize: number;
  windowSize: number;
  allowedRequests?: number;
  deniedRequests?: number;
  totalRequests?: number;
  allowPercentage?: number;
  denyPercentage?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TraceSpan {
  id: string;
  name: string;
  startTime: number;
  durationMs: number;
  status: 'ok' | 'throttled' | 'error' | 'bypassed';
  description: string;
}

export interface RequestTrace {
  id: string;
  traceId: string;
  requestId: string;
  clientKey: string;
  algorithm: AlgorithmType;
  decision: 'ALLOW' | 'DENY' | 'ERROR';
  statusCode: number;
  latencyMs: number;
  remaining: number;
  limit: number;
  reset: number;
  retryAfter?: number;
  instanceId: string;
  timestamp: number;
  spans: TraceSpan[];
  headers: Record<string, string>;
  payload?: any;
}

export interface InstanceNode {
  id: string;
  name: string;
  host: string;
  port: number;
  status: 'healthy' | 'degraded' | 'offline';
  role: 'primary' | 'worker';
  rps: number;
  totalProcessed: number;
  allowed: number;
  denied: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  loadSharePercent: number;
  cpuUsage: number;
  memoryMb: number;
  uptimeSec: number;
  redisConnected: boolean;
}

export interface HeaderSnapshot {
  timestamp: number;
  clientKey: string;
  statusCode: number;
  decision: 'ALLOW' | 'DENY';
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
  instanceId: string;
  requestId: string;
  rawHeaders: Record<string, string>;
}

export interface BenchmarkConfig {
  clientKey: string;
  concurrency: number;
  totalRequests: number;
  durationSec: number;
  mode: 'requests' | 'duration';
  pattern: 'uniform' | 'burst' | 'jitter' | 'surge';
}

export interface BenchmarkPoint {
  time: number;
  rps: number;
  allowed: number;
  denied: number;
  avgLatency: number;
}

export interface BenchmarkResult {
  id: string;
  timestamp: number;
  clientKey: string;
  algorithm: AlgorithmType;
  config: BenchmarkConfig;
  totalSent: number;
  allowed: number;
  denied: number;
  errors: number;
  actualDurationSec: number;
  avgRps: number;
  peakRps: number;
  latencies: number[];
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  minLatency: number;
  maxLatency: number;
  avgLatency: number;
  timeline: BenchmarkPoint[];
}

export interface ChaosState {
  redisLatencyMs: number;
  redisFailure: boolean;
  ddosSurge: boolean;
  clockDriftMs: number;
  degradedDb: boolean;
  activeInjections: number;
}

export type EventSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
export type EventCategory = 'POLICY' | 'THROTTLE' | 'CLUSTER' | 'BENCHMARK' | 'CHAOS' | 'SECURITY' | 'SYSTEM';

export interface SystemEvent {
  id: string;
  timestamp: number;
  severity: EventSeverity;
  category: EventCategory;
  title: string;
  message: string;
  details?: Record<string, any>;
}

export type TabType =
  | 'overview'
  | 'simulator'
  | 'tracing'
  | 'telemetry'
  | 'headers'
  | 'benchmark'
  | 'chaos'
  | 'events'
  | 'policies'
  | 'algorithms'
  | 'apihub';
