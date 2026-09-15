import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Zap,
  Flame,
  Copy,
  Check,
  Plus,
  Trash2,
  Send,
  Folder,
  ChevronRight,
  ChevronDown,
  Terminal,
  RotateCcw,
  Server,
  Database,
  Globe
} from 'lucide-react';
import {
  Metrics,
  Health,
  Client,
  LiveRequestActivity,
  DashboardEvent
} from '../types';
import {
  RequestTemplate,
  ResponseSnapshot,
  HistoryItem,
  ConsoleLogEntry,
  HttpMethod,
  KeyValueParam,
  RequestCollection
} from '../types/postman';
import { demoApiPresets } from '../data/defaultCollections';
import { soundFX, formatTime } from '../utils/helpers';

export type SidebarTab = 'collections' | 'history';

interface UnifiedWorkbenchProps {
  metrics: Metrics;
  health: Health | null;
  clients: Client[];
  rps: number;
  chartHistory: { allowed: number; denied: number }[];
  liveRequests: LiveRequestActivity[];
  events: DashboardEvent[];
  collections: RequestCollection[];
  history: HistoryItem[];
  activeRequest: RequestTemplate;
  onChangeRequest: (updated: RequestTemplate) => void;
  onSendRequest: () => void;
  onSelectRequest: (req: RequestTemplate) => void;
  onSelectHistory: (item: HistoryItem) => void;
  onClearHistory: () => void;
  onNewRequest: () => void;
  currentSidebarTab: SidebarTab;
  onSelectSidebarTab: (tab: SidebarTab) => void;
  isLoading: boolean;
  latestResponse: ResponseSnapshot | null;
  onOpenBurst?: () => void;
  onOpenEnvModal?: () => void;
  onConsumeTokenDirect?: (clientKey: string, count: number) => Promise<any>;
  onSendTestRequest?: (clientKey: string, endpoint?: string) => Promise<any>;
  onClearEvents?: () => void;
  onRefreshData?: () => void;
  consoleLogs: ConsoleLogEntry[];
  onClearConsoleLogs: () => void;
}

export const UnifiedWorkbench: React.FC<UnifiedWorkbenchProps> = ({
  metrics,
  health,
  clients,
  rps,
  chartHistory,
  liveRequests,
  events,
  collections,
  history,
  activeRequest,
  onChangeRequest,
  onSendRequest,
  onSelectRequest,
  onSelectHistory,
  onClearHistory,
  onNewRequest,
  currentSidebarTab,
  onSelectSidebarTab,
  isLoading,
  latestResponse,
  onOpenBurst,
  onClearEvents,
  onRefreshData,
  consoleLogs,
  onClearConsoleLogs,
}) => {
  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'fld-core': true,
    'fld-token-bucket': true,
    'fld-sliding-window': true,
    'fld-admin': false,
  });
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Request & Response Tab States
  const [requestTab, setRequestTab] = useState<'params' | 'headers' | 'body' | 'code'>('params');
  const [selectedCodeLang, setSelectedCodeLang] = useState<'curl' | 'javascript' | 'python' | 'go'>('curl');
  const [responseTab, setResponseTab] = useState<'body' | 'headers' | 'timeline'>('body');
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);

  // Console Drawer state
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);

  // Peak RPS tracking
  const [peakRps, setPeakRps] = useState<number>(() => Math.max(rps, 0));
  useEffect(() => {
    if (rps > peakRps) {
      setPeakRps(rps);
    }
  }, [rps, peakRps]);

  // Selected client for Token Bucket visualizer
  const [selectedClientKey, setSelectedClientKey] = useState<string>(() => {
    return activeRequest.clientKey || clients[0]?.clientKey || 'mobile-app-client';
  });

  useEffect(() => {
    if (activeRequest.clientKey && activeRequest.clientKey !== selectedClientKey) {
      setSelectedClientKey(activeRequest.clientKey);
    }
  }, [activeRequest.clientKey, selectedClientKey]);

  const activeClientObj = clients.find((c) => c.clientKey === selectedClientKey) || clients[0] || {
    clientKey: 'mobile-app-client',
    algorithm: 'token_bucket',
    requestsPerSecond: 5,
    burstSize: 20,
    windowSize: 10,
  };

  // Target API to inspect & check tokens for
  const [simApiSource, setSimApiSource] = useState<'workbench' | 'check'>('workbench');
  const [lastSimResult, setLastSimResult] = useState<{
    status: number;
    latencyMs: number;
    remaining: number;
    decision: string;
    targetUrl: string;
    time: number;
  } | null>(null);

  const cleanUrl = (rawUrl: string): string => {
    if (!rawUrl) return 'http://localhost:3000/v1/check';
    return rawUrl.replace(/\{\{BASE_URL\}\}/g, 'http://localhost:3000');
  };

  const activeSimUrl =
    simApiSource === 'workbench'
      ? cleanUrl(activeRequest.url || 'http://localhost:3000/v1/check')
      : 'http://localhost:3000/v1/check';

  const activeSimMethod =
    simApiSource === 'workbench' ? activeRequest.method : 'GET';

  // Local simulated token bucket state for continuous fluid visual animation
  const burstCapacity = activeClientObj.burstSize || 20;
  const refillRate = activeClientObj.requestsPerSecond || 5;
  const [tokens, setTokens] = useState<number>(() => Math.min(16, burstCapacity));
  const [isConsuming, setIsConsuming] = useState<boolean>(false);
  const [bucketActionNote, setBucketActionNote] = useState<string | null>(null);

  // Continuous Refill Timer for Token Bucket widget
  useEffect(() => {
    const interval = setInterval(() => {
      setTokens((prev) => {
        const step = refillRate / 10;
        const next = Math.min(burstCapacity, Number((prev + step).toFixed(1)));
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [burstCapacity, refillRate]);

  // Handle Token Consumption in Simulator against Running / Public API
  const handleSimulateTokenConsumption = async (count: number = 1) => {
    setIsConsuming(true);
    const targetUrl = activeSimUrl;
    const isInternalCheck = targetUrl.includes('/v1/check') || simApiSource === 'check';

    try {
      if (count === 1) {
        const startTime = performance.now();
        let res: Response;
        let data: any = {};

        if (isInternalCheck) {
          res = await fetch('/v1/check', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Client-Key': selectedClientKey,
            },
            body: JSON.stringify({
              clientKey: selectedClientKey,
              cost: 1,
              algorithm: activeClientObj.algorithm || 'token_bucket',
              requestsPerSecond: refillRate,
              burstSize: burstCapacity,
            }),
          });
          data = await res.json().catch(() => ({}));
        } else {
          res = await fetch('/v1/proxy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Client-Key': selectedClientKey,
            },
            body: JSON.stringify({
              url: targetUrl,
              targetUrl: targetUrl,
              method: activeSimMethod,
              clientKey: selectedClientKey,
            }),
          });
          data = await res.json().catch(() => ({}));
        }

        const latency = Math.round(performance.now() - startTime);
        const isAllow = res.status === 200 || res.status === 201;
        const remainingTokens =
          data.rateLimit?.remaining !== undefined
            ? data.rateLimit.remaining
            : data.remaining !== undefined
            ? data.remaining
            : isAllow
            ? Math.max(0, tokens - 1)
            : 0;

        setTokens(remainingTokens);

        if (isAllow) {
          soundFX.playAllow();
          setBucketActionNote(
            `200 OK ALLOWED: 1 token consumed (${latency}ms) • ${remainingTokens}/${burstCapacity} left`
          );
        } else {
          soundFX.playDeny();
          const retry = data.rateLimit?.retryAfter || data.retryAfter || 1;
          setBucketActionNote(
            `429 THROTTLED: Too Many Requests (0 remaining) • Retry in ${retry}s`
          );
        }

        setLastSimResult({
          status: res.status,
          latencyMs: latency,
          remaining: remainingTokens,
          decision: isAllow ? 'ALLOW' : 'DENY',
          targetUrl,
          time: Date.now(),
        });

        if (onRefreshData) onRefreshData();
      } else {
        // Multi-token burst testing against API
        const startTime = performance.now();
        const promises = Array.from({ length: count }, () => {
          if (isInternalCheck) {
            return fetch('/v1/check', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Client-Key': selectedClientKey,
              },
              body: JSON.stringify({
                clientKey: selectedClientKey,
                cost: 1,
                algorithm: activeClientObj.algorithm || 'token_bucket',
              }),
            }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
          } else {
            return fetch('/v1/proxy', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Client-Key': selectedClientKey,
              },
              body: JSON.stringify({
                url: targetUrl,
                targetUrl: targetUrl,
                method: activeSimMethod,
                clientKey: selectedClientKey,
              }),
            }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
          }
        });

        const responses = await Promise.all(promises);
        const latency = Math.round(performance.now() - startTime);
        const allowedCount = responses.filter((r) => r.status === 200 || r.status === 201).length;
        const deniedCount = responses.length - allowedCount;
        const lastResp = responses[responses.length - 1];
        const remainingTokens =
          lastResp?.data?.rateLimit?.remaining !== undefined
            ? lastResp.data.rateLimit.remaining
            : lastResp?.data?.remaining !== undefined
            ? lastResp.data.remaining
            : deniedCount > 0
            ? 0
            : Math.max(0, tokens - allowedCount);

        setTokens(remainingTokens);

        if (deniedCount > 0) {
          soundFX.playDeny();
          setBucketActionNote(
            `Burst ${count}x: ${allowedCount} Allowed (200), ${deniedCount} Throttled (429)! Tokens: ${remainingTokens}/${burstCapacity}`
          );
        } else {
          soundFX.playAllow();
          setBucketActionNote(
            `Burst ${count}x Success: All ${allowedCount} allowed in ${latency}ms! Tokens: ${remainingTokens}/${burstCapacity}`
          );
        }

        setLastSimResult({
          status: deniedCount > 0 ? 429 : 200,
          latencyMs: latency,
          remaining: remainingTokens,
          decision: deniedCount > 0 ? 'BURST (THROTTLED)' : 'BURST (ALLOWED)',
          targetUrl,
          time: Date.now(),
        });

        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      soundFX.playDeny();
      setBucketActionNote(`Network error calling API: ${err.message || 'Check connection'}`);
    } finally {
      setTimeout(() => {
        setIsConsuming(false);
        setTimeout(() => setBucketActionNote(null), 3500);
      }, 300);
    }
  };

  const handleRefillBucket = () => {
    setTokens(burstCapacity);
    soundFX.playAllow();
    setBucketActionNote(`Bucket fully refilled to ${burstCapacity} tokens`);
    setTimeout(() => setBucketActionNote(null), 2000);
  };

  // Activity Table Filter
  const [activityFilter, setActivityFilter] = useState<'ALL' | '200' | '429'>('ALL');

  // Compute total & rates
  const totalAllowed = metrics.allowedRequests ?? 0;
  const totalDenied = metrics.deniedRequests ?? 0;
  const total = totalAllowed + totalDenied;
  const denyPercentage = total > 0 ? ((totalDenied / total) * 100).toFixed(1) : '0.0';
  const activeKeysCount = clients.length;


  // Real-time Canvas Graph
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const historyData = chartHistory.length > 0
      ? chartHistory
      : Array.from({ length: 45 }, () => ({
          allowed: 0,
          denied: 0,
        }));

    const step = w / Math.max(1, historyData.length - 1);
    let maxVal = 20;
    historyData.forEach((pt) => {
      const sum = Math.max(pt.allowed + pt.denied, pt.allowed);
      if (sum > maxVal) maxVal = sum;
    });
    maxVal = Math.ceil(maxVal * 1.25);

    // Background Grid
    ctx.strokeStyle = 'rgba(42, 42, 48, 0.6)';
    ctx.lineWidth = 1 * dpr;
    const gridRows = 3;
    for (let i = 1; i <= gridRows; i++) {
      const y = h - (h * i) / (gridRows + 1);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      ctx.fillStyle = '#71717A';
      ctx.font = `${9.5 * dpr}px JetBrains Mono, monospace`;
      ctx.fillText(`${Math.round((maxVal * i) / (gridRows + 1))} rps`, 10 * dpr, y - 4 * dpr);
    }

    // 200 ALLOW Area & Curve (Emerald Green)
    if (historyData.length > 1) {
      const allowGrad = ctx.createLinearGradient(0, 0, 0, h);
      allowGrad.addColorStop(0, 'rgba(34, 197, 94, 0.28)');
      allowGrad.addColorStop(1, 'rgba(34, 197, 94, 0.0)');

      ctx.beginPath();
      ctx.moveTo(0, h);
      historyData.forEach((pt, i) => {
        const x = i * step;
        const y = h - (pt.allowed / maxVal) * (h - 25 * dpr) - 8 * dpr;
        if (i === 0) ctx.lineTo(x, y);
        else {
          const prevX = (i - 1) * step;
          const prevY = h - (historyData[i - 1].allowed / maxVal) * (h - 25 * dpr) - 8 * dpr;
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
      });
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = allowGrad;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2 * dpr;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(34, 197, 94, 0.4)';
      ctx.shadowBlur = 6 * dpr;
      historyData.forEach((pt, i) => {
        const x = i * step;
        const y = h - (pt.allowed / maxVal) * (h - 25 * dpr) - 8 * dpr;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prevX = (i - 1) * step;
          const prevY = h - (historyData[i - 1].allowed / maxVal) * (h - 25 * dpr) - 8 * dpr;
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 429 THROTTLE Curve (Ruby Red)
    if (historyData.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.8 * dpr;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
      ctx.shadowBlur = 5 * dpr;
      historyData.forEach((pt, i) => {
        const x = i * step;
        const y = h - (pt.denied / maxVal) * (h - 25 * dpr) - 8 * dpr;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prevX = (i - 1) * step;
          const prevY = h - (historyData[i - 1].denied / maxVal) * (h - 25 * dpr) - 8 * dpr;
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [chartHistory]);

  // Handlers for Request Changes
  const handleMethodChange = (method: HttpMethod) => {
    onChangeRequest({ ...activeRequest, method });
  };

  const handleUrlChange = (url: string) => {
    onChangeRequest({ ...activeRequest, url });
  };

  const handleClientKeyChange = (clientKey: string) => {
    onChangeRequest({ ...activeRequest, clientKey });
    setSelectedClientKey(clientKey);
  };

  const handleAddParam = () => {
    const newParam: KeyValueParam = {
      id: `p-${Date.now()}`,
      key: '',
      value: '',
      enabled: true,
    };
    onChangeRequest({ ...activeRequest, params: [...activeRequest.params, newParam] });
  };

  const handleUpdateParam = (id: string, field: 'key' | 'value' | 'enabled', val: any) => {
    const updated = activeRequest.params.map((p) => (p.id === id ? { ...p, [field]: val } : p));
    onChangeRequest({ ...activeRequest, params: updated });
  };

  const handleDeleteParam = (id: string) => {
    onChangeRequest({ ...activeRequest, params: activeRequest.params.filter((p) => p.id !== id) });
  };

  const handleAddHeader = () => {
    const newHeader: KeyValueParam = {
      id: `h-${Date.now()}`,
      key: '',
      value: '',
      enabled: true,
    };
    onChangeRequest({ ...activeRequest, headers: [...activeRequest.headers, newHeader] });
  };

  const handleUpdateHeader = (id: string, field: 'key' | 'value' | 'enabled', val: any) => {
    const updated = activeRequest.headers.map((h) => (h.id === id ? { ...h, [field]: val } : h));
    onChangeRequest({ ...activeRequest, headers: updated });
  };

  const handleDeleteHeader = (id: string) => {
    onChangeRequest({ ...activeRequest, headers: activeRequest.headers.filter((h) => h.id !== id) });
  };

  const handleCopyResponse = () => {
    if (!latestResponse) return;
    navigator.clipboard.writeText(
      typeof latestResponse.body === 'string' ? latestResponse.body : JSON.stringify(latestResponse.body, null, 2)
    );
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const generateCodeSnippet = (lang: 'curl' | 'javascript' | 'python' | 'go'): string => {
    const clientKey = activeRequest.clientKey || 'mobile-app-client';
    switch (lang) {
      case 'curl':
        return `curl -X ${activeRequest.method} "${activeRequest.url}" \\\n  -H "x-client-key: ${clientKey}" \\\n  -H "Content-Type: application/json"${
          activeRequest.method !== 'GET' && activeRequest.bodyJson ? ` \\\n  -d '${activeRequest.bodyJson.replace(/'/g, "'\\''")}'` : ''
        }`;
      case 'javascript':
        return `// JavaScript (Fetch)\nconst response = await fetch("${activeRequest.url}", {\n  method: "${activeRequest.method}",\n  headers: {\n    "x-client-key": "${clientKey}",\n    "Content-Type": "application/json"\n  },\n  body: ${
          activeRequest.method !== 'GET' && activeRequest.bodyJson ? JSON.stringify(activeRequest.bodyJson) : 'undefined'
        }\n});\nconst data = await response.json();\nconsole.log(data);`;
      case 'python':
        return `# Python (Requests)\nimport requests\n\nheaders = {\n    "x-client-key": "${clientKey}",\n    "Content-Type": "application/json"\n}\n\nresponse = requests.${activeRequest.method.toLowerCase()}("${activeRequest.url}", headers=headers${
          activeRequest.method !== 'GET' && activeRequest.bodyJson ? `, json=${activeRequest.bodyJson}` : ''
        })\nprint(response.status_code, response.json())`;
      case 'go':
        return `// Go (net/http)\npackage main\n\nimport (\n\t"net/http"\n\t"fmt"\n)\n\nfunc main() {\n\treq, _ := http.NewRequest("${activeRequest.method}", "${activeRequest.url}", nil)\n\treq.Header.Set("x-client-key", "${clientKey}")\n\tres, _ := http.DefaultClient.Do(req)\n\tfmt.Println(res.Status)\n}`;
    }
  };

  const getMethodClass = (method: HttpMethod) => {
    switch (method) {
      case 'GET': return 'method-get';
      case 'POST': return 'method-post';
      case 'PUT': return 'method-put';
      case 'DELETE': return 'method-delete';
      case 'PATCH': return 'method-patch';
      default: return 'method-post';
    }
  };

  const filteredRequests = liveRequests.filter((req) => {
    if (activityFilter === '200' && req.status !== 200 && req.status !== 201) return false;
    if (activityFilter === '429' && req.status !== 429) return false;
    return true;
  });

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  return (
    <div id="overview" className="unified-workbench-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', padding: '20px 24px 80px', maxWidth: 1680, margin: '0 auto', gap: 24 }}>
      {/* =========================================================================
          SECTION 1: API CLIENT & INTERACTIVE WORKBENCH (FULL SINGLE PAGE)
          Includes Workspace Sidebar + Request Builder + Response Viewer
          ========================================================================= */}
      <div id="workbench" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={18} color="#F97316" />
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
              API Client & Gateway Workbench
            </h2>
            <span style={{ fontSize: 12, color: '#71717A' }}>• Dispatch live requests & inspect rate limit headers</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? 'Hide Collections Sidebar' : 'Show Collections Sidebar'}
              style={{ padding: '5px 12px', fontSize: 12 }}
            >
              <span>{isSidebarOpen ? 'Hide Sidebar' : 'Show Collections'}</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onNewRequest}
              style={{ padding: '5px 12px', fontSize: 12, color: '#F97316' }}
            >
              <span>New Request</span>
            </button>
          </div>
        </div>

        {/* Unified 2-Column / Master-Detail Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isSidebarOpen ? 'minmax(0, 3fr) minmax(0, 7fr)' : 'minmax(0, 1fr)',
            gap: 16,
            alignItems: 'stretch',
            transition: 'grid-template-columns 0.2s ease',
          }}
        >
          {/* Column 1: Workspace Sidebar (Collections & History) */}
          {isSidebarOpen && (
            <aside
              className="glass-panel"
              style={{
                background: '#121216',
                border: '1px solid #2A2A30',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
                minWidth: 0,
              }}
            >
              {/* Header */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #202024', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#71717A', textTransform: 'uppercase' }}>
                  WORKSPACE
                </span>
                <span style={{ fontSize: 10.5, color: '#F97316', fontWeight: 700 }}>
                  {collections.reduce((acc, c) => acc + c.folders.reduce((fAcc, f) => fAcc + f.requests.length, 0), 0)} REQS
                </span>
              </div>

              {/* Mode Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #202024', background: '#18181C' }}>
                <button
                  onClick={() => onSelectSidebarTab('collections')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    border: 'none',
                    background: currentSidebarTab === 'collections' ? '#121216' : 'transparent',
                    color: currentSidebarTab === 'collections' ? '#F97316' : '#71717A',
                    fontSize: 11.5,
                    fontWeight: currentSidebarTab === 'collections' ? 700 : 500,
                    cursor: 'pointer',
                    borderBottom: currentSidebarTab === 'collections' ? '2px solid #F97316' : '2px solid transparent',
                  }}
                >
                  Collections
                </button>
                <button
                  onClick={() => onSelectSidebarTab('history')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    border: 'none',
                    background: currentSidebarTab === 'history' ? '#121216' : 'transparent',
                    color: currentSidebarTab === 'history' ? '#F97316' : '#71717A',
                    fontSize: 11.5,
                    fontWeight: currentSidebarTab === 'history' ? 700 : 500,
                    cursor: 'pointer',
                    borderBottom: currentSidebarTab === 'history' ? '2px solid #F97316' : '2px solid transparent',
                  }}
                >
                  History ({history.length})
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #202024' }}>
                <input
                  type="text"
                  placeholder="Filter requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#18181C',
                    border: '1px solid #2A2A30',
                    borderRadius: 4,
                    padding: '4px 8px',
                    color: '#F4F4F5',
                    fontSize: 11.5,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Sidebar Content Tree */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
                {currentSidebarTab === 'collections' ? (
                  collections.map((col) => (
                    <div key={col.id} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#A1A1AA', padding: '4px 8px', textTransform: 'uppercase' }}>
                        {col.name}
                      </div>
                      {col.folders.map((folder) => {
                        const isExpanded = expandedFolders[folder.id] ?? true;
                        const matchedReqs = folder.requests.filter((r) =>
                          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.url.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                        if (searchQuery && matchedReqs.length === 0) return null;

                        return (
                          <div key={folder.id} style={{ marginBottom: 4 }}>
                            <div
                              onClick={() => toggleFolder(folder.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 8px',
                                borderRadius: 4,
                                cursor: 'pointer',
                                color: '#D4D4D8',
                                fontSize: 11.5,
                                fontWeight: 600,
                              }}
                            >
                              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              <Folder size={12} color="#F97316" />
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {folder.name}
                              </span>
                              <span style={{ fontSize: 10, color: '#71717A' }}>{matchedReqs.length}</span>
                            </div>

                            {isExpanded && (
                              <div style={{ marginLeft: 14, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                                {matchedReqs.map((req) => {
                                  const isSelected = activeRequest.id === req.id;
                                  return (
                                    <div
                                      key={req.id}
                                      onClick={() => onSelectRequest(req)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '5px 8px',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        background: isSelected ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                                        border: isSelected ? '1px solid rgba(249, 115, 22, 0.35)' : '1px solid transparent',
                                      }}
                                    >
                                      <span className={getMethodClass(req.method)} style={{ fontSize: 9.5, padding: '1px 4px', borderRadius: 3, fontWeight: 800 }}>
                                        {req.method}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 11.5,
                                          color: isSelected ? '#F97316' : '#A1A1AA',
                                          fontWeight: isSelected ? 700 : 500,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          flex: 1,
                                        }}
                                      >
                                        {req.name}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  <div>
                    {history.length === 0 ? (
                      <div style={{ padding: '20px 10px', textAlign: 'center', color: '#71717A', fontSize: 11.5 }}>
                        No execution history yet. Dispatch requests to populate.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 4px 6px' }}>
                          <button
                            onClick={onClearHistory}
                            style={{ background: 'transparent', border: 'none', color: '#EF4444', fontSize: 10.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            <Trash2 size={11} /> Clear
                          </button>
                        </div>
                        {history.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => onSelectHistory(item)}
                            style={{
                              padding: '6px 8px',
                              borderRadius: 4,
                              background: '#18181C',
                              border: '1px solid #202024',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className={getMethodClass(item.method)} style={{ fontSize: 9.5, padding: '1px 4px', borderRadius: 3, fontWeight: 800 }}>
                                {item.method}
                              </span>
                              <span style={{ fontSize: 10, color: item.status === 200 || item.status === 201 ? '#22C55E' : '#EF4444', fontWeight: 700 }}>
                                {item.status} ({item.latencyMs}ms)
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: '#D4D4D8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.url}
                            </div>
                            <div style={{ fontSize: 9.5, color: '#71717A' }}>
                              {formatTime(item.timestamp)} • {item.clientKey}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* Column 2: Interactive Request Builder & Response Viewer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, height: '100%' }}>
            {/* Request Builder Card */}
            <div className="glass-panel" style={{ padding: '18px 20px', background: '#18181C', border: '1px solid #2A2A30', borderRadius: 'var(--radius-md)' }}>
              {/* Header & Preset Selector */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#F4F4F5', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    REQUEST BUILDER
                  </span>
                  <span style={{ fontSize: 11, color: '#71717A' }}>• Ingress gateway dispatch</span>
                </div>

                {/* Quick Presets */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#71717A' }}>Presets:</span>
                  {demoApiPresets.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onChangeRequest({
                          ...activeRequest,
                          name: p.name,
                          method: p.method,
                          url: p.url,
                          bodyJson: p.body ? JSON.stringify(p.body, null, 2) : '',
                        });
                      }}
                      style={{
                        background: '#202024',
                        border: '1px solid #2A2A30',
                        color: '#A1A1AA',
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      {p.name.split('(')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* URL Bar & Actions */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                {/* Method Selector */}
                <select
                  value={activeRequest.method}
                  onChange={(e) => handleMethodChange(e.target.value as HttpMethod)}
                  className={getMethodClass(activeRequest.method)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontWeight: 800,
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    border: '1px solid #2A2A30',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>

                {/* URL Input */}
                <div style={{ flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', background: '#121216', border: '1px solid #2A2A30', borderRadius: 6, padding: '0 10px' }}>
                  <input
                    type="text"
                    value={activeRequest.url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="Enter request URL (e.g. {{BASE_URL}}/v1/check or https://httpbin.org/get)"
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: '8px 0',
                      color: '#F4F4F5',
                      fontSize: 12.5,
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Client Selector Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#71717A' }}>Client:</span>
                  <select
                    value={activeRequest.clientKey || 'mobile-app-client'}
                    onChange={(e) => handleClientKeyChange(e.target.value)}
                    style={{
                      background: '#202024',
                      border: '1px solid #2A2A30',
                      color: '#F4F4F5',
                      padding: '8px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {clients.map((c) => (
                      <option key={c.clientKey} value={c.clientKey}>
                        {c.clientKey} ({c.algorithm === 'token_bucket' ? `TB: ${c.burstSize}b` : `SW: ${c.requestsPerSecond}r`})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action Buttons: SEND & BURST */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    onClick={onSendRequest}
                    disabled={isLoading}
                    style={{ padding: '8px 18px', fontSize: 13, fontWeight: 800 }}
                    id="send-request-btn"
                  >
                    {isLoading ? (
                      <>
                        <div className="spinner" style={{ width: 14, height: 14 }}></div>
                        <span>SENDING...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>SEND ⚡</span>
                      </>
                    )}
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={onOpenBurst}
                    style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#F97316' }}
                    title="Launch high-concurrency burst test"
                  >
                    <Flame size={14} color="#F97316" />
                    <span>BURST 💥</span>
                  </button>
                </div>
              </div>

              {/* Request Sub-Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #2A2A30', marginBottom: 12, gap: 4 }}>
                <button
                  className={`pm-sidebar-tab ${requestTab === 'params' ? 'active' : ''}`}
                  onClick={() => setRequestTab('params')}
                  style={{ padding: '5px 12px', fontSize: 11.5 }}
                >
                  Params {activeRequest.params.filter((p) => p.enabled && p.key).length > 0 && `(${activeRequest.params.filter((p) => p.enabled && p.key).length})`}
                </button>
                <button
                  className={`pm-sidebar-tab ${requestTab === 'headers' ? 'active' : ''}`}
                  onClick={() => setRequestTab('headers')}
                  style={{ padding: '5px 12px', fontSize: 11.5 }}
                >
                  Headers {activeRequest.headers.filter((h) => h.enabled && h.key).length > 0 && `(${activeRequest.headers.filter((h) => h.enabled && h.key).length})`}
                </button>
                <button
                  className={`pm-sidebar-tab ${requestTab === 'body' ? 'active' : ''}`}
                  onClick={() => setRequestTab('body')}
                  style={{ padding: '5px 12px', fontSize: 11.5 }}
                >
                  Body (JSON)
                </button>
                <button
                  className={`pm-sidebar-tab ${requestTab === 'code' ? 'active' : ''}`}
                  onClick={() => setRequestTab('code')}
                  style={{ padding: '5px 12px', fontSize: 11.5 }}
                >
                  Code Snippet
                </button>
              </div>

              {/* Request Tab Contents */}
              {requestTab === 'params' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#71717A' }}>Query Parameters</span>
                    <button onClick={handleAddParam} style={{ background: 'transparent', border: 'none', color: '#F97316', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Plus size={12} /> Add Parameter
                    </button>
                  </div>
                  {activeRequest.params.length === 0 ? (
                    <div style={{ padding: '10px', textAlign: 'center', color: '#71717A', fontSize: 11.5 }}>
                      No query parameters. Click "+ Add Parameter" to configure.
                    </div>
                  ) : (
                    activeRequest.params.map((param) => (
                      <div key={param.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <input
                          type="checkbox"
                          checked={param.enabled}
                          onChange={(e) => handleUpdateParam(param.id, 'enabled', e.target.checked)}
                        />
                        <input
                          type="text"
                          placeholder="Key"
                          value={param.key}
                          onChange={(e) => handleUpdateParam(param.id, 'key', e.target.value)}
                          style={{ flex: 1, background: '#121216', border: '1px solid #2A2A30', padding: '4px 8px', color: '#F4F4F5', borderRadius: 4, fontSize: 11.5, fontFamily: 'var(--font-mono)' }}
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          value={param.value}
                          onChange={(e) => handleUpdateParam(param.id, 'value', e.target.value)}
                          style={{ flex: 1, background: '#121216', border: '1px solid #2A2A30', padding: '4px 8px', color: '#F4F4F5', borderRadius: 4, fontSize: 11.5, fontFamily: 'var(--font-mono)' }}
                        />
                        <button onClick={() => handleDeleteParam(param.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {requestTab === 'headers' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#71717A' }}>HTTP Request Headers</span>
                    <button onClick={handleAddHeader} style={{ background: 'transparent', border: 'none', color: '#F97316', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Plus size={12} /> Add Header
                    </button>
                  </div>
                  {activeRequest.headers.map((header) => (
                    <div key={header.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={header.enabled}
                        onChange={(e) => handleUpdateHeader(header.id, 'enabled', e.target.checked)}
                      />
                      <input
                        type="text"
                        placeholder="Header (e.g. Accept, Authorization)"
                        value={header.key}
                        onChange={(e) => handleUpdateHeader(header.id, 'key', e.target.value)}
                        style={{ flex: 1, background: '#121216', border: '1px solid #2A2A30', padding: '4px 8px', color: '#F4F4F5', borderRadius: 4, fontSize: 11.5, fontFamily: 'var(--font-mono)' }}
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={header.value}
                        onChange={(e) => handleUpdateHeader(header.id, 'value', e.target.value)}
                        style={{ flex: 1, background: '#121216', border: '1px solid #2A2A30', padding: '4px 8px', color: '#F4F4F5', borderRadius: 4, fontSize: 11.5, fontFamily: 'var(--font-mono)' }}
                      />
                      <button onClick={() => handleDeleteHeader(header.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {requestTab === 'body' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#71717A' }}>JSON Payload</span>
                    <button
                      onClick={() => {
                        try {
                          const parsed = JSON.parse(activeRequest.bodyJson);
                          onChangeRequest({ ...activeRequest, bodyJson: JSON.stringify(parsed, null, 2) });
                        } catch (_) {}
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#38BDF8', fontSize: 11, cursor: 'pointer' }}
                    >
                      Prettify JSON
                    </button>
                  </div>
                  <textarea
                    value={activeRequest.bodyJson}
                    onChange={(e) => onChangeRequest({ ...activeRequest, bodyJson: e.target.value })}
                    placeholder='{\n  "clientKey": "mobile-app-client",\n  "message": "Hello LimiterLab"\n}'
                    rows={4}
                    style={{
                      width: '100%',
                      background: '#121216',
                      border: '1px solid #2A2A30',
                      color: '#22C55E',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      padding: '8px 10px',
                      borderRadius: 6,
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
              )}

              {requestTab === 'code' && (
                <div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {(['curl', 'javascript', 'python', 'go'] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => setSelectedCodeLang(l)}
                        style={{
                          padding: '3px 8px',
                          fontSize: 11,
                          borderRadius: 4,
                          border: 'none',
                          background: selectedCodeLang === l ? '#2A2A30' : 'transparent',
                          color: selectedCodeLang === l ? '#F97316' : '#71717A',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <pre style={{ background: '#121216', border: '1px solid #2A2A30', padding: 10, borderRadius: 6, fontSize: 11.5, fontFamily: 'var(--font-mono)', color: '#F4F4F5', overflowX: 'auto' }}>
                    {generateCodeSnippet(selectedCodeLang)}
                  </pre>
                </div>
              )}
            </div>

            {/* Response Viewer Card */}
            <div
              className="glass-panel"
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '18px 20px',
                background: '#18181C',
                border: '1px solid #2A2A30',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {/* Header Ribbon */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#F4F4F5', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    RESPONSE
                  </span>

                  {latestResponse && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11.5,
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          background: latestResponse.status === 200 || latestResponse.status === 201 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: latestResponse.status === 200 || latestResponse.status === 201 ? '#22C55E' : '#EF4444',
                          border: `1px solid ${latestResponse.status === 200 || latestResponse.status === 201 ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                        }}
                      >
                        {latestResponse.status === 200 || latestResponse.status === 201 ? '🟢' : '🔴'} {latestResponse.status} {latestResponse.statusText}
                      </span>

                      <span style={{ fontSize: 11, color: '#A1A1AA', fontFamily: 'var(--font-mono)' }}>
                        {latestResponse.latencyMs}ms
                      </span>

                      <span style={{ fontSize: 11, color: '#71717A', fontFamily: 'var(--font-mono)' }}>
                        {latestResponse.sizeBytes} B
                      </span>

                      <span style={{ fontSize: 10.5, color: '#71717A' }}>• Node: {latestResponse.instanceId}</span>
                    </div>
                  )}
                </div>

                {latestResponse && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleCopyResponse}
                    style={{ padding: '3px 8px', fontSize: 11 }}
                  >
                    {copiedResponse ? <Check size={12} color="#22C55E" /> : <Copy size={12} />}
                    <span>{copiedResponse ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>

              {/* Response Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #2A2A30', marginBottom: 10, gap: 4 }}>
                <button
                  className={`pm-sidebar-tab ${responseTab === 'body' ? 'active' : ''}`}
                  onClick={() => setResponseTab('body')}
                  style={{ padding: '4px 10px', fontSize: 11 }}
                >
                  Body
                </button>
                <button
                  className={`pm-sidebar-tab ${responseTab === 'headers' ? 'active' : ''}`}
                  onClick={() => setResponseTab('headers')}
                  style={{ padding: '4px 10px', fontSize: 11 }}
                >
                  Headers ({Object.keys(latestResponse?.headers || {}).length})
                </button>
                <button
                  className={`pm-sidebar-tab ${responseTab === 'timeline' ? 'active' : ''}`}
                  onClick={() => setResponseTab('timeline')}
                  style={{ padding: '4px 10px', fontSize: 11 }}
                >
                  Timeline
                </button>
              </div>

              {/* Response Body Contents */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {!latestResponse ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', textAlign: 'center', color: '#71717A', fontSize: 12, minHeight: 180 }}>
                    Ready to dispatch. Click <strong>[ SEND ⚡ ]</strong> or <strong>[ BURST 💥 ]</strong> above.
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {responseTab === 'body' && (
                      <pre
                        style={{
                          flex: 1,
                          background: '#121216',
                          border: '1px solid #2A2A30',
                          padding: '12px 14px',
                          borderRadius: 6,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          color: latestResponse.status === 200 || latestResponse.status === 201 ? '#22C55E' : '#EF4444',
                          minHeight: 200,
                          overflowY: 'auto',
                        }}
                      >
                        {typeof latestResponse.body === 'string'
                          ? latestResponse.body
                          : JSON.stringify(latestResponse.body, null, 2)}
                      </pre>
                    )}

                    {responseTab === 'headers' && (
                      <div style={{ flex: 1, minHeight: 200, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <tbody>
                            {Object.entries(latestResponse.headers).map(([k, v]) => (
                              <tr key={k} style={{ borderBottom: '1px solid rgba(42, 42, 48, 0.4)' }}>
                                <td style={{ padding: '4px 6px', color: '#A1A1AA', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{k}</td>
                                <td style={{ padding: '4px 6px', color: '#F4F4F5', fontFamily: 'var(--font-mono)' }}>{v}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {responseTab === 'timeline' && (
                      <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#71717A' }}>Ingress Gateway Evaluation:</span>
                          <span style={{ color: '#22C55E', fontFamily: 'var(--font-mono)' }}>0.4ms</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#71717A' }}>Redis Lua Atomic Math:</span>
                          <span style={{ color: '#A855F7', fontFamily: 'var(--font-mono)' }}>0.8ms</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#71717A' }}>Round-trip Transmission:</span>
                          <span style={{ color: '#F97316', fontFamily: 'var(--font-mono)' }}>{latestResponse.latencyMs}ms</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: REQUEST TRAFFIC THROUGHPUT & KEY INSIGHTS
          ========================================================================= */}
      <div
        id="traffic"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        {/* REQUEST TRAFFIC Chart */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            background: '#18181C',
            border: '1px solid #2A2A30',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.01em' }}>
                <Activity size={16} color="#F97316" />
                <span>REQUEST TRAFFIC THROUGHPUT</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#71717A', marginTop: 2 }}>
                Real-time throughput stream with smoothed Bezier density
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                <span style={{ width: 9, height: 9, background: '#22C55E', borderRadius: 2 }}></span>
                <span style={{ color: '#A1A1AA' }}>200 ALLOW</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                <span style={{ width: 9, height: 9, background: '#EF4444', borderRadius: 2 }}></span>
                <span style={{ color: '#A1A1AA' }}>429 THROTTLE</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleSimulateTokenConsumption(3)}
                disabled={isConsuming}
                style={{ padding: '4px 10px', fontSize: 11 }}
                title="Send rapid test pulse"
              >
                <Zap size={12} color="#F97316" />
                <span>Traffic Pulse</span>
              </button>
            </div>
          </div>

          <div style={{ height: 210, width: '100%', position: 'relative' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}></canvas>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 11, color: '#71717A' }}>
            <span>Window: Last 45 seconds • 1.0s resolution</span>
            <span style={{ color: '#22C55E', fontWeight: 600 }}>Active Ingress Channel</span>
          </div>
        </div>

        {/* KEY INSIGHTS Card */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            background: '#18181C',
            border: '1px solid #2A2A30',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.01em' }}>
                KEY INSIGHTS
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  padding: '3px 9px',
                  borderRadius: 20,
                  fontSize: 11,
                  color: '#22C55E',
                  fontWeight: 700,
                }}
              >
                <span className="pulse-dot online" style={{ width: 6, height: 6 }}></span>
                <span>LIVE</span>
              </div>
            </div>

            {/* Key Metrics 2x2 Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '12px 14px',
                  background: '#202024',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #2A2A30',
                }}
              >
                <span style={{ fontSize: 11.5, color: '#A1A1AA', fontWeight: 600 }}>Throughput (RPS)</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#F97316', fontFamily: 'var(--font-mono)' }}>
                  {rps}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '12px 14px',
                  background: '#202024',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #2A2A30',
                }}
              >
                <span style={{ fontSize: 11.5, color: '#A1A1AA', fontWeight: 600 }}>Peak Throughput</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#F4F4F5', fontFamily: 'var(--font-mono)' }}>
                  {peakRps}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '12px 14px',
                  background: '#202024',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #2A2A30',
                }}
              >
                <span style={{ fontSize: 11.5, color: '#A1A1AA', fontWeight: 600 }}>429 Throttle Rate</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#EF4444', fontFamily: 'var(--font-mono)' }}>
                  {denyPercentage}%
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '12px 14px',
                  background: '#202024',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #2A2A30',
                }}
              >
                <span style={{ fontSize: 11.5, color: '#A1A1AA', fontWeight: 600 }}>Active Clients</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#A855F7', fontFamily: 'var(--font-mono)' }}>
                  {activeKeysCount}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              padding: '10px 14px',
              background: 'rgba(249, 115, 22, 0.08)',
              border: '1px solid rgba(249, 115, 22, 0.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11.5,
              color: '#F97316',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Telemetry Jitter: &lt;0.5ms</span>
            <span style={{ color: '#22C55E', fontWeight: 700 }}>100% Sync</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 4: LIVE REQUEST ACTIVITY STREAM & SYSTEM HEALTH
          ========================================================================= */}
      <div
        id="activity"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        {/* LIVE REQUEST ACTIVITY Table */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            background: '#18181C',
            border: '1px solid #2A2A30',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.01em' }}>
                LIVE REQUEST ACTIVITY
              </div>
              <div style={{ fontSize: 11.5, color: '#71717A', marginTop: 2 }}>
                Real-time request stream through rate-limiting middleware
              </div>
            </div>

            {/* Filter Buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ALL', '200', '429'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActivityFilter(filter)}
                  style={{
                    background: activityFilter === filter ? '#2A2A30' : '#202024',
                    border: '1px solid #2A2A30',
                    color: activityFilter === filter ? '#F97316' : '#A1A1AA',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, maxHeight: 270, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2A2A30', color: '#71717A', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>TIME</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>METHOD</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>ENDPOINT</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>CLIENT</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>LATENCY</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>TOKENS</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => {
                  const isOk = req.status === 200 || req.status === 201;
                  return (
                    <tr key={req.id} style={{ borderBottom: '1px solid rgba(42, 42, 48, 0.4)', transition: 'background 0.15s ease' }}>
                      <td style={{ padding: '6px 8px', color: '#71717A', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {formatTime(req.timestamp)}
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <span className={getMethodClass(req.method as HttpMethod)} style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>
                          {req.method}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', color: '#F4F4F5', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                        {req.endpoint}
                      </td>
                      <td style={{ padding: '6px 8px', color: '#A1A1AA' }}>
                        {req.clientKey}
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <span
                          style={{
                            color: isOk ? '#22C55E' : '#EF4444',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11.5,
                          }}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', color: '#71717A', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {req.latencyMs}ms
                      </td>
                      <td style={{ padding: '6px 8px', color: isOk ? '#22C55E' : '#EF4444', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {req.remaining ?? '--'}/{req.limit ?? '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SYSTEM HEALTH Card */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            background: '#18181C',
            border: '1px solid #2A2A30',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.01em', marginBottom: 14 }}>
              SYSTEM INFRASTRUCTURE
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {/* API Gateway Card */}
              <div
                style={{
                  background: '#202024',
                  border: '1px solid #2A2A30',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: 'rgba(249, 115, 22, 0.12)',
                    border: '1px solid rgba(249, 115, 22, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Server size={18} color="#F97316" />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#F4F4F5' }}>API Gateway</div>
                  <div style={{ fontSize: 10.5, color: '#71717A', marginTop: 2 }}>Fastify Router</div>
                </div>
                <div
                  style={{
                    marginTop: 'auto',
                    padding: '3px 9px',
                    borderRadius: 12,
                    fontSize: 10,
                    fontWeight: 700,
                    background: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: '#22C55E',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E' }}></span>
                  <span>HEALTHY</span>
                </div>
              </div>

              {/* Redis Cache Card */}
              <div
                style={{
                  background: '#202024',
                  border: '1px solid #2A2A30',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: 'rgba(168, 85, 247, 0.12)',
                    border: '1px solid rgba(168, 85, 247, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Database size={18} color="#A855F7" />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#F4F4F5' }}>Redis Cache</div>
                  <div style={{ fontSize: 10.5, color: '#71717A', marginTop: 2 }}>Lua State Engine</div>
                </div>
                <div
                  style={{
                    marginTop: 'auto',
                    padding: '3px 9px',
                    borderRadius: 12,
                    fontSize: 10,
                    fontWeight: 700,
                    background:
                      health?.services?.redis === 'healthy'
                        ? 'rgba(34, 197, 94, 0.12)'
                        : 'rgba(245, 158, 11, 0.12)',
                    border: `1px solid ${
                      health?.services?.redis === 'healthy'
                        ? 'rgba(34, 197, 94, 0.3)'
                        : 'rgba(245, 158, 11, 0.3)'
                    }`,
                    color: health?.services?.redis === 'healthy' ? '#22C55E' : '#F59E0B',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    textTransform: 'uppercase',
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: health?.services?.redis === 'healthy' ? '#22C55E' : '#F59E0B',
                    }}
                  ></span>
                  <span>{health?.services?.redis || 'healthy'}</span>
                </div>
              </div>

              {/* PostgreSQL Card */}
              <div
                style={{
                  background: '#202024',
                  border: '1px solid #2A2A30',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Globe size={18} color="#38BDF8" />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#F4F4F5' }}>PostgreSQL</div>
                  <div style={{ fontSize: 10.5, color: '#71717A', marginTop: 2 }}>Policy Database</div>
                </div>
                <div
                  style={{
                    marginTop: 'auto',
                    padding: '3px 9px',
                    borderRadius: 12,
                    fontSize: 10,
                    fontWeight: 700,
                    background: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: '#22C55E',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    textTransform: 'uppercase',
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E' }}></span>
                  <span>{health?.database || 'connected'}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, fontSize: 11, color: '#71717A', display: 'flex', justifyContent: 'space-between' }}>
            <span>Instance: {health?.instanceId || 'limiter-01'}</span>
            <span style={{ color: '#22C55E' }}>All services operational</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 5: TOKEN BUCKET SIMULATOR & RATE LIMIT EVENTS LOG
          ========================================================================= */}
      <div
        id="events"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        {/* TOKEN BUCKET Interactive Simulator */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            background: '#18181C',
            border: '1px solid #2A2A30',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} color="#F97316" />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#F4F4F5' }}>TOKEN BUCKET SIMULATOR</span>
            </div>

            {/* Client Policy Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#71717A', fontWeight: 600 }}>Client:</span>
              <select
                value={selectedClientKey}
                onChange={(e) => setSelectedClientKey(e.target.value)}
                style={{
                  background: '#202024',
                  border: '1px solid #2A2A30',
                  color: '#F4F4F5',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 11.5,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {clients.map((c) => (
                  <option key={c.clientKey} value={c.clientKey}>
                    {c.clientKey} ({c.algorithm === 'token_bucket' ? `TB: ${c.burstSize || 20} cap` : `SW: ${c.requestsPerSecond} RPS`})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* API Target Selector Mode (Running API, Public API, Custom, Direct) */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#71717A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Target API to Check & Drain:
              </span>
              <span style={{ fontSize: 10.5, color: '#F97316', fontWeight: 600 }}>
                {activeClientObj.algorithm === 'token_bucket' ? `Token Bucket (${refillRate} RPS / ${burstCapacity} Max)` : 'Sliding Window'}
              </span>
            </div>

            {/* Pill Selector */}
            <div style={{ display: 'flex', gap: 4, background: '#121216', padding: 3, borderRadius: 6, border: '1px solid #2A2A30', marginBottom: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setSimApiSource('workbench')}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                  background: simApiSource === 'workbench' ? '#2A2A30' : 'transparent',
                  color: simApiSource === 'workbench' ? '#F97316' : '#A1A1AA',
                  whiteSpace: 'nowrap',
                }}
              >
                🚀 Active API
              </button>
              <button
                onClick={() => setSimApiSource('check')}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                  background: simApiSource === 'check' ? '#2A2A30' : 'transparent',
                  color: simApiSource === 'check' ? '#A855F7' : '#A1A1AA',
                  whiteSpace: 'nowrap',
                }}
              >
                ⚡ /v1/check
              </button>
            </div>

            {/* Active URL preview bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#121216',
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #2A2A30',
                fontSize: 11,
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(249, 115, 22, 0.2)',
                  color: '#F97316',
                }}
              >
                {activeSimMethod}
              </span>
              <span
                style={{
                  color: '#F4F4F5',
                  fontFamily: 'var(--font-mono)',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
                title={cleanUrl(activeSimUrl)}
              >
                {cleanUrl(activeSimUrl)}
              </span>
            </div>
          </div>

          {/* Interactive Bucket Display */}
          <div style={{ background: '#202024', padding: '16px', borderRadius: 8, border: '1px solid #2A2A30', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
              <span style={{ color: '#A1A1AA' }}>Available Tokens:</span>
              <strong style={{ color: tokens > 3 ? '#22C55E' : '#EF4444', fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                {tokens.toFixed(1)} / {burstCapacity}
              </strong>
            </div>

            {/* Visual Token Reservoir Fill Bar */}
            <div style={{ height: 16, background: '#121216', borderRadius: 8, overflow: 'hidden', border: '1px solid #2A2A30', marginBottom: 10 }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (tokens / burstCapacity) * 100)}%`,
                  background: tokens > 5 ? 'linear-gradient(90deg, #F97316, #22C55E)' : '#EF4444',
                  transition: 'width 0.15s ease',
                  boxShadow: '0 0 10px rgba(249, 115, 22, 0.5)',
                }}
              ></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#71717A' }}>
              <span>Refill: +{refillRate} tokens/sec</span>
              <span>Capacity: {burstCapacity} tokens</span>
            </div>

            {/* Last Execution Result Pill */}
            {lastSimResult && (
              <div
                style={{
                  marginTop: 10,
                  padding: '6px 10px',
                  background: lastSimResult.status === 200 || lastSimResult.status === 201 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${lastSimResult.status === 200 || lastSimResult.status === 201 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  borderRadius: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 11,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: lastSimResult.status === 200 || lastSimResult.status === 201 ? '#22C55E' : '#EF4444',
                    }}
                  >
                    {lastSimResult.status} {lastSimResult.decision}
                  </span>
                  <span style={{ color: '#71717A' }}>•</span>
                  <span style={{ color: '#A1A1AA' }}>{lastSimResult.latencyMs}ms</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', color: '#F4F4F5' }}>
                  {lastSimResult.remaining} tokens in Redis
                </div>
              </div>
            )}
          </div>

          {/* Simulator Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr', gap: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleSimulateTokenConsumption(1)}
              disabled={isConsuming}
              style={{ justifyContent: 'center', padding: '8px 10px', fontSize: 11.5 }}
              title="Execute 1 request to running API through rate limiter gateway"
            >
              <Zap size={13} />
              <span>{isConsuming ? 'Checking...' : 'Drain 1 (Run API)'}</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleSimulateTokenConsumption(5)}
              disabled={isConsuming}
              style={{ justifyContent: 'center', padding: '8px 10px', fontSize: 11.5 }}
              title="Execute 5 concurrent burst requests against API"
            >
              <Flame size={13} color="#EF4444" />
              <span>Drain 5 (Burst)</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleRefillBucket}
              style={{ justifyContent: 'center', padding: '8px 10px', fontSize: 11.5 }}
              title="Reset and refill token capacity"
            >
              <RotateCcw size={13} color="#22C55E" />
              <span>Refill</span>
            </button>
          </div>

          {bucketActionNote && (
            <div
              style={{
                marginTop: 10,
                padding: '6px 10px',
                background: bucketActionNote.includes('Throttled') || bucketActionNote.includes('THROTTLED') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                border: `1px solid ${bucketActionNote.includes('Throttled') || bucketActionNote.includes('THROTTLED') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                borderRadius: 4,
                fontSize: 11,
                color: bucketActionNote.includes('Throttled') || bucketActionNote.includes('THROTTLED') ? '#EF4444' : '#22C55E',
                textAlign: 'center',
                fontWeight: 600,
              }}
            >
              {bucketActionNote}
            </div>
          )}
        </div>

        {/* RATE LIMIT EVENTS STREAM */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            background: '#18181C',
            border: '1px solid #2A2A30',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#F4F4F5' }}>
                RATE LIMIT EVENTS STREAM
              </div>
              <div style={{ fontSize: 11.5, color: '#71717A', marginTop: 2 }}>
                Real-time throttling & capacity notifications
              </div>
            </div>

            {onClearEvents && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={onClearEvents}
                style={{ padding: '3px 8px', fontSize: 11 }}
              >
                Clear Log
              </button>
            )}
          </div>

          <div style={{ flex: 1, maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {events.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#71717A', fontSize: 12 }}>
                No events recorded. System running within limits.
              </div>
            ) : (
              events.map((ev) => {
                const isErr = ev.severity === 'ERROR';
                const isWarn = ev.severity === 'WARN';
                const isSucc = ev.severity === 'SUCCESS';
                const badgeColor = isErr ? '#EF4444' : isWarn ? '#F59E0B' : isSucc ? '#22C55E' : '#38BDF8';

                return (
                  <div
                    key={ev.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: '#202024',
                      border: `1px solid ${isErr ? 'rgba(239, 68, 68, 0.3)' : '#2A2A30'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: `${badgeColor}22`,
                          color: badgeColor,
                          border: `1px solid ${badgeColor}55`,
                        }}
                      >
                        {ev.severity}
                      </span>
                      <span style={{ fontSize: 11.5, color: '#F4F4F5' }}>{ev.message}</span>
                    </div>

                    <div style={{ fontSize: 10, color: '#71717A', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {formatTime(ev.timestamp)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 6: COLLAPSIBLE BOTTOM CONSOLE LOG DRAWER
          ========================================================================= */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#121216',
          borderTop: '1px solid #2A2A30',
          zIndex: 40,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
        }}
      >
        {/* Toggle Bar */}
        <div
          onClick={() => setIsConsoleOpen(!isConsoleOpen)}
          style={{
            padding: '7px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            background: '#18181C',
            borderBottom: isConsoleOpen ? '1px solid #2A2A30' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={14} color="#F97316" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#F4F4F5' }}>
              LimiterLab Console Log ({consoleLogs.length} events)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isConsoleOpen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClearConsoleLogs();
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#EF4444',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Clear Console
              </button>
            )}
            <span style={{ fontSize: 11, color: '#A1A1AA' }}>
              {isConsoleOpen ? '▼ Minimize' : '▲ Open Console'}
            </span>
          </div>
        </div>

        {/* Console Content */}
        {isConsoleOpen && (
          <div style={{ maxHeight: 180, overflowY: 'auto', padding: '10px 20px', background: '#0D0D0F', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
            {consoleLogs.map((log) => (
              <div key={log.id} style={{ marginBottom: 4, color: log.type === 'error' ? '#EF4444' : log.type === 'response' ? '#22C55E' : '#38BDF8' }}>
                <span style={{ color: '#71717A' }}>[{formatTime(log.timestamp)}]</span> {log.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
