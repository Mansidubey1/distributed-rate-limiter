import { useState, useEffect, useRef } from 'react';
import {
  RequestTemplate,
  ResponseSnapshot,
  HistoryItem,
  ConsoleLogEntry,
  EnvironmentProfile
} from './types/postman';
import {
  Metrics,
  Health,
  Client,
  LiveRequestActivity,
  DashboardEvent
} from './types';
import { defaultCollections, defaultEnvironments } from './data/defaultCollections';
import { Navbar } from './components/Navbar';
import { UnifiedWorkbench, SidebarTab } from './components/UnifiedWorkbench';
import { BurstModal } from './components/postman/BurstModal';
import { EnvironmentModal } from './components/postman/EnvironmentModal';
import { soundFX } from './utils/helpers';

export default function App() {
  // Environments & Collections
  const [environments, setEnvironments] = useState<EnvironmentProfile[]>(defaultEnvironments);
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string>('env-local');
  const [collections] = useState(defaultCollections);

  // Active Request for API Client Workbench
  const [activeRequest, setActiveRequest] = useState<RequestTemplate>(
    defaultCollections[0].folders[0].requests[0]
  );
  const [latestResponse, setLatestResponse] = useState<ResponseSnapshot | null>({
    timestamp: Date.now(),
    status: 200,
    statusText: 'OK',
    latencyMs: 142,
    sizeBytes: 312,
    body: {
      id: 1,
      clientKey: 'mobile-app-client',
      allowed: true,
      remaining: 16,
      limit: 20,
      reset: Math.floor(Date.now() / 1000) + 1,
      algorithm: 'token_bucket',
      message: 'Rate limit check passed successfully'
    },
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-ratelimit-limit': '20',
      'x-ratelimit-remaining': '16',
      'x-ratelimit-reset': `${Math.floor(Date.now() / 1000) + 1}`,
      'x-instance-id': 'limiter-01'
    },
    instanceId: 'limiter-01',
    requestId: 'req-init-200',
    limit: 20,
    remaining: 16,
    reset: Math.floor(Date.now() / 1000) + 1,
    algorithm: 'token_bucket',
    decision: 'ALLOW',
    isProxied: false,
    targetUrl: 'http://localhost:3000/v1/check',
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // History & Console Logs
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([
    {
      id: 'init-1',
      timestamp: Date.now(),
      type: 'info',
      message: 'LimiterLab Gateway initialized. Ready to route requests through distributed rate limiting.',
    },
  ]);

  // Sidebar Mode Tab for API Client
  const [currentSidebarTab, setCurrentSidebarTab] = useState<SidebarTab>('collections');

  // Modals
  const [isBurstModalOpen, setIsBurstModalOpen] = useState<boolean>(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState<boolean>(false);

  // Live Cluster Data
  const [metrics, setMetrics] = useState<Metrics>({
    totalRequests: 0,
    allowedRequests: 0,
    deniedRequests: 0,
    clients: 0,
  });
  const [health, setHealth] = useState<Health | null>({
    status: 'ok',
    database: 'connected',
    instanceId: 'limiter-01',
    services: {
      api: 'healthy',
      postgres: 'healthy',
      redis: 'healthy',
    },
  });
  const [clients, setClients] = useState<Client[]>([
    { clientKey: 'mobile-app-client', algorithm: 'token_bucket', requestsPerSecond: 5, burstSize: 20, windowSize: 10, allowedRequests: 1420, deniedRequests: 12 },
    { clientKey: 'client01', algorithm: 'token_bucket', requestsPerSecond: 10, burstSize: 20, windowSize: 10, allowedRequests: 890, deniedRequests: 145 },
    { clientKey: 'client42', algorithm: 'token_bucket', requestsPerSecond: 5, burstSize: 10, windowSize: 10, allowedRequests: 420, deniedRequests: 95 },
    { clientKey: 'demo-client', algorithm: 'token_bucket', requestsPerSecond: 20, burstSize: 40, windowSize: 10, allowedRequests: 3200, deniedRequests: 40 },
    { clientKey: 'payment-service', algorithm: 'sliding_window', requestsPerSecond: 50, burstSize: 100, windowSize: 10, allowedRequests: 12400, deniedRequests: 120 },
  ]);
  const [rps, setRps] = useState<number>(0);
  const [chartHistory, setChartHistory] = useState<{ allowed: number; denied: number }[]>(
    Array.from({ length: 45 }, () => ({
      allowed: 0,
      denied: 0,
    }))
  );

  // Live Requests Activity Stream
  const [liveRequests, setLiveRequests] = useState<LiveRequestActivity[]>([
    {
      id: 'req-01',
      timestamp: Date.now() - 1000,
      clientKey: 'mobile-app-client',
      endpoint: '/api/v1/checkout',
      method: 'GET',
      status: 200,
      statusText: 'OK',
      latencyMs: 3,
      instanceId: 'limiter-01',
      decision: 'ALLOW',
      remaining: 16,
      limit: 20,
    },
    {
      id: 'req-02',
      timestamp: Date.now() - 3000,
      clientKey: 'client01',
      endpoint: '/api/v1/charge',
      method: 'POST',
      status: 429,
      statusText: 'TOO MANY REQUESTS',
      latencyMs: 1,
      instanceId: 'limiter-01',
      decision: 'DENY',
      remaining: 0,
      limit: 20,
    },
    {
      id: 'req-03',
      timestamp: Date.now() - 5000,
      clientKey: 'client42',
      endpoint: '/api/v1/user',
      method: 'GET',
      status: 200,
      statusText: 'OK',
      latencyMs: 2,
      instanceId: 'limiter-01',
      decision: 'ALLOW',
      remaining: 8,
      limit: 10,
    },
    {
      id: 'req-04',
      timestamp: Date.now() - 8000,
      clientKey: 'demo-client',
      endpoint: '/api/v1/data',
      method: 'POST',
      status: 200,
      statusText: 'OK',
      latencyMs: 4,
      instanceId: 'limiter-01',
      decision: 'ALLOW',
      remaining: 38,
      limit: 40,
    },
  ]);

  // Rate Limit Events Log
  const [events, setEvents] = useState<DashboardEvent[]>([
    {
      id: 'ev-1',
      timestamp: Date.now() - 2000,
      severity: 'ERROR',
      clientKey: 'client01',
      message: 'Token bucket capacity exhausted (0/20 tokens)',
      category: 'THROTTLE',
    },
    {
      id: 'ev-2',
      timestamp: Date.now() - 14000,
      severity: 'WARN',
      clientKey: 'demo-client',
      message: 'Burst threshold reached: 40 RPS capacity',
      category: 'BURST',
    },
    {
      id: 'ev-3',
      timestamp: Date.now() - 28000,
      severity: 'SUCCESS',
      clientKey: 'mobile-app-client',
      message: 'Token bucket refilled (+5 tokens/sec)',
      category: 'REFILL',
    },
    {
      id: 'ev-4',
      timestamp: Date.now() - 60000,
      severity: 'INFO',
      clientKey: 'payment-service',
      message: 'Sliding window quota synchronized across cluster',
      category: 'CLUSTER',
    },
  ]);

  const isInitializedRef = useRef<boolean>(false);
  const prevTotalRef = useRef<number>(0);
  const prevAllowedRef = useRef<number>(0);
  const prevDeniedRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(Date.now());

  // Fetch Live Metrics & Clients from backend
  const fetchData = async () => {
    try {
      // 1. Health
      const healthRes = await fetch('/health');
      if (healthRes.ok) {
        const h: Health = await healthRes.json();
        setHealth(h);
      }

      // 2. Metrics
      const metricsRes = await fetch('/metrics');
      if (metricsRes.ok) {
        const m: Metrics = await metricsRes.json();
        setMetrics(m);

        const now = Date.now();
        const diffSec = (now - prevTimeRef.current) / 1000;
        if (!isInitializedRef.current) {
          prevTotalRef.current = m.totalRequests;
          prevAllowedRef.current = m.allowedRequests;
          prevDeniedRef.current = m.deniedRequests;
          prevTimeRef.current = now;
          isInitializedRef.current = true;
        } else if (diffSec >= 0.8) {
          const reqDiff = Math.max(0, m.totalRequests - prevTotalRef.current);
          const currentRps = Math.round(reqDiff / diffSec);
          setRps(currentRps);

          const allowedDiff = Math.max(0, m.allowedRequests - prevAllowedRef.current);
          const deniedDiff = Math.max(0, m.deniedRequests - prevDeniedRef.current);

          setChartHistory((prev) => [...prev.slice(1), { allowed: allowedDiff, denied: deniedDiff }]);

          prevTotalRef.current = m.totalRequests;
          prevAllowedRef.current = m.allowedRequests;
          prevDeniedRef.current = m.deniedRequests;
          prevTimeRef.current = now;
        }
      }

      // 3. Clients
      const clientsRes = await fetch('/v1/admin/clients');
      if (clientsRes.ok) {
        const c: Client[] = await clientsRes.json();
        if (Array.isArray(c) && c.length > 0) {
          setClients(c);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1200);
    return () => clearInterval(interval);
  }, []);

  // Variable Interpolation (e.g. {{BASE_URL}} -> http://localhost:3000)
  const interpolateVars = (text: string): string => {
    if (!text) return '';
    const activeEnv = environments.find((e) => e.id === activeEnvironmentId);
    if (!activeEnv) return text;

    let result = text;
    activeEnv.variables.forEach((v) => {
      if (v.enabled && v.key) {
        const placeholder = `{{${v.key}}}`;
        result = result.split(placeholder).join(v.value);
      }
    });
    return result;
  };

  // Direct Token Consumption Helper
  const handleConsumeTokenDirect = async (clientKey: string, count: number = 1) => {
    try {
      const targetClient = clients.find((c) => c.clientKey === clientKey) || clients[0];
      const res = await fetch('/v1/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Key': targetClient?.clientKey || clientKey,
        },
        body: JSON.stringify({
          cost: count,
          algorithm: targetClient?.algorithm || 'token_bucket',
          requestsPerSecond: targetClient?.requestsPerSecond || 5,
          burstSize: targetClient?.burstSize || 20,
        }),
      });

      const data = await res.json();
      const status = res.status;
      const isAllow = status === 200 || status === 201;

      if (isAllow) {
        soundFX.playAllow();
      } else {
        soundFX.playDeny();
      }

      const newLog: LiveRequestActivity = {
        id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        timestamp: Date.now(),
        clientKey: targetClient?.clientKey || clientKey,
        endpoint: '/v1/check',
        method: 'POST',
        status,
        statusText: isAllow ? 'OK' : 'TOO MANY REQUESTS',
        latencyMs: Math.floor(Math.random() * 6) + 1,
        instanceId: data.instanceId || 'limiter-01',
        decision: isAllow ? 'ALLOW' : 'DENY',
        remaining: data.remaining,
        limit: data.limit,
      };
      setLiveRequests((prev) => [newLog, ...prev.slice(0, 29)]);

      if (!isAllow) {
        setEvents((prev) => [
          {
            id: `ev-${Date.now()}`,
            timestamp: Date.now(),
            severity: 'ERROR',
            clientKey: targetClient?.clientKey || clientKey,
            message: `Bucket exhausted: 429 Too Many Requests (0 remaining)`,
            category: 'THROTTLE',
          },
          ...prev.slice(0, 40),
        ]);
      }

      fetchData();
      return data;
    } catch (_) {}
  };

  // Execute Request from API Client Workbench
  const handleSendRequest = async () => {
    setIsLoading(true);
    const startTime = performance.now();

    // 1. Resolve URL with query params
    let resolvedUrl = interpolateVars(activeRequest.url);
    const enabledParams = activeRequest.params.filter((p) => p.enabled && p.key);
    if (enabledParams.length > 0) {
      const searchParams = new URLSearchParams();
      enabledParams.forEach((p) => searchParams.append(interpolateVars(p.key), interpolateVars(p.value)));
      resolvedUrl += (resolvedUrl.includes('?') ? '&' : '?') + searchParams.toString();
    }

    // 2. Resolve Headers
    const resolvedHeaders: Record<string, string> = {};
    activeRequest.headers
      .filter((h) => h.enabled && h.key)
      .forEach((h) => {
        resolvedHeaders[h.key] = interpolateVars(h.value);
      });

    // 3. Resolve Client Key
    const finalClientKey = activeRequest.clientKey || 'mobile-app-client';
    if (!resolvedHeaders['X-Client-Key'] && !resolvedHeaders['x-client-key']) {
      resolvedHeaders['X-Client-Key'] = finalClientKey;
    }

    try {
      const isInternalProxy = resolvedUrl.startsWith('http://localhost:3000/v1/proxy') || resolvedUrl.startsWith('/v1/proxy');
      const isInternalCheck = resolvedUrl.startsWith('http://localhost:3000/v1/check') || resolvedUrl.startsWith('/v1/check');

      let res: Response;
      if (isInternalCheck || resolvedUrl.includes('/v1/check')) {
        res = await fetch('/v1/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...resolvedHeaders,
          },
          body: JSON.stringify({
            clientKey: finalClientKey,
            cost: 1,
            algorithm: 'token_bucket',
          }),
        });
      } else if (isInternalProxy || resolvedUrl.startsWith('http://localhost') || resolvedUrl.startsWith('/api') || resolvedUrl.startsWith('/health') || resolvedUrl.startsWith('/metrics')) {
        const fetchUrl = resolvedUrl.startsWith('http://localhost:3000') ? resolvedUrl.replace('http://localhost:3000', '') : resolvedUrl;
        const fetchOptions: RequestInit = {
          method: activeRequest.method,
          headers: resolvedHeaders,
        };
        if (['POST', 'PUT', 'PATCH'].includes(activeRequest.method) && activeRequest.bodyJson) {
          fetchOptions.body = activeRequest.bodyJson;
        }
        res = await fetch(fetchUrl, fetchOptions);
      } else {
        // External Proxy Request
        let parsedPayloadBody: any = undefined;
        if (activeRequest.bodyJson && activeRequest.bodyJson.trim()) {
          try {
            parsedPayloadBody = JSON.parse(activeRequest.bodyJson);
          } catch (_) {
            parsedPayloadBody = activeRequest.bodyJson;
          }
        }

        res = await fetch('/v1/proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Key': finalClientKey,
            ...resolvedHeaders,
          },
          body: JSON.stringify({
            url: resolvedUrl,
            targetUrl: resolvedUrl,
            method: activeRequest.method,
            headers: resolvedHeaders,
            clientKey: finalClientKey,
            body: parsedPayloadBody,
          }),
        });
      }

      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      let bodyData: any = {};
      const responseContentType = res.headers.get('content-type') || '';
      if (responseContentType.includes('application/json')) {
        bodyData = await res.json();
      } else {
        bodyData = await res.text();
      }

      const rawHeaders: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        rawHeaders[key] = val;
      });

      // If response came from our /v1/proxy gateway, extract the target API's body & headers
      const isProxyEnvelope = bodyData && typeof bodyData === 'object' && ('targetUrl' in bodyData || 'rateLimit' in bodyData);
      const finalBody = isProxyEnvelope && bodyData.body !== undefined ? bodyData.body : bodyData;
      const finalHeaders = isProxyEnvelope && bodyData.headers && Object.keys(bodyData.headers).length > 0 ? bodyData.headers : rawHeaders;
      const finalStatus = isProxyEnvelope && typeof bodyData.statusCode === 'number' ? bodyData.statusCode : res.status;
      const finalStatusText = isProxyEnvelope && bodyData.statusText ? bodyData.statusText : res.statusText || (finalStatus < 400 ? 'OK' : 'Error');
      const isAllowed = finalStatus < 400 || finalStatus === 404;

      if (isAllowed) {
        soundFX.playAllow();
      } else {
        soundFX.playDeny();
      }

      const limitVal = isProxyEnvelope && bodyData.rateLimit?.limit !== undefined
        ? bodyData.rateLimit.limit
        : parseInt(rawHeaders['x-ratelimit-limit'] || '20', 10);
      const remainingVal = isProxyEnvelope && bodyData.rateLimit?.remaining !== undefined
        ? bodyData.rateLimit.remaining
        : parseInt(rawHeaders['x-ratelimit-remaining'] || (isAllowed ? '16' : '0'), 10);
      const resetVal = isProxyEnvelope && bodyData.rateLimit?.reset !== undefined
        ? bodyData.rateLimit.reset
        : parseInt(rawHeaders['x-ratelimit-reset'] || `${Math.floor(Date.now() / 1000) + 1}`, 10);
      const instanceVal = (isProxyEnvelope && bodyData.instanceId) || rawHeaders['x-instance-id'] || health?.instanceId || 'limiter-01';
      const actualLatency = isProxyEnvelope && typeof bodyData.latencyMs === 'number' ? Math.round(bodyData.latencyMs) : latencyMs;
      const actualSizeBytes = isProxyEnvelope && typeof bodyData.sizeBytes === 'number'
        ? bodyData.sizeBytes
        : (typeof finalBody === 'string' ? finalBody.length : JSON.stringify(finalBody).length);

      const snapshot: ResponseSnapshot = {
        timestamp: Date.now(),
        status: finalStatus,
        statusText: finalStatusText,
        latencyMs: actualLatency,
        sizeBytes: actualSizeBytes,
        body: finalBody,
        headers: finalHeaders,
        instanceId: instanceVal,
        requestId: (isProxyEnvelope && bodyData.requestId) || `req-${Date.now()}`,
        limit: limitVal,
        remaining: remainingVal,
        reset: resetVal,
        algorithm: (isProxyEnvelope && bodyData.rateLimit?.algorithm) || 'token_bucket',
        decision: isAllowed ? 'ALLOW' : 'DENY',
        isProxied: true,
        targetUrl: resolvedUrl,
      };

      setLatestResponse(snapshot);

      // Add to History
      const histItem: HistoryItem = {
        id: `hist-${Date.now()}`,
        timestamp: Date.now(),
        method: activeRequest.method,
        url: resolvedUrl,
        clientKey: finalClientKey,
        status: res.status,
        latencyMs,
        decision: isAllowed ? 'ALLOW' : 'DENY',
        request: { ...activeRequest },
        response: snapshot,
      };
      setHistory((prev) => [histItem, ...prev.slice(0, 49)]);

      // Add to Live Requests Activity
      const newLiveReq: LiveRequestActivity = {
        id: `act-${Date.now()}`,
        timestamp: Date.now(),
        clientKey: finalClientKey,
        endpoint: resolvedUrl.replace(/^https?:\/\/[^/]+/, ''),
        method: activeRequest.method,
        status: res.status,
        statusText: snapshot.statusText,
        latencyMs,
        instanceId: instanceVal,
        decision: isAllowed ? 'ALLOW' : 'DENY',
        remaining: remainingVal,
        limit: limitVal,
      };
      setLiveRequests((prev) => [newLiveReq, ...prev.slice(0, 29)]);

      // Add to Rate Limit Events if throttled
      if (!isAllowed) {
        setEvents((prev) => [
          {
            id: `ev-${Date.now()}`,
            timestamp: Date.now(),
            severity: 'ERROR',
            clientKey: finalClientKey,
            message: `Rate limit throttled (HTTP 429) for ${finalClientKey}`,
            category: 'THROTTLE',
          },
          ...prev.slice(0, 39),
        ]);
      }

      // Add to Console Log
      setConsoleLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          type: isAllowed ? 'response' : 'error',
          message: `[${activeRequest.method}] ${resolvedUrl} -> ${res.status} ${snapshot.statusText} (${latencyMs}ms) [Tokens: ${remainingVal}/${limitVal}]`,
        },
        ...prev,
      ]);

      fetchData();
    } catch (err: any) {
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);
      soundFX.playDeny();

      const errorSnapshot: ResponseSnapshot = {
        timestamp: Date.now(),
        status: 500,
        statusText: 'Gateway Error',
        latencyMs,
        sizeBytes: 0,
        body: { error: err.message || 'Request failed to execute' },
        headers: {},
        instanceId: 'limiter-01',
        requestId: `req-err-${Date.now()}`,
        limit: 20,
        remaining: 0,
        reset: Math.floor(Date.now() / 1000) + 1,
        algorithm: 'token_bucket',
        decision: 'DENY',
        isProxied: false,
        targetUrl: resolvedUrl,
      };

      setLatestResponse(errorSnapshot);
      setConsoleLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          type: 'error',
          message: `Request failed: ${err.message}`,
        },
        ...prev,
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Select Request from Collections
  const handleSelectRequest = (req: RequestTemplate) => {
    setActiveRequest({ ...req });
  };

  // Select Request from History
  const handleSelectHistory = (item: HistoryItem) => {
    setActiveRequest({ ...item.request });
    setLatestResponse({ ...item.response });
  };

  // Create New Empty Request
  const handleNewRequest = () => {
    const newReq: RequestTemplate = {
      id: `req-${Date.now()}`,
      name: 'Custom Target API Request',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      clientKey: 'mobile-app-client',
      headers: [{ id: 'h1', key: 'Accept', value: 'application/json', enabled: true }],
      params: [],
      bodyType: 'none',
      bodyJson: '',
      authType: 'none',
    };
    setActiveRequest(newReq);
    const workbenchEl = document.getElementById('workbench');
    if (workbenchEl) {
      workbenchEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const targetClientKey = activeRequest.clientKey || 'mobile-app-client';

  const resolvedHeadersForBurst: Record<string, string> = {};
  activeRequest.headers
    .filter((h) => h.enabled && h.key)
    .forEach((h) => {
      resolvedHeadersForBurst[h.key] = interpolateVars(h.value);
    });

  return (
    <div className="app-root" style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* 1. Global Navigation Bar with Section Anchors */}
      <Navbar
        health={health}
        onRefresh={fetchData}
        onOpenBurstModal={() => setIsBurstModalOpen(true)}
        onOpenEnvModal={() => setIsEnvModalOpen(true)}
        eventCount={events.length}
      />

      {/* 2. Main Unified Single Page Container */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#0D0D0F' }}>
        <UnifiedWorkbench
          metrics={metrics}
          health={health}
          clients={clients}
          rps={rps}
          chartHistory={chartHistory}
          liveRequests={liveRequests}
          events={events}
          collections={collections}
          history={history}
          activeRequest={activeRequest}
          onChangeRequest={setActiveRequest}
          onSendRequest={handleSendRequest}
          onSelectRequest={handleSelectRequest}
          onSelectHistory={handleSelectHistory}
          onClearHistory={() => setHistory([])}
          onNewRequest={handleNewRequest}
          currentSidebarTab={currentSidebarTab}
          onSelectSidebarTab={setCurrentSidebarTab}
          isLoading={isLoading}
          latestResponse={latestResponse}
          onOpenBurst={() => setIsBurstModalOpen(true)}
          onOpenEnvModal={() => setIsEnvModalOpen(true)}
          onConsumeTokenDirect={handleConsumeTokenDirect}
          onSendTestRequest={async (clientKey: string) => {
            await handleConsumeTokenDirect(clientKey, 1);
          }}
          onClearEvents={() => setEvents([])}
          onRefreshData={fetchData}
          consoleLogs={consoleLogs}
          onClearConsoleLogs={() => setConsoleLogs([])}
        />
      </main>

      {/* =========================================================================
          MODALS
          ========================================================================= */}
      {/* 1. Burst Stress Runner Modal */}
      <BurstModal
        isOpen={isBurstModalOpen}
        onClose={() => setIsBurstModalOpen(false)}
        targetUrl={interpolateVars(activeRequest.url)}
        method={activeRequest.method}
        targetClientKey={targetClientKey}
        headers={resolvedHeadersForBurst}
        bodyJson={activeRequest.bodyJson}
        onBurstComplete={(summary) => {
          setConsoleLogs((prev) => [
            {
              id: `log-${Date.now()}`,
              timestamp: Date.now(),
              type: 'info',
              message: `Burst Completed: ${summary.total} reqs in ${summary.durationSec}s (${summary.allowed} ALLOW, ${summary.denied} 429) | Throughput: ${summary.rps} RPS | P50: ${summary.p50Latency}ms | P95: ${summary.p95Latency}ms | P99: ${summary.p99Latency}ms`,
            },
            ...prev,
          ]);
          fetchData();
        }}
      />

      {/* 2. Environment Variable Manager Modal */}
      <EnvironmentModal
        isOpen={isEnvModalOpen}
        onClose={() => setIsEnvModalOpen(false)}
        environments={environments}
        activeEnvironmentId={activeEnvironmentId}
        onUpdateEnvironments={(updated) => {
          setEnvironments(updated);
          if (!updated.some((e) => e.id === activeEnvironmentId) && updated.length > 0) {
            setActiveEnvironmentId(updated[0].id);
          }
        }}
      />
    </div>
  );
}
