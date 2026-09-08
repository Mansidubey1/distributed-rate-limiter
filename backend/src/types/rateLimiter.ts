import { RateLimiterAlgorithm, RateLimitDecision, AlgorithmEvaluationResult } from '../algorithms/types.js';

export { RateLimiterAlgorithm, RateLimitDecision, AlgorithmEvaluationResult };

export interface RateLimitResult {
  decision: RateLimitDecision;
  algorithm: RateLimiterAlgorithm;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
  retryAfter?: number; // In seconds, provided when DENY
}

export interface ClientConfig {
  id?: string;
  clientKey: string;
  algorithm: RateLimiterAlgorithm;
  requestsPerSecond: number;
  burstSize: number;
  windowSize: number;
  totalRequests?: number;
  allowedRequests?: number;
  deniedRequests?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ClientResponse {
  clientKey: string;
  algorithm: RateLimiterAlgorithm;
  requestsPerSecond: number;
  burstSize: number;
  windowSize: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientStats {
  clientKey: string;
  algorithm: RateLimiterAlgorithm;
  totalRequests: number;
  allowedRequests: number;
  deniedRequests: number;
}

export interface MetricsResponse {
  totalRequests: number;
  allowedRequests: number;
  deniedRequests: number;
  clients: number;
  activeClients?: number;
  requestsPerSecond?: number;
  instances?: number;
  distributedMode?: boolean;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  instanceId: string;
  services: {
    api: 'healthy' | 'unhealthy';
    postgres: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy' | 'disabled';
  };
}

export interface CreateClientInput {
  clientKey: string;
  algorithm?: RateLimiterAlgorithm;
  requestsPerSecond: number;
  burstSize?: number;
  windowSize?: number;
}

export interface UpdateClientInput {
  algorithm?: RateLimiterAlgorithm;
  requestsPerSecond?: number;
  burstSize?: number;
  windowSize?: number;
}

export interface CheckRateLimitInput {
  clientKey: string;
}

export interface CheckRateLimitResponse {
  decision: RateLimitDecision;
  algorithm: RateLimiterAlgorithm;
  limit: number;
  remaining: number;
  reset: number;
}

export interface StructuredDecisionLog {
  instanceId?: string;
  requestId?: string;
  clientKey: string;
  algorithm: RateLimiterAlgorithm;
  decision: RateLimitDecision;
  latencyMs: number;
}
