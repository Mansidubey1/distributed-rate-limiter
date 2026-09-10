import { validateTargetUrl } from './ssrfGuard.js';
import { rateLimiterService } from '../services/rateLimiter.js';
import { clientRepository } from '../repositories/clientRepository.js';
import { RateLimitResult } from '../types/rateLimiter.js';

export interface ProxyRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  clientKey: string;
  requestId?: string;
}

export interface ProxyResponseResult {
  decision: 'ALLOW' | 'DENY';
  statusCode: number;
  statusText: string;
  targetUrl: string;
  method: string;
  latencyMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  body: any;
  rateLimit: {
    algorithm: string;
    limit: number;
    remaining: number;
    reset: number;
    retryAfter?: number;
  };
  instanceId: string;
  requestId: string;
  error?: string;
}

// Dangerous or hop-by-hop headers to strip when forwarding
const FORBIDDEN_FORWARD_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'expect',
]);

export class ProxyService {
  /**
   * Auto-provisions a client key if it does not yet exist in PostgreSQL.
   */
  private async ensureClientExists(clientKey: string): Promise<void> {
    try {
      const existing = await clientRepository.findByKey(clientKey);
      if (!existing) {
        await clientRepository.create({
          clientKey,
          algorithm: 'token_bucket',
          requestsPerSecond: 20,
          burstSize: 40,
          windowSize: 10,
        });
      }
    } catch (_) {
      // In case of concurrency race or mock environment, ignore
    }
  }

  /**
   * Forwards a request to the target API after enforcing rate limits and SSRF checks.
   */
  async forwardRequest(options: ProxyRequestOptions): Promise<ProxyResponseResult> {
    const startTime = performance.now();
    const instanceId = process.env.INSTANCE_ID || 'limiter-01';
    const requestId =
      options.requestId ||
      `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

    const {
      url: rawUrl,
      method = 'GET',
      headers = {},
      body,
      params,
      clientKey = 'demo-client',
    } = options;

    const upperMethod = method.toUpperCase();

    // 1. SSRF Validation
    const ssrfCheck = await validateTargetUrl(rawUrl);
    if (!ssrfCheck.allowed) {
      const errorMsg = ssrfCheck.reason || 'Blocked by SSRF security policy';
      const latencyMs = Number((performance.now() - startTime).toFixed(2));

      const err: any = new Error(errorMsg);
      err.statusCode = 403;
      err.details = {
        decision: 'DENY',
        statusCode: 403,
        statusText: 'Forbidden (SSRF Protection)',
        targetUrl: rawUrl,
        method: upperMethod,
        latencyMs,
        sizeBytes: 0,
        headers: {},
        body: { error: errorMsg },
        rateLimit: {
          algorithm: 'ssrf_guard',
          limit: 0,
          remaining: 0,
          reset: Math.floor(Date.now() / 1000) + 1,
        },
        instanceId,
        requestId,
        error: errorMsg,
      };
      throw err;
    }

    // 2. Auto-provision client if needed
    await this.ensureClientExists(clientKey.trim());

    // 3. Evaluate Rate Limit
    let rateResult: RateLimitResult;
    try {
      rateResult = await rateLimiterService.checkRateLimit(clientKey.trim(), requestId);
    } catch (err: any) {
      if (err.statusCode === 404) {
        // Fallback create client and re-evaluate
        await this.ensureClientExists(clientKey.trim());
        rateResult = await rateLimiterService.checkRateLimit(clientKey.trim(), requestId);
      } else {
        throw err;
      }
    }

    // 4. Handle Rate Limit DENY (429)
    if (rateResult.decision === 'DENY') {
      const latencyMs = Number((performance.now() - startTime).toFixed(2));
      return {
        decision: 'DENY',
        statusCode: 429,
        statusText: 'Too Many Requests',
        targetUrl: rawUrl,
        method: upperMethod,
        latencyMs,
        sizeBytes: 0,
        headers: {
          'x-ratelimit-limit': rateResult.limit.toString(),
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': rateResult.reset.toString(),
          ...(rateResult.retryAfter !== undefined
            ? { 'retry-after': rateResult.retryAfter.toString() }
            : {}),
          'x-instance-id': instanceId,
          'x-request-id': requestId,
        },
        body: {
          error: `Rate limit exceeded for client '${clientKey}'. Request was throttled by the rate limiter gateway.`,
          algorithm: rateResult.algorithm,
          limit: rateResult.limit,
          remaining: 0,
          reset: rateResult.reset,
          retryAfter: rateResult.retryAfter,
        },
        rateLimit: {
          algorithm: rateResult.algorithm,
          limit: rateResult.limit,
          remaining: 0,
          reset: rateResult.reset,
          retryAfter: rateResult.retryAfter,
        },
        instanceId,
        requestId,
        error: `Rate limit exceeded for client '${clientKey}'. Request was throttled by the rate limiter gateway.`,
      };
    }

    // 5. Build Target URL with query params
    const targetUrlObj = new URL(rawUrl.trim());
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        if (k && v !== undefined && v !== null) {
          targetUrlObj.searchParams.set(k, String(v));
        }
      });
    }
    const finalUrl = targetUrlObj.toString();

    // 6. Build Forward Headers
    const forwardHeaders: Record<string, string> = {
      'User-Agent': 'LimiterLab-Gateway/1.0',
      'X-Forwarded-For': '127.0.0.1',
      'X-Forwarded-Client': clientKey,
    };

    if (headers && typeof headers === 'object') {
      Object.entries(headers).forEach(([k, v]) => {
        const lowerKey = k.toLowerCase();
        if (!FORBIDDEN_FORWARD_HEADERS.has(lowerKey) && v !== undefined && v !== null) {
          forwardHeaders[k] = String(v);
        }
      });
    }

    // 7. Prepare Request Body
    let reqBody: string | undefined = undefined;
    if (upperMethod !== 'GET' && upperMethod !== 'HEAD' && body !== undefined && body !== null) {
      if (typeof body === 'string') {
        reqBody = body;
      } else {
        reqBody = JSON.stringify(body);
        if (!forwardHeaders['Content-Type'] && !forwardHeaders['content-type']) {
          forwardHeaders['Content-Type'] = 'application/json';
        }
      }
    }

    // 8. Execute Outbound Fetch Request with 10s Timeout
    const fetchStart = performance.now();
    try {
      const response = await fetch(finalUrl, {
        method: upperMethod,
        headers: forwardHeaders,
        body: reqBody,
        signal: AbortSignal.timeout(10000), // 10 seconds timeout
      });

      const totalLatency = Number((performance.now() - fetchStart).toFixed(2));

      // Extract response headers
      const resHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      // Parse body
      const contentType = response.headers.get('content-type') || '';
      let parsedBody: any;
      let rawText = '';

      try {
        if (contentType.includes('application/json')) {
          parsedBody = await response.json();
          rawText = JSON.stringify(parsedBody);
        } else {
          rawText = await response.text();
          try {
            parsedBody = JSON.parse(rawText);
          } catch (_) {
            parsedBody = rawText;
          }
        }
      } catch (_) {
        parsedBody = await response.text().catch(() => '');
        rawText = String(parsedBody);
      }

      const sizeBytes = rawText ? Buffer.byteLength(rawText, 'utf8') : 0;

      return {
        decision: 'ALLOW',
        statusCode: response.status,
        statusText: response.statusText || (response.ok ? 'OK' : 'Error'),
        targetUrl: finalUrl,
        method: upperMethod,
        latencyMs: totalLatency,
        sizeBytes,
        headers: resHeaders,
        body: parsedBody,
        rateLimit: {
          algorithm: rateResult.algorithm,
          limit: rateResult.limit,
          remaining: rateResult.remaining,
          reset: rateResult.reset,
        },
        instanceId,
        requestId,
      };
    } catch (fetchErr: any) {
      const totalLatency = Number((performance.now() - fetchStart).toFixed(2));
      const errorMsg =
        fetchErr.name === 'TimeoutError'
          ? `Gateway Timeout: Target API did not respond within 10s`
          : `Gateway Network Error: ${fetchErr.message}`;

      return {
        decision: 'ALLOW',
        statusCode: fetchErr.name === 'TimeoutError' ? 504 : 502,
        statusText: fetchErr.name === 'TimeoutError' ? 'Gateway Timeout' : 'Bad Gateway',
        targetUrl: finalUrl,
        method: upperMethod,
        latencyMs: totalLatency,
        sizeBytes: 0,
        headers: {},
        body: { error: errorMsg },
        rateLimit: {
          algorithm: rateResult.algorithm,
          limit: rateResult.limit,
          remaining: rateResult.remaining,
          reset: rateResult.reset,
        },
        instanceId,
        requestId,
        error: errorMsg,
      };
    }
  }
}

export const proxyService = new ProxyService();
