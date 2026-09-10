import React, { useState, useEffect, useRef } from 'react';
import {
  RequestTemplate,
  ResponseSnapshot,
  HistoryItem,
  ConsoleLogEntry,
  EnvironmentProfile,
  WorkspaceMode
} from './types/postman';
import {
  Metrics,
  Health,
  Client,
  LiveRequestActivity,
  DashboardEvent,
  RequestTrace,
  HeaderSnapshot,
  SystemEvent
} from './types';
import { defaultCollections, defaultEnvironments } from './data/defaultCollections';
import { DashboardOverview } from './components/DashboardOverview';
import { PostmanHeader } from './components/postman/PostmanHeader';
import { PostmanSidebar, SidebarTab } from './components/postman/PostmanSidebar';
import { RequestBuilder } from './components/postman/RequestBuilder';
import { ResponseViewer } from './components/postman/ResponseViewer';
import { BurstModal } from './components/postman/BurstModal';
import { VisualizeModal } from './components/postman/VisualizeModal';
import { EnvironmentModal } from './components/postman/EnvironmentModal';
import { PostmanConsole } from './components/postman/PostmanConsole';
import { PolicyManager } from './components/PolicyManager';
import { BenchmarkLab } from './components/BenchmarkLab';
import { RequestTracing } from './components/RequestTracing';
import { HeaderInspector } from './components/HeaderInspector';
import { TrafficSimulator } from './components/TrafficSimulator';
import { InstanceTelemetry } from './components/InstanceTelemetry';
import { ChaosLab } from './components/ChaosLab';
import { AlgorithmVisualizer } from './components/AlgorithmVisualizer';
import { ApiIntegrationHub } from './components/ApiIntegrationHub';
import { SystemEventStream } from './components/SystemEventStream';
import { TelemetryOverview } from './components/TelemetryOverview';
import { soundFX } from './utils/helpers';
import { Flame, Radio, Search, Zap, Server, Sparkles, BookOpen, Activity, Code2, Sliders, X, Plus } from 'lucide-react';

export default function App() {
  // 1. Primary Pillar Navigation: 'dashboard' (Observability) is default!
  const [mainTab, setMainTab] = useState<string>('dashboard');

  // Secondary sub-tab selections for Analytics & Infrastructure
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'benchmark' | 'tracing' | 'headers' | 'traffic'>('benchmark');
  const [infraSubTab, setInfraSubTab] = useState<'telemetry' | 'chaos' | 'algorithms' | 'telemetry_overview' | 'code' | 'events'>('telemetry');

  // Environments & Collections
  const [environments, setEnvironments] = useState<EnvironmentProfile[]>(defaultEnvironments);
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string>('env-local');
  const [collections] = useState(defaultCollections);

  // Postman Workspace Mode: 'request' | 'response'
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('request');

  // Active Request
  const [activeRequest, setActiveRequest] = useState<RequestTemplate>(
    defaultCollections[0].folders[0].requests[0]
  );
  const [latestResponse, setLatestResponse] = useState<ResponseSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // History & Console Logs
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([
    {
      id: 'init-1',
      timestamp: Date.now(),
      type: 'info',
      message: 'LimiterLab API Gateway initialized. Ready to route requests through distributed rate limiting.',
    },
  ]);

  // Sidebar Mode Tab for API Client
  const [currentSidebarTab, setCurrentSidebarTab] = useState<SidebarTab>('collections');

  // Modals
  const [isBurstModalOpen, setIsBurstModalOpen] = useState<boolean>(false);
  const [isVisualizeModalOpen, setIsVisualizeModalOpen] = useState<boolean>(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState<boolean>(false);
  const [isCreatePolicyModalOpen, setIsCreatePolicyModalOpen] = useState<boolean>(false);

  // New Policy Form State
  const [newClientKey, setNewClientKey] = useState<string>('');
  const [newAlgorithm, setNewAlgorithm] = useState<'token_bucket' | 'sliding_window'>('token_bucket');
  const [newRps, setNewRps] = useState<number>(10);
  const [newBurstSize, setNewBurstSize] = useState<number>(20);
  const [newWindowSize, setNewWindowSize] = useState<number>(10);

  // Live Cluster Data
  const [metrics, setMetrics] = useState<Metrics>({
    totalRequests: 27564,
    allowedRequests: 26821,
    deniedRequests: 743,
    clients: 42,
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
    { clientKey: 'client01', algorithm: 'token_bucket', requestsPerSecond: 5, burstSize: 10, windowSize: 10, allowedRequests: 1420, deniedRequests: 12 },
    { clientKey: 'client42', algorithm: 'token_bucket', requestsPerSecond: 10, burstSize: 20, windowSize: 10, allowedRequests: 890, deniedRequests: 145 },
    { clientKey: 'demo', algorithm: 'token_bucket', requestsPerSecond: 20, burstSize: 40, windowSize: 10, allowedRequests: 3200, deniedRequests: 40 },
    { clientKey: 'mobile-app', algorithm: 'sliding_window', requestsPerSecond: 15, burstSize: 30, windowSize: 10, allowedRequests: 2150, deniedRequests: 80 },
    { clientKey: 'payment-svc', algorithm: 'token_bucket', requestsPerSecond: 50, burstSize: 100, windowSize: 10, allowedRequests: 12400, deniedRequests: 120 },
  ]);
  const [rps, setRps] = useState<number>(482);
  const [chartHistory, setChartHistory] = useState<{ allowed: number; denied: number }[]>(
    Array.from({ length: 45 }, (_, i) => ({
      allowed: Math.floor(420 + Math.sin(i * 0.4) * 60 + (i % 3 === 0 ? 30 : -20)),
      denied: Math.floor(18 + Math.cos(i * 0.3) * 8 + (i % 7 === 0 ? 25 : 0)),
    }))
  );

  // Live Dashboard Request Stream
  const [liveRequests, setLiveRequests] = useState<LiveRequestActivity[]>([
    { id: 'r1', timestamp: Date.now() - 400, clientKey: 'client01', endpoint: '/v1/check', method: 'POST', status: 200, statusText: 'OK', latencyMs: 8, instanceId: 'limiter-01', decision: 'ALLOW' },
    { id: 'r2', timestamp: Date.now() - 1200, clientKey: 'client42', endpoint: '/v1/check', method: 'POST', status: 429, statusText: 'Too Many Requests', latencyMs: 2, instanceId: 'limiter-01', decision: 'DENY' },
    { id: 'r3', timestamp: Date.now() - 2500, clientKey: 'demo', endpoint: '/v1/proxy', method: 'POST', status: 200, statusText: 'OK', latencyMs: 31, instanceId: 'limiter-01', decision: 'ALLOW' },
    { id: 'r4', timestamp: Date.now() - 3800, clientKey: 'mobile-app', endpoint: '/v1/check', method: 'POST', status: 200, statusText: 'OK', latencyMs: 6, instanceId: 'limiter-01', decision: 'ALLOW' },
    { id: 'r5', timestamp: Date.now() - 5200, clientKey: 'client17', endpoint: '/v1/check', method: 'POST', status: 429, statusText: 'Too Many Requests', latencyMs: 1, instanceId: 'limiter-01', decision: 'DENY' },
  ]);

  // Live Dashboard Rate Limit Events
  const [dashboardEvents, setDashboardEvents] = useState<DashboardEvent[]>([
    { id: 'e1', timestamp: Date.now() - 2000, severity: 'ERROR', clientKey: 'client42', message: 'client42 exceeded limit (0 tokens remaining)' },
    { id: 'e2', timestamp: Date.now() - 14000, severity: 'WARN', clientKey: 'client17', message: 'client17 burst limit exceeded (20/20 capacity)' },
    { id: 'e3', timestamp: Date.now() - 28000, severity: 'SUCCESS', clientKey: 'client05', message: 'client05 bucket refilled (+5 tokens via continuous Lua engine)' },
    { id: 'e4', timestamp: Date.now() - 60000, severity: 'INFO', clientKey: 'mobile-app', message: 'Redis Lua token state synchronized across cluster' },
    { id: 'e5', timestamp: Date.now() - 180000, severity: 'INFO', clientKey: 'payment-svc', message: 'Policy active: 50 RPS / 100 burst' },
  ]);

  // Analytics & Traces state
  const [traces, setTraces] = useState<RequestTrace[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<HeaderSnapshot | null>(null);
  const [snapshots, setSnapshots] = useState<HeaderSnapshot[]>([]);
  const [systemEvents, setSystemEvents] = useState<SystemEvent[]>([]);

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
        if (diffSec >= 1 && prevTotalRef.current > 0) {
          const reqDiff = Math.max(0, m.totalRequests - prevTotalRef.current);
          const currentRps = Math.round(reqDiff / diffSec);
          if (currentRps > 0) setRps(currentRps);

          const allowedDiff = Math.max(0, m.allowedRequests - prevAllowedRef.current);
          const deniedDiff = Math.max(0, m.deniedRequests - prevDeniedRef.current);

          setChartHistory((prev) => [...prev.slice(1), { allowed: allowedDiff, denied: deniedDiff }]);

          prevTotalRef.current = m.totalRequests;
          prevAllowedRef.current = m.allowedRequests;
          prevDeniedRef.current = m.deniedRequests;
          prevTimeRef.current = now;
        } else if (prevTotalRef.current === 0) {
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

  // Extract clientKey from request, body JSON, or URL
  const extractClientKey = (req: RequestTemplate): string => {
    if (req.clientKey && req.clientKey.trim()) {
      return req.clientKey.trim();
    }
    try {
      const parsed = JSON.parse(interpolateVars(req.bodyJson));
      if (parsed.clientKey) return parsed.clientKey;
    } catch (_) {}
    if (req.url.includes('/clients/')) {
      const parts = req.url.split('/clients/');
      return parts[1]?.split('/')[0] || 'client01';
    }
    return clients[0]?.clientKey || 'client01';
  };

  const targetClientKey = extractClientKey(activeRequest);
  const activeClient = clients.find((c) => c.clientKey === targetClientKey) || clients[0] || null;

  // Record a live activity request into state
  const recordLiveActivity = (activity: LiveRequestActivity) => {
    setLiveRequests((prev) => [activity, ...prev].slice(0, 50));
    if (activity.status === 429) {
      const newEv: DashboardEvent = {
        id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        severity: 'ERROR',
        clientKey: activity.clientKey,
        message: `${activity.clientKey} exceeded rate limit (429 Too Many Requests)`,
      };
      setDashboardEvents((prev) => [newEv, ...prev].slice(0, 100));
    }
  };

  // Execute Request (SEND button in Postman / API Client)
  const handleSendRequest = async () => {
    setIsLoading(true);
    const resolvedUrl = interpolateVars(activeRequest.url);
    const resolvedBodyStr =
      activeRequest.bodyType === 'json' && activeRequest.method !== 'GET' && activeRequest.bodyJson.trim()
        ? interpolateVars(activeRequest.bodyJson)
        : undefined;

    const resolvedHeaders: Record<string, string> = {};
    activeRequest.headers
      .filter((h) => h.enabled && h.key)
      .forEach((h) => {
        resolvedHeaders[h.key] = interpolateVars(h.value);
      });

    if (activeRequest.authType === 'bearer' && activeRequest.bearerToken) {
      resolvedHeaders['Authorization'] = `Bearer ${interpolateVars(activeRequest.bearerToken)}`;
    } else if (activeRequest.authType === 'apikey' && activeRequest.apiKeyName && activeRequest.apiKeyValue) {
      resolvedHeaders[activeRequest.apiKeyName] = interpolateVars(activeRequest.apiKeyValue);
    }

    const startMs = performance.now();
    const isExternalUrl =
      (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) &&
      !resolvedUrl.includes('localhost:3000/v1/check') &&
      !resolvedUrl.includes('localhost:3000/health') &&
      !resolvedUrl.includes('localhost:3000/metrics') &&
      !resolvedUrl.includes('localhost:3000/v1/admin');

    try {
      let snapshot: ResponseSnapshot;

      if (isExternalUrl) {
        let parsedBody: any = undefined;
        if (resolvedBodyStr) {
          try {
            parsedBody = JSON.parse(resolvedBodyStr);
          } catch (_) {
            parsedBody = resolvedBodyStr;
          }
        }

        const paramMap: Record<string, string> = {};
        activeRequest.params
          .filter((p) => p.enabled && p.key)
          .forEach((p) => {
            paramMap[p.key] = interpolateVars(p.value);
          });

        const proxyPayload = {
          url: resolvedUrl,
          method: activeRequest.method,
          headers: resolvedHeaders,
          body: parsedBody,
          params: paramMap,
          clientKey: targetClientKey,
        };

        const res = await fetch('/v1/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proxyPayload),
        });

        const latencyMs = Number((performance.now() - startMs).toFixed(2));
        const data = await res.json().catch(() => ({}));

        const isAllow = data.decision === 'ALLOW' || res.status === 200 || res.status === 201;
        if (isAllow) soundFX.playAllow();
        else soundFX.playDeny();

        snapshot = {
          timestamp: Date.now(),
          status: data.statusCode || res.status,
          statusText: data.statusText || res.statusText || (isAllow ? 'OK' : 'Too Many Requests'),
          latencyMs: data.latencyMs || latencyMs,
          sizeBytes: data.sizeBytes || JSON.stringify(data.body || {}).length,
          body: data.body !== undefined ? data.body : data,
          headers: data.headers || {},
          instanceId: data.instanceId || res.headers.get('x-instance-id') || 'limiter-01',
          requestId: data.requestId || res.headers.get('x-request-id') || `req-${Date.now().toString(36)}`,
          limit: data.rateLimit?.limit || 20,
          remaining: data.rateLimit?.remaining ?? 0,
          reset: data.rateLimit?.reset || Math.floor(Date.now() / 1000) + 1,
          retryAfter: data.rateLimit?.retryAfter,
          algorithm: data.rateLimit?.algorithm || activeClient?.algorithm || 'token_bucket',
          decision: (data.decision || (isAllow ? 'ALLOW' : 'DENY')) as 'ALLOW' | 'DENY',
          isProxied: true,
          targetUrl: data.targetUrl || resolvedUrl,
          error: data.error,
        };
      } else {
        const res = await fetch(resolvedUrl, {
          method: activeRequest.method,
          headers: resolvedHeaders,
          body: resolvedBodyStr,
        });

        const latencyMs = Number((performance.now() - startMs).toFixed(2));
        const resHeaders: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          resHeaders[k] = v;
        });

        const bodyData = await res.json().catch(() => ({}));
        const sizeBytes = JSON.stringify(bodyData).length + 120;
        const isAllow = res.status === 200 || res.status === 201;

        if (isAllow) soundFX.playAllow();
        else soundFX.playDeny();

        const limit = Number(res.headers.get('x-ratelimit-limit') || bodyData.limit || 20);
        const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? bodyData.remaining ?? 0);
        const reset = Number(
          res.headers.get('x-ratelimit-reset') || bodyData.reset || Math.floor(Date.now() / 1000) + 1
        );
        const retryAfter = res.headers.get('retry-after')
          ? Number(res.headers.get('retry-after'))
          : bodyData.retryAfter;

        snapshot = {
          timestamp: Date.now(),
          status: res.status,
          statusText: res.statusText || (isAllow ? 'OK' : 'Too Many Requests'),
          latencyMs,
          sizeBytes,
          body: bodyData,
          headers: resHeaders,
          instanceId: res.headers.get('x-instance-id') || bodyData.instanceId || 'limiter-01',
          requestId: res.headers.get('x-request-id') || bodyData.requestId || `req-${Date.now().toString(36)}`,
          limit,
          remaining,
          reset,
          retryAfter,
          algorithm: bodyData.algorithm || activeClient?.algorithm || 'token_bucket',
          decision: isAllow ? 'ALLOW' : 'DENY',
          isProxied: false,
          targetUrl: resolvedUrl,
        };
      }

      setLatestResponse(snapshot);
      setWorkspaceMode('response');

      // Record History
      const historyItem: HistoryItem = {
        id: `hist-${Date.now()}`,
        timestamp: Date.now(),
        method: activeRequest.method,
        url: snapshot.targetUrl || activeRequest.url,
        clientKey: targetClientKey,
        status: snapshot.status,
        latencyMs: snapshot.latencyMs,
        decision: snapshot.decision || 'ALLOW',
        request: { ...activeRequest },
        response: snapshot,
      };
      setHistory((prev) => [historyItem, ...prev].slice(0, 50));

      // Record to Live Request Stream
      recordLiveActivity({
        id: `act-${Date.now()}`,
        timestamp: Date.now(),
        clientKey: targetClientKey,
        endpoint: snapshot.targetUrl?.replace('http://localhost:3000', '') || '/v1/check',
        method: activeRequest.method,
        status: snapshot.status,
        statusText: snapshot.statusText,
        latencyMs: snapshot.latencyMs,
        instanceId: snapshot.instanceId,
        decision: (snapshot.decision || (snapshot.status === 200 || snapshot.status === 201 ? 'ALLOW' : 'DENY')) as 'ALLOW' | 'DENY',
        remaining: snapshot.remaining,
        limit: snapshot.limit,
      });

      // Append to Console Log
      const logEntry: ConsoleLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        type: 'response',
        method: activeRequest.method,
        url: snapshot.targetUrl || resolvedUrl,
        status: snapshot.status,
        statusText: snapshot.statusText,
        latencyMs: snapshot.latencyMs,
        instanceId: snapshot.instanceId,
        remaining: snapshot.remaining,
        limit: snapshot.limit,
        message: `${activeRequest.method} ${snapshot.targetUrl || resolvedUrl} → ${snapshot.status} ${snapshot.statusText} (${snapshot.latencyMs}ms) [Decision: ${snapshot.decision}]`,
      };
      setConsoleLogs((prev) => [logEntry, ...prev].slice(0, 100));

      fetchData();
    } catch (err: any) {
      const latencyMs = Number((performance.now() - startMs).toFixed(2));
      const errorSnapshot: ResponseSnapshot = {
        timestamp: Date.now(),
        status: 500,
        statusText: 'Gateway Error',
        latencyMs,
        sizeBytes: 0,
        body: { error: err.message || 'Failed to dispatch request through gateway' },
        headers: {},
        instanceId: 'limiter-01',
        requestId: 'err',
        limit: 20,
        remaining: 0,
        reset: Math.floor(Date.now() / 1000) + 1,
        decision: 'DENY',
        targetUrl: resolvedUrl,
        error: err.message,
      };
      setLatestResponse(errorSnapshot);
      setWorkspaceMode('response');
    } finally {
      setIsLoading(false);
    }
  };

  // Direct test request helper (for Dashboard buttons)
  const handleSendTestRequest = async (clientKey: string, endpoint: string = '/v1/check') => {
    const start = performance.now();
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-key': clientKey,
        },
        body: JSON.stringify({ clientKey }),
      });
      const latencyMs = Number((performance.now() - start).toFixed(1));
      const data = await res.json().catch(() => ({}));
      const isAllow = res.status === 200 || res.status === 201;

      recordLiveActivity({
        id: `test-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        timestamp: Date.now(),
        clientKey,
        endpoint,
        method: 'POST',
        status: res.status,
        statusText: isAllow ? 'OK' : 'Too Many Requests',
        latencyMs,
        instanceId: 'limiter-01',
        decision: isAllow ? 'ALLOW' : 'DENY',
        remaining: data.remaining,
        limit: data.limit,
      });

      fetchData();
      return data;
    } catch (_) {
      const latencyMs = Number((performance.now() - start).toFixed(1));
      recordLiveActivity({
        id: `test-${Date.now()}`,
        timestamp: Date.now(),
        clientKey,
        endpoint,
        method: 'POST',
        status: 200,
        statusText: 'OK (Local Math)',
        latencyMs: latencyMs || 8,
        instanceId: 'limiter-01',
        decision: 'ALLOW',
      });
    }
  };

  // Handle Policy Creation
  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientKey.trim()) return;

    try {
      const payload = {
        clientKey: newClientKey.trim(),
        algorithm: newAlgorithm,
        requestsPerSecond: Number(newRps),
        burstSize: newAlgorithm === 'token_bucket' ? Number(newBurstSize) : Number(newRps),
        windowSize: newAlgorithm === 'sliding_window' ? Number(newWindowSize) : 1.0,
      };

      await fetch('/v1/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Update local state
      setClients((prev) => [
        {
          clientKey: newClientKey.trim(),
          algorithm: newAlgorithm,
          requestsPerSecond: Number(newRps),
          burstSize: Number(newBurstSize),
          windowSize: Number(newWindowSize),
          allowedRequests: 0,
          deniedRequests: 0,
        },
        ...prev.filter((c) => c.clientKey !== newClientKey.trim()),
      ]);

      const newEv: DashboardEvent = {
        id: `ev-${Date.now()}`,
        timestamp: Date.now(),
        severity: 'SUCCESS',
        clientKey: newClientKey.trim(),
        message: `New rate policy created for ${newClientKey.trim()} (${newAlgorithm === 'token_bucket' ? 'Token Bucket' : 'Sliding Window'})`,
      };
      setDashboardEvents((prev) => [newEv, ...prev]);

      setIsCreatePolicyModalOpen(false);
      setNewClientKey('');
      soundFX.playAllow();
      fetchData();
    } catch (_) {
      setIsCreatePolicyModalOpen(false);
    }
  };

  // Select Request from Collection
  const handleSelectRequest = (req: RequestTemplate) => {
    setActiveRequest({ ...req });
    setWorkspaceMode('request');
    setCurrentSidebarTab('collections');
  };

  // Select Request from History
  const handleSelectHistory = (item: HistoryItem) => {
    setActiveRequest({ ...item.request });
    setLatestResponse({ ...item.response });
    setWorkspaceMode('response');
    setCurrentSidebarTab('collections');
  };

  // Create New Empty Request
  const handleNewRequest = () => {
    const newReq: RequestTemplate = {
      id: `req-${Date.now()}`,
      name: 'Custom Target API Request',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      clientKey: 'client01',
      headers: [{ id: 'h1', key: 'Accept', value: 'application/json', enabled: true }],
      params: [],
      bodyType: 'none',
      bodyJson: '',
      authType: 'none',
    };
    setActiveRequest(newReq);
    setWorkspaceMode('request');
    setCurrentSidebarTab('collections');
  };

  const resolvedHeadersForBurst: Record<string, string> = {};
  activeRequest.headers
    .filter((h) => h.enabled && h.key)
    .forEach((h) => {
      resolvedHeadersForBurst[h.key] = interpolateVars(h.value);
    });

  return (
    <div className="app-root">
      {/* 1. Global Product Header with 5 Pillar Tabs */}
      <PostmanHeader
        currentTab={mainTab}
        onSelectTab={setMainTab}
        environments={environments}
        activeEnvironmentId={activeEnvironmentId}
        onSelectEnvironment={setActiveEnvironmentId}
        onOpenEnvironmentModal={() => setIsEnvModalOpen(true)}
        health={health}
        onOpenChaosModal={() => {
          setMainTab('infrastructure');
          setInfraSubTab('chaos');
        }}
        onOpenCreatePolicyModal={() => setIsCreatePolicyModalOpen(true)}
      />

      {/* 2. Main Content Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* =========================================================================
            PILLAR 1: DASHBOARD (Observability - The Default Screen)
            ========================================================================= */}
        {mainTab === 'dashboard' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <DashboardOverview
              metrics={metrics}
              health={health}
              clients={clients}
              rps={rps}
              chartHistory={chartHistory}
              liveRequests={liveRequests}
              events={dashboardEvents}
              onNavigateToTab={(tab) => {
                if (tab === 'apiclient') setMainTab('apiclient');
                else if (tab === 'policies') setMainTab('policies');
                else if (tab === 'analytics') setMainTab('analytics');
                else if (tab === 'infrastructure') setMainTab('infrastructure');
                else if (tab === 'simulator') {
                  setMainTab('analytics');
                  setAnalyticsSubTab('traffic');
                }
              }}
              onSelectClientForPostman={(key) => {
                setActiveRequest((prev) => ({ ...prev, clientKey: key }));
                setMainTab('apiclient');
              }}
              onSendTestRequest={handleSendTestRequest}
              onClearEvents={() => setDashboardEvents([])}
              onRefreshData={fetchData}
            />
          </div>
        )}

        {/* =========================================================================
            PILLAR 2: API CLIENT (Postman-Style Testing Workbench)
            ========================================================================= */}
        {mainTab === 'apiclient' && (
          <div className="pm-main-body" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Postman Left Sidebar */}
            <PostmanSidebar
              collections={collections}
              history={history}
              activeRequestId={activeRequest.id}
              onSelectRequest={handleSelectRequest}
              onSelectHistory={handleSelectHistory}
              onClearHistory={() => setHistory([])}
              currentSidebarTab={currentSidebarTab}
              onSelectSidebarTab={setCurrentSidebarTab}
              onNewRequest={handleNewRequest}
            />

            {/* Postman Main Center Content */}
            <div className="pm-content">
              {(currentSidebarTab === 'collections' || currentSidebarTab === 'history') && (
                <div className="pm-workspace-wrapper" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  {workspaceMode === 'request' ? (
                    <RequestBuilder
                      request={activeRequest}
                      onChangeRequest={setActiveRequest}
                      onSend={handleSendRequest}
                      onOpenBurst={() => setIsBurstModalOpen(true)}
                      onOpenVisualize={() => setIsVisualizeModalOpen(true)}
                      isLoading={isLoading}
                      clients={clients}
                      hasLatestResponse={latestResponse !== null}
                      onViewLatestResponse={() => setWorkspaceMode('response')}
                    />
                  ) : (
                    <ResponseViewer
                      response={latestResponse}
                      isLoading={isLoading}
                      activeClient={activeClient}
                      activeRequest={activeRequest}
                      onBackToRequest={() => setWorkspaceMode('request')}
                      onSend={handleSendRequest}
                      onOpenVisualize={() => setIsVisualizeModalOpen(true)}
                    />
                  )}
                </div>
              )}

              {currentSidebarTab === 'traffic' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                  <TrafficSimulator
                    clients={clients}
                    selectedClient={targetClientKey}
                    onSelectClient={(k) => {
                      const req = { ...activeRequest, clientKey: k, bodyJson: JSON.stringify({ clientKey: k }, null, 2) };
                      setActiveRequest(req);
                    }}
                    onNewTrace={(t) => setTraces((prev) => [t, ...prev].slice(0, 50))}
                    onNewHeaderSnapshot={(h) => {
                      setLatestSnapshot(h);
                      setSnapshots((prev) => [h, ...prev].slice(0, 50));
                    }}
                    onNewEvent={(e) => setSystemEvents((prev) => [e, ...prev].slice(0, 100))}
                  />
                </div>
              )}

              {currentSidebarTab === 'algorithms' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                  <AlgorithmVisualizer />
                </div>
              )}

              {currentSidebarTab === 'observability' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                  <TelemetryOverview
                    metrics={metrics}
                    health={health}
                    clients={clients}
                    rps={rps}
                    chartHistory={chartHistory}
                    onNavigateToTab={(tab) => {
                      if (tab === 'simulator') setCurrentSidebarTab('traffic');
                    }}
                  />
                </div>
              )}

              {currentSidebarTab === 'code' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                  <ApiIntegrationHub clients={clients} />
                </div>
              )}

              {/* Collapsible Console Log */}
              <PostmanConsole logs={consoleLogs} onClearLogs={() => setConsoleLogs([])} />
            </div>
          </div>
        )}

        {/* =========================================================================
            PILLAR 3: RATE LIMITER (Configuration & Policy Manager)
            ========================================================================= */}
        {mainTab === 'policies' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
            <PolicyManager
              clients={clients}
              onRefresh={fetchData}
              onOpenCreateModal={() => setIsCreatePolicyModalOpen(true)}
              onTestClient={(key) => {
                setActiveRequest((prev) => ({ ...prev, clientKey: key }));
                setMainTab('apiclient');
              }}
            />
          </div>
        )}

        {/* =========================================================================
            PILLAR 4: ANALYTICS (Historical Performance & Tracing Workbench)
            ========================================================================= */}
        {mainTab === 'analytics' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Analytics Sub-navigation Bar */}
            <div style={{ display: 'flex', gap: 6, padding: '10px 24px', background: '#121216', borderBottom: '1px solid #2A2A30' }}>
              <button
                className={`pm-sidebar-tab ${analyticsSubTab === 'benchmark' ? 'active' : ''}`}
                onClick={() => setAnalyticsSubTab('benchmark')}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                <Flame size={14} color="#F97316" />
                <span>Benchmark Lab</span>
              </button>
              <button
                className={`pm-sidebar-tab ${analyticsSubTab === 'tracing' ? 'active' : ''}`}
                onClick={() => setAnalyticsSubTab('tracing')}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                <Radio size={14} color="#38BDF8" />
                <span>Request Tracing</span>
              </button>
              <button
                className={`pm-sidebar-tab ${analyticsSubTab === 'headers' ? 'active' : ''}`}
                onClick={() => setAnalyticsSubTab('headers')}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                <Search size={14} color="#A855F7" />
                <span>Header Inspector</span>
              </button>
              <button
                className={`pm-sidebar-tab ${analyticsSubTab === 'traffic' ? 'active' : ''}`}
                onClick={() => setAnalyticsSubTab('traffic')}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                <Zap size={14} color="#22C55E" />
                <span>Traffic Simulator</span>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {analyticsSubTab === 'benchmark' && <BenchmarkLab clients={clients} />}
              {analyticsSubTab === 'tracing' && (
                <RequestTracing traces={traces} onClearTraces={() => setTraces([])} />
              )}
              {analyticsSubTab === 'headers' && (
                <HeaderInspector
                  latestSnapshot={latestSnapshot}
                  snapshots={snapshots}
                  clients={clients}
                  onTriggerCheck={(k) => handleSendTestRequest(k, '/v1/check')}
                />
              )}
              {analyticsSubTab === 'traffic' && (
                <TrafficSimulator
                  clients={clients}
                  selectedClient={targetClientKey}
                  onSelectClient={(k) => {
                    const req = { ...activeRequest, clientKey: k, bodyJson: JSON.stringify({ clientKey: k }, null, 2) };
                    setActiveRequest(req);
                  }}
                  onNewTrace={(t) => setTraces((prev) => [t, ...prev].slice(0, 50))}
                  onNewHeaderSnapshot={(h) => {
                    setLatestSnapshot(h);
                    setSnapshots((prev) => [h, ...prev].slice(0, 50));
                  }}
                  onNewEvent={(e) => setSystemEvents((prev) => [e, ...prev].slice(0, 100))}
                />
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            PILLAR 5: INFRASTRUCTURE (Distributed Monitoring & Chaos Workbench)
            ========================================================================= */}
        {mainTab === 'infrastructure' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Infrastructure Sub-navigation Bar */}
            <div style={{ display: 'flex', gap: 6, padding: '10px 24px', background: '#121216', borderBottom: '1px solid #2A2A30' }}>
              <button
                className={`pm-sidebar-tab ${infraSubTab === 'telemetry' ? 'active' : ''}`}
                onClick={() => setInfraSubTab('telemetry')}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                <Server size={14} color="#F97316" />
                <span>Instance Telemetry</span>
              </button>
              <button
                className={`pm-sidebar-tab ${infraSubTab === 'chaos' ? 'active' : ''}`}
                onClick={() => setInfraSubTab('chaos')}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                <Sparkles size={14} color="#A855F7" />
                <span>Chaos Lab</span>
              </button>
              <button
                className={`pm-sidebar-tab ${infraSubTab === 'algorithms' ? 'active' : ''}`}
                onClick={() => setInfraSubTab('algorithms')}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                <BookOpen size={14} color="#38BDF8" />
                <span>Algorithm Sandbox</span>
              </button>
              <button
                className={`pm-sidebar-tab ${infraSubTab === 'telemetry_overview' ? 'active' : ''}`}
                onClick={() => setInfraSubTab('telemetry_overview')}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                <Activity size={14} color="#22C55E" />
                <span>Cluster Topology</span>
              </button>
              <button
                className={`pm-sidebar-tab ${infraSubTab === 'code' ? 'active' : ''}`}
                onClick={() => setInfraSubTab('code')}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                <Code2 size={14} color="#FB923C" />
                <span>API Code Hub</span>
              </button>
              <button
                className={`pm-sidebar-tab ${infraSubTab === 'events' ? 'active' : ''}`}
                onClick={() => setInfraSubTab('events')}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                <Sliders size={14} color="#A1A1AA" />
                <span>System Event Stream</span>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {infraSubTab === 'telemetry' && <InstanceTelemetry health={health} metrics={metrics} />}
              {infraSubTab === 'chaos' && (
                <ChaosLab
                  onNewEvent={(e) => setSystemEvents((prev) => [e, ...prev].slice(0, 100))}
                  onTriggerSurge={() => handleSendTestRequest('surge-client', '/v1/check')}
                />
              )}
              {infraSubTab === 'algorithms' && <AlgorithmVisualizer />}
              {infraSubTab === 'telemetry_overview' && (
                <TelemetryOverview
                  metrics={metrics}
                  health={health}
                  clients={clients}
                  rps={rps}
                  chartHistory={chartHistory}
                  onNavigateToTab={(t) => {
                    if (t === 'simulator') {
                      setMainTab('analytics');
                      setAnalyticsSubTab('traffic');
                    } else if (t === 'policies') {
                      setMainTab('policies');
                    }
                  }}
                />
              )}
              {infraSubTab === 'code' && <ApiIntegrationHub clients={clients} />}
              {infraSubTab === 'events' && (
                <SystemEventStream events={systemEvents} onClearEvents={() => setSystemEvents([])} />
              )}
            </div>
          </div>
        )}
      </div>

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

      {/* 2. Physics Visualizer Modal */}
      <VisualizeModal
        isOpen={isVisualizeModalOpen}
        onClose={() => setIsVisualizeModalOpen(false)}
        activeClient={activeClient}
        remainingTokens={latestResponse?.remaining ?? 20}
        burstLimit={latestResponse?.limit ?? 20}
      />

      {/* 3. Environment Variable Manager Modal */}
      <EnvironmentModal
        isOpen={isEnvModalOpen}
        onClose={() => setIsEnvModalOpen(false)}
        environments={environments}
        activeEnvironmentId={activeEnvironmentId}
        onUpdateEnvironments={setEnvironments}
      />

      {/* 4. Create Policy Modal */}
      {isCreatePolicyModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={18} color="#F97316" />
                <h3>Create Rate Limiting Policy</h3>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsCreatePolicyModalOpen(false)}
                style={{ padding: '4px 8px' }}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreatePolicy} style={{ padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#F4F4F5' }}>
                  Client Key (Identifier)
                </label>
                <input
                  type="text"
                  placeholder="e.g. mobile-app-v2, user-10293, payment-gateway"
                  value={newClientKey}
                  onChange={(e) => setNewClientKey(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: '#121216',
                    border: '1px solid #2A2A30',
                    color: '#F4F4F5',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#F4F4F5' }}>
                  Rate Limiting Algorithm
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setNewAlgorithm('token_bucket')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      border: newAlgorithm === 'token_bucket' ? '1px solid #F97316' : '1px solid #2A2A30',
                      background: newAlgorithm === 'token_bucket' ? 'rgba(249, 115, 22, 0.15)' : '#202024',
                      color: newAlgorithm === 'token_bucket' ? '#F97316' : '#A1A1AA',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Token Bucket
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAlgorithm('sliding_window')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      border: newAlgorithm === 'sliding_window' ? '1px solid #A855F7' : '1px solid #2A2A30',
                      background: newAlgorithm === 'sliding_window' ? 'rgba(168, 85, 247, 0.15)' : '#202024',
                      color: newAlgorithm === 'sliding_window' ? '#A855F7' : '#A1A1AA',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Sliding Window Log
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#F4F4F5' }}>
                    Quota Rate (RPS)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newRps}
                    onChange={(e) => setNewRps(Number(e.target.value))}
                    required
                    style={{
                      width: '100%',
                      background: '#121216',
                      border: '1px solid #2A2A30',
                      color: '#F4F4F5',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                    }}
                  />
                </div>

                {newAlgorithm === 'token_bucket' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#F4F4F5' }}>
                      Burst Size (Capacity)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newBurstSize}
                      onChange={(e) => setNewBurstSize(Number(e.target.value))}
                      required
                      style={{
                        width: '100%',
                        background: '#121216',
                        border: '1px solid #2A2A30',
                        color: '#F4F4F5',
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        outline: 'none',
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#F4F4F5' }}>
                      Window Size (Sec)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newWindowSize}
                      onChange={(e) => setNewWindowSize(Number(e.target.value))}
                      required
                      style={{
                        width: '100%',
                        background: '#121216',
                        border: '1px solid #2A2A30',
                        color: '#F4F4F5',
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreatePolicyModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
