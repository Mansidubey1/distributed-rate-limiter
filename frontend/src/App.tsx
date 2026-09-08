import { useState, useEffect, useRef } from 'react';
import {
  RequestTemplate,
  ResponseSnapshot,
  HistoryItem,
  ConsoleLogEntry,
  EnvironmentProfile,
  WorkspaceMode
} from './types/postman';
import { Metrics, Health, Client } from './types';
import { defaultCollections, defaultEnvironments } from './data/defaultCollections';
import { PostmanHeader } from './components/postman/PostmanHeader';
import { PostmanSidebar, SidebarTab } from './components/postman/PostmanSidebar';
import { RequestBuilder } from './components/postman/RequestBuilder';
import { ResponseViewer } from './components/postman/ResponseViewer';
import { BurstModal } from './components/postman/BurstModal';
import { VisualizeModal } from './components/postman/VisualizeModal';
import { EnvironmentModal } from './components/postman/EnvironmentModal';
import { PostmanConsole } from './components/postman/PostmanConsole';
import { TelemetryOverview } from './components/TelemetryOverview';
import { TrafficSimulator } from './components/TrafficSimulator';
import { AlgorithmVisualizer } from './components/AlgorithmVisualizer';
import { ApiIntegrationHub } from './components/ApiIntegrationHub';
import { soundFX } from './utils/helpers';

export default function App() {
  // Environments & Collections
  const [environments, setEnvironments] = useState<EnvironmentProfile[]>(defaultEnvironments);
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string>('env-local');
  const [collections] = useState(defaultCollections);

  // Workspace Mode: 'request' | 'response'
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
      message: 'RateLimiter Postman Workspace initialized. Connected to local server.',
    },
  ]);

  // Sidebar Mode Tab
  const [currentSidebarTab, setCurrentSidebarTab] = useState<SidebarTab>('collections');

  // Modals
  const [isBurstModalOpen, setIsBurstModalOpen] = useState<boolean>(false);
  const [isVisualizeModalOpen, setIsVisualizeModalOpen] = useState<boolean>(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState<boolean>(false);

  // Live Cluster Data
  const [metrics, setMetrics] = useState<Metrics>({
    totalRequests: 0,
    allowedRequests: 0,
    deniedRequests: 0,
    clients: 0,
  });
  const [health, setHealth] = useState<Health | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [rps, setRps] = useState<number>(0);
  const [chartHistory, setChartHistory] = useState<{ allowed: number; denied: number }[]>(
    Array.from({ length: 45 }, () => ({ allowed: 0, denied: 0 }))
  );

  const prevTotalRef = useRef<number>(0);
  const prevAllowedRef = useRef<number>(0);
  const prevDeniedRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(Date.now());

  // Fetch Live Metrics & Clients
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
        if (diffSec >= 1) {
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
        setClients(c);
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

  // Extract clientKey from JSON body or URL
  const extractClientKey = (bodyJson: string, url: string): string => {
    try {
      const parsed = JSON.parse(interpolateVars(bodyJson));
      if (parsed.clientKey) return parsed.clientKey;
    } catch (_) {}
    if (url.includes('/clients/')) {
      const parts = url.split('/clients/');
      return parts[1]?.split('/')[0] || 'client';
    }
    return clients[0]?.clientKey || 'mobile-app-client';
  };

  // Find active client object
  const targetClientKey = extractClientKey(activeRequest.bodyJson, activeRequest.url);
  const activeClient = clients.find((c) => c.clientKey === targetClientKey) || clients[0] || null;

  // Execute Request (SEND button)
  const handleSendRequest = async () => {
    setIsLoading(true);
    const resolvedUrl = interpolateVars(activeRequest.url);
    const resolvedBody = activeRequest.bodyType === 'json' && activeRequest.method !== 'GET'
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
    }

    const startMs = performance.now();
    try {
      const res = await fetch(resolvedUrl, {
        method: activeRequest.method,
        headers: resolvedHeaders,
        body: resolvedBody,
      });

      const latencyMs = Number((performance.now() - startMs).toFixed(2));
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        resHeaders[k] = v;
      });

      const bodyData = await res.json().catch(() => ({}));
      const sizeBytes = JSON.stringify(bodyData).length + 120;
      const isAllow = res.status === 200;

      if (isAllow) soundFX.playAllow();
      else soundFX.playDeny();

      const limit = Number(res.headers.get('x-ratelimit-limit') || bodyData.limit || 20);
      const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? bodyData.remaining ?? 0);
      const reset = Number(res.headers.get('x-ratelimit-reset') || bodyData.reset || Math.floor(Date.now() / 1000) + 1);
      const retryAfter = res.headers.get('retry-after') ? Number(res.headers.get('retry-after')) : bodyData.retryAfter;

      const snapshot: ResponseSnapshot = {
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
      };

      setLatestResponse(snapshot);
      setWorkspaceMode('response');

      // Record History
      const historyItem: HistoryItem = {
        id: `hist-${Date.now()}`,
        timestamp: Date.now(),
        method: activeRequest.method,
        url: activeRequest.url,
        clientKey: targetClientKey,
        status: res.status,
        latencyMs,
        decision: isAllow ? 'ALLOW' : 'DENY',
        request: { ...activeRequest },
        response: snapshot,
      };
      setHistory((prev) => [historyItem, ...prev].slice(0, 50));

      // Append to Console Log
      const logEntry: ConsoleLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        type: 'response',
        method: activeRequest.method,
        url: resolvedUrl,
        status: res.status,
        statusText: snapshot.statusText,
        latencyMs,
        instanceId: snapshot.instanceId,
        remaining,
        limit,
        message: `${activeRequest.method} ${resolvedUrl} → ${res.status} ${snapshot.statusText} (${latencyMs}ms)`,
      };
      setConsoleLogs((prev) => [logEntry, ...prev].slice(0, 100));

      fetchData();
    } catch (err: any) {
      const latencyMs = Number((performance.now() - startMs).toFixed(2));
      const errorSnapshot: ResponseSnapshot = {
        timestamp: Date.now(),
        status: 500,
        statusText: 'Fetch Error / Unreachable',
        latencyMs,
        sizeBytes: 0,
        body: { error: err.message || 'Failed to fetch rate limiter' },
        headers: {},
        instanceId: 'limiter-01',
        requestId: 'err',
        limit: 20,
        remaining: 0,
        reset: Math.floor(Date.now() / 1000) + 1,
        decision: 'DENY',
      };
      setLatestResponse(errorSnapshot);
      setWorkspaceMode('response');

      setConsoleLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          type: 'error',
          method: activeRequest.method,
          url: resolvedUrl,
          status: 500,
          statusText: 'ERR',
          latencyMs,
          message: `Network Error: ${err.message}`,
        },
        ...prev,
      ]);
    } finally {
      setIsLoading(false);
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
      name: 'Custom Check Request',
      method: 'POST',
      url: '{{BASE_URL}}/v1/check',
      headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json', enabled: true }],
      params: [],
      bodyType: 'json',
      bodyJson: JSON.stringify({ clientKey: 'my-custom-client' }, null, 2),
      authType: 'none',
    };
    setActiveRequest(newReq);
    setWorkspaceMode('request');
    setCurrentSidebarTab('collections');
  };

  return (
    <div className="app-root">
      {/* 1. Postman Top Header */}
      <PostmanHeader
        environments={environments}
        activeEnvironmentId={activeEnvironmentId}
        onSelectEnvironment={setActiveEnvironmentId}
        onOpenEnvironmentModal={() => setIsEnvModalOpen(true)}
        health={health}
        onOpenChaosModal={() => setCurrentSidebarTab('traffic')}
      />

      {/* 2. Main Body: Sidebar + Dynamic Workspace */}
      <div className="pm-main-body">
        {/* Left Sidebar */}
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

        {/* Dynamic Center/Right Content */}
        <div className="pm-content">
          {/* View 1: Main Postman Single Workspace (Request / Response Mode) */}
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

          {/* View 2: Traffic & Stress Lab */}
          {currentSidebarTab === 'traffic' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <TrafficSimulator
                clients={clients}
                selectedClient={targetClientKey}
                onSelectClient={(k) => {
                  const req = { ...activeRequest, bodyJson: JSON.stringify({ clientKey: k }, null, 2) };
                  setActiveRequest(req);
                }}
                onNewTrace={() => {}}
                onNewHeaderSnapshot={() => {}}
                onNewEvent={() => {}}
              />
            </div>
          )}

          {/* View 3: Algorithm Visualizer Lab */}
          {currentSidebarTab === 'algorithms' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <AlgorithmVisualizer />
            </div>
          )}

          {/* View 4: Cluster Observability */}
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

          {/* View 5: Developer API Hub */}
          {currentSidebarTab === 'code' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <ApiIntegrationHub clients={clients} />
            </div>
          )}

          {/* Bottom Collapsible Postman Console */}
          <PostmanConsole logs={consoleLogs} onClearLogs={() => setConsoleLogs([])} />
        </div>
      </div>

      {/* Modals */}
      {/* 1. Burst Stress Runner Modal */}
      <BurstModal
        isOpen={isBurstModalOpen}
        onClose={() => setIsBurstModalOpen(false)}
        targetUrl={interpolateVars(activeRequest.url)}
        targetClientKey={targetClientKey}
        headers={{ 'Content-Type': 'application/json' }}
        onBurstComplete={(summary) => {
          setConsoleLogs((prev) => [
            {
              id: `log-${Date.now()}`,
              timestamp: Date.now(),
              type: 'info',
              message: `Burst Completed: ${summary.total} requests (${summary.allowed} ALLOW, ${summary.denied} 429) | Avg: ${summary.avgLatency}ms | P95: ${summary.p95Latency}ms`,
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
    </div>
  );
}
