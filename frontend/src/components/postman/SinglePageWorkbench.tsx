import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Flame,
  Copy,
  Check,
  Activity,
  Plus,
  Trash2
} from 'lucide-react';
import {
  RequestTemplate,
  ResponseSnapshot,
  HttpMethod,
  KeyValueParam
} from '../../types/postman';
import { Client } from '../../types';
import { demoApiPresets } from '../../data/defaultCollections';

interface SinglePageWorkbenchProps {
  request: RequestTemplate;
  onChangeRequest: (updated: RequestTemplate) => void;
  onSend: () => void;
  onOpenBurst: () => void;
  isLoading: boolean;
  latestResponse: ResponseSnapshot | null;
  clients: Client[];
  rps: number;
  chartHistory: { allowed: number; denied: number }[];
  onConsumeTokenDirect?: (clientKey: string, count: number) => void;
}

export const SinglePageWorkbench: React.FC<SinglePageWorkbenchProps> = ({
  request,
  onChangeRequest,
  onSend,
  onOpenBurst,
  isLoading,
  latestResponse,
  clients,
  rps,
  chartHistory,
}) => {
  // Request Builder Tabs
  const [requestTab, setRequestTab] = useState<'params' | 'headers' | 'body' | 'code'>('params');
  const [selectedCodeLang, setSelectedCodeLang] = useState<'curl' | 'javascript' | 'python' | 'go'>('curl');

  // Response Viewer Tabs
  const [responseTab, setResponseTab] = useState<'body' | 'headers' | 'timeline'>('body');
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);

  // Canvas Ref for Request Traffic Graph
  const canvasRef = useRef<HTMLCanvasElement | null>(null);


  // Real-time Smooth Canvas Throughput Graph
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

    const history = chartHistory.length > 0
      ? chartHistory
      : Array.from({ length: 45 }, () => ({
          allowed: 0,
          denied: 0,
        }));

    const step = w / Math.max(1, history.length - 1);
    let maxVal = 50;
    history.forEach((pt) => {
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
    if (history.length > 1) {
      const allowGrad = ctx.createLinearGradient(0, 0, 0, h);
      allowGrad.addColorStop(0, 'rgba(34, 197, 94, 0.28)');
      allowGrad.addColorStop(1, 'rgba(34, 197, 94, 0.0)');

      ctx.beginPath();
      ctx.moveTo(0, h);
      history.forEach((pt, i) => {
        const x = i * step;
        const y = h - (pt.allowed / maxVal) * (h - 25 * dpr) - 8 * dpr;
        if (i === 0) ctx.lineTo(x, y);
        else {
          const prevX = (i - 1) * step;
          const prevY = h - (history[i - 1].allowed / maxVal) * (h - 25 * dpr) - 8 * dpr;
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
      history.forEach((pt, i) => {
        const x = i * step;
        const y = h - (pt.allowed / maxVal) * (h - 25 * dpr) - 8 * dpr;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prevX = (i - 1) * step;
          const prevY = h - (history[i - 1].allowed / maxVal) * (h - 25 * dpr) - 8 * dpr;
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 429 THROTTLE Curve (Ruby Red)
    if (history.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.8 * dpr;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
      ctx.shadowBlur = 5 * dpr;
      history.forEach((pt, i) => {
        const x = i * step;
        const y = h - (pt.denied / maxVal) * (h - 25 * dpr) - 8 * dpr;
        if (i === 0) ctx.lineTo(x, y);
        else {
          const prevX = (i - 1) * step;
          const prevY = h - (history[i - 1].denied / maxVal) * (h - 25 * dpr) - 8 * dpr;
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [chartHistory]);

  // Request changes
  const handleMethodChange = (method: HttpMethod) => {
    onChangeRequest({ ...request, method });
  };

  const handleUrlChange = (url: string) => {
    onChangeRequest({ ...request, url });
  };

  const handleClientKeyChange = (clientKey: string) => {
    onChangeRequest({ ...request, clientKey });
  };

  const handleAddParam = () => {
    const newParam: KeyValueParam = {
      id: `p-${Date.now()}`,
      key: '',
      value: '',
      enabled: true,
    };
    onChangeRequest({ ...request, params: [...request.params, newParam] });
  };

  const handleUpdateParam = (id: string, field: 'key' | 'value' | 'enabled', val: any) => {
    const updated = request.params.map((p) => (p.id === id ? { ...p, [field]: val } : p));
    onChangeRequest({ ...request, params: updated });
  };

  const handleDeleteParam = (id: string) => {
    onChangeRequest({ ...request, params: request.params.filter((p) => p.id !== id) });
  };

  const handleAddHeader = () => {
    const newHeader: KeyValueParam = {
      id: `h-${Date.now()}`,
      key: '',
      value: '',
      enabled: true,
    };
    onChangeRequest({ ...request, headers: [...request.headers, newHeader] });
  };

  const handleUpdateHeader = (id: string, field: 'key' | 'value' | 'enabled', val: any) => {
    const updated = request.headers.map((h) => (h.id === id ? { ...h, [field]: val } : h));
    onChangeRequest({ ...request, headers: updated });
  };

  const handleDeleteHeader = (id: string) => {
    onChangeRequest({ ...request, headers: request.headers.filter((h) => h.id !== id) });
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
    const clientKey = request.clientKey || 'mobile-app-client';
    switch (lang) {
      case 'curl':
        return `curl -X ${request.method} "${request.url}" \\\n  -H "x-client-key: ${clientKey}" \\\n  -H "Content-Type: application/json"${
          request.method !== 'GET' && request.bodyJson ? ` \\\n  -d '${request.bodyJson.replace(/'/g, "'\\''")}'` : ''
        }`;
      case 'javascript':
        return `// JavaScript (Fetch)\nconst response = await fetch("${request.url}", {\n  method: "${request.method}",\n  headers: {\n    "x-client-key": "${clientKey}",\n    "Content-Type": "application/json"\n  },\n  body: ${
          request.method !== 'GET' && request.bodyJson ? JSON.stringify(request.bodyJson) : 'undefined'
        }\n});\nconst data = await response.json();\nconsole.log(data);`;
      case 'python':
        return `# Python (Requests)\nimport requests\n\nheaders = {\n    "x-client-key": "${clientKey}",\n    "Content-Type": "application/json"\n}\n\nresponse = requests.${request.method.toLowerCase()}("${request.url}", headers=headers${
          request.method !== 'GET' && request.bodyJson ? `, json=${request.bodyJson}` : ''
        })\nprint(response.status_code, response.json())`;
      case 'go':
        return `// Go (net/http)\npackage main\n\nimport (\n\t"net/http"\n\t"fmt"\n)\n\nfunc main() {\n\treq, _ := http.NewRequest("${request.method}", "${request.url}", nil)\n\treq.Header.Set("x-client-key", "${clientKey}")\n\tres, _ := http.DefaultClient.Do(req)\n\tfmt.Println(res.Status)\n}`;
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

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* =========================================================================
          SECTION 1: REQUEST BUILDER
          ========================================================================= */}
      <div className="glass-panel" style={{ padding: '18px 20px', background: '#18181C', border: '1px solid #2A2A30', borderRadius: 'var(--radius-md)' }}>
        {/* Header & Preset Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#F4F4F5', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              REQUEST BUILDER
            </span>
            <span style={{ fontSize: 11, color: '#71717A' }}>• Dispatch through distributed gateway</span>
          </div>

          {/* Quick Preset Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#71717A' }}>Presets:</span>
            {demoApiPresets.slice(0, 3).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onChangeRequest({
                    ...request,
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          {/* Method Dropdown */}
          <select
            value={request.method}
            onChange={(e) => handleMethodChange(e.target.value as HttpMethod)}
            className={getMethodClass(request.method)}
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
          <div style={{ flex: 1, minWidth: 260, display: 'flex', alignItems: 'center', background: '#121216', border: '1px solid #2A2A30', borderRadius: 6, padding: '0 10px' }}>
            <input
              type="text"
              value={request.url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="Enter request URL (e.g. {{BASE_URL}}/v1/check or https://httpbin.org/get)"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '9px 0',
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
              value={request.clientKey || 'mobile-app-client'}
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
              onClick={onSend}
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

        {/* Request Tabs Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid #2A2A30', marginBottom: 14, gap: 4 }}>
          <button
            className={`pm-sidebar-tab ${requestTab === 'params' ? 'active' : ''}`}
            onClick={() => setRequestTab('params')}
            style={{ padding: '6px 14px', fontSize: 12 }}
          >
            Params {request.params.filter((p) => p.enabled && p.key).length > 0 && `(${request.params.filter((p) => p.enabled && p.key).length})`}
          </button>
          <button
            className={`pm-sidebar-tab ${requestTab === 'headers' ? 'active' : ''}`}
            onClick={() => setRequestTab('headers')}
            style={{ padding: '6px 14px', fontSize: 12 }}
          >
            Headers {request.headers.filter((h) => h.enabled && h.key).length > 0 && `(${request.headers.filter((h) => h.enabled && h.key).length})`}
          </button>
          <button
            className={`pm-sidebar-tab ${requestTab === 'body' ? 'active' : ''}`}
            onClick={() => setRequestTab('body')}
            style={{ padding: '6px 14px', fontSize: 12 }}
          >
            Body (JSON)
          </button>
          <button
            className={`pm-sidebar-tab ${requestTab === 'code' ? 'active' : ''}`}
            onClick={() => setRequestTab('code')}
            style={{ padding: '6px 14px', fontSize: 12 }}
          >
            Code Snippet
          </button>
        </div>

        {/* Request Tab Contents */}
        {requestTab === 'params' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#71717A' }}>Query Parameters</span>
              <button onClick={handleAddParam} style={{ background: 'transparent', border: 'none', color: '#F97316', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={12} /> Add Parameter
              </button>
            </div>
            {request.params.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: '#71717A', fontSize: 12 }}>
                No query parameters added yet. Click "+ Add Parameter" above.
              </div>
            ) : (
              request.params.map((param) => (
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
                    style={{ flex: 1, background: '#121216', border: '1px solid #2A2A30', padding: '5px 8px', color: '#F4F4F5', borderRadius: 4, fontSize: 11.5, fontFamily: 'var(--font-mono)' }}
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={param.value}
                    onChange={(e) => handleUpdateParam(param.id, 'value', e.target.value)}
                    style={{ flex: 1, background: '#121216', border: '1px solid #2A2A30', padding: '5px 8px', color: '#F4F4F5', borderRadius: 4, fontSize: 11.5, fontFamily: 'var(--font-mono)' }}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#71717A' }}>HTTP Headers</span>
              <button onClick={handleAddHeader} style={{ background: 'transparent', border: 'none', color: '#F97316', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={12} /> Add Header
              </button>
            </div>
            {request.headers.map((header) => (
              <div key={header.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={header.enabled}
                  onChange={(e) => handleUpdateHeader(header.id, 'enabled', e.target.checked)}
                />
                <input
                  type="text"
                  placeholder="Header Name (e.g. Accept, Authorization)"
                  value={header.key}
                  onChange={(e) => handleUpdateHeader(header.id, 'key', e.target.value)}
                  style={{ flex: 1, background: '#121216', border: '1px solid #2A2A30', padding: '5px 8px', color: '#F4F4F5', borderRadius: 4, fontSize: 11.5, fontFamily: 'var(--font-mono)' }}
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => handleUpdateHeader(header.id, 'value', e.target.value)}
                  style={{ flex: 1, background: '#121216', border: '1px solid #2A2A30', padding: '5px 8px', color: '#F4F4F5', borderRadius: 4, fontSize: 11.5, fontFamily: 'var(--font-mono)' }}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#71717A' }}>JSON Payload</span>
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(request.bodyJson);
                    onChangeRequest({ ...request, bodyJson: JSON.stringify(parsed, null, 2) });
                  } catch (_) {}
                }}
                style={{ background: 'transparent', border: 'none', color: '#38BDF8', fontSize: 11, cursor: 'pointer' }}
              >
                Prettify JSON
              </button>
            </div>
            <textarea
              value={request.bodyJson}
              onChange={(e) => onChangeRequest({ ...request, bodyJson: e.target.value })}
              placeholder='{\n  "clientKey": "mobile-app-client",\n  "message": "Hello LimiterLab"\n}'
              rows={5}
              style={{
                width: '100%',
                background: '#121216',
                border: '1px solid #2A2A30',
                color: '#22C55E',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                padding: '10px 12px',
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
            <pre style={{ background: '#121216', border: '1px solid #2A2A30', padding: 12, borderRadius: 6, fontSize: 11.5, fontFamily: 'var(--font-mono)', color: '#F4F4F5', overflowX: 'auto' }}>
              {generateCodeSnippet(selectedCodeLang)}
            </pre>
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION 2: RESPONSE
          ========================================================================= */}
      <div className="glass-panel" style={{ padding: '18px 20px', background: '#18181C', border: '1px solid #2A2A30', borderRadius: 'var(--radius-md)' }}>
        {/* Header Ribbon */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#F4F4F5', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              RESPONSE
            </span>

            {latestResponse && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 9px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    background: latestResponse.status === 200 || latestResponse.status === 201 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: latestResponse.status === 200 || latestResponse.status === 201 ? '#22C55E' : '#EF4444',
                    border: `1px solid ${latestResponse.status === 200 || latestResponse.status === 201 ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                  }}
                >
                  {latestResponse.status === 200 || latestResponse.status === 201 ? '🟢' : '🔴'} {latestResponse.status} {latestResponse.statusText}
                </span>

                <span style={{ fontSize: 11.5, color: '#A1A1AA', fontFamily: 'var(--font-mono)' }}>
                  {latestResponse.latencyMs}ms
                </span>

                <span style={{ fontSize: 11.5, color: '#71717A', fontFamily: 'var(--font-mono)' }}>
                  {latestResponse.sizeBytes} B
                </span>

                <span style={{ fontSize: 11, color: '#71717A' }}>• Node: {latestResponse.instanceId}</span>
              </div>
            )}
          </div>

          {latestResponse && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCopyResponse}
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              {copiedResponse ? <Check size={12} color="#22C55E" /> : <Copy size={12} />}
              <span>{copiedResponse ? 'Copied' : 'Copy JSON'}</span>
            </button>
          )}
        </div>

        {/* Response Tabs Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid #2A2A30', marginBottom: 12, gap: 4 }}>
          <button
            className={`pm-sidebar-tab ${responseTab === 'body' ? 'active' : ''}`}
            onClick={() => setResponseTab('body')}
            style={{ padding: '5px 12px', fontSize: 11.5 }}
          >
            Body
          </button>
          <button
            className={`pm-sidebar-tab ${responseTab === 'headers' ? 'active' : ''}`}
            onClick={() => setResponseTab('headers')}
            style={{ padding: '5px 12px', fontSize: 11.5 }}
          >
            Headers
          </button>
          <button
            className={`pm-sidebar-tab ${responseTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setResponseTab('timeline')}
            style={{ padding: '5px 12px', fontSize: 11.5 }}
          >
            Timeline
          </button>
        </div>

        {/* Response Content */}
        {!latestResponse ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: '#71717A', fontSize: 12 }}>
            Ready to dispatch. Click <strong>[ SEND ⚡ ]</strong> or <strong>[ BURST 💥 ]</strong> above to test rate limiting.
          </div>
        ) : (
          <div>
            {responseTab === 'body' && (
              <pre
                style={{
                  background: '#121216',
                  border: '1px solid #2A2A30',
                  padding: '12px 14px',
                  borderRadius: 6,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: latestResponse.status === 200 || latestResponse.status === 201 ? '#22C55E' : '#EF4444',
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                {typeof latestResponse.body === 'string'
                  ? latestResponse.body
                  : JSON.stringify(latestResponse.body, null, 2)}
              </pre>
            )}

            {responseTab === 'headers' && (
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <tbody>
                    {Object.entries(latestResponse.headers).map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: '1px solid rgba(42, 42, 48, 0.4)' }}>
                        <td style={{ padding: '5px 8px', color: '#A1A1AA', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{k}</td>
                        <td style={{ padding: '5px 8px', color: '#F4F4F5', fontFamily: 'var(--font-mono)' }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {responseTab === 'timeline' && (
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
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

      {/* =========================================================================
          SECTION 3: REQUEST TRAFFIC THROUGHPUT GRAPH (After Response)
          ========================================================================= */}
      <div className="glass-panel" style={{ padding: '18px 20px', background: '#18181C', border: '1px solid #2A2A30', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: '#F4F4F5', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              <Activity size={15} color="#F97316" />
              <span>REQUEST TRAFFIC THROUGHPUT</span>
            </div>
            <div style={{ fontSize: 11, color: '#71717A', marginTop: 2 }}>
              Real-time cluster throughput stream (1.0s resolution)
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, background: '#22C55E', borderRadius: 2 }}></span>
              <span style={{ color: '#A1A1AA' }}>200 ALLOW</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, background: '#EF4444', borderRadius: 2 }}></span>
              <span style={{ color: '#A1A1AA' }}>429 THROTTLE</span>
            </div>
            <span style={{ color: '#F97316', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {rps} RPS
            </span>
          </div>
        </div>

        <div style={{ height: 160, width: '100%', position: 'relative' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}></canvas>
        </div>
      </div>
    </div>
  );
};
