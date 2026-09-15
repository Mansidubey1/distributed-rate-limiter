import React, { useState, useEffect } from 'react';
import {
  Send,
  Flame,
  Plus,
  Trash2,
  Copy,
  Check,
  Wand2,
  Globe,
  Sliders,
  Code2,
  Layers,
  KeyRound,
  FileCode
} from 'lucide-react';
import { RequestTemplate, HttpMethod, KeyValueParam } from '../../types/postman';
import { Client } from '../../types';
import { demoApiPresets } from '../../data/defaultCollections';

interface RequestBuilderProps {
  request: RequestTemplate;
  onChangeRequest: (updated: RequestTemplate) => void;
  onSend: () => void;
  onOpenBurst: () => void;
  isLoading: boolean;
  clients: Client[];
  hasLatestResponse?: boolean;
  onViewLatestResponse?: () => void;
}

export const RequestBuilder: React.FC<RequestBuilderProps> = ({
  request,
  onChangeRequest,
  onSend,
  onOpenBurst,
  isLoading,
  clients,
  hasLatestResponse,
  onViewLatestResponse,
}) => {
  const [activeTab, setActiveTab] = useState<'params' | 'auth' | 'headers' | 'body' | 'code'>('params');
  const [selectedCodeLang, setSelectedCodeLang] = useState<'curl' | 'javascript' | 'python' | 'go'>('curl');
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedClientKey, setSelectedClientKey] = useState<string>(request.clientKey || 'mobile-app-client');

  // Sync selectedClientKey with request
  useEffect(() => {
    if (request.clientKey && request.clientKey !== selectedClientKey) {
      setSelectedClientKey(request.clientKey);
    }
  }, [request.clientKey]);

  // Method change
  const handleMethodChange = (method: HttpMethod) => {
    onChangeRequest({ ...request, method });
  };

  // URL change with query parameter extraction
  const handleUrlChange = (url: string) => {
    try {
      if (url.includes('?')) {
        const queryPart = url.split('?')[1];
        const searchParams = new URLSearchParams(queryPart);
        const extractedParams: KeyValueParam[] = [];
        searchParams.forEach((val, key) => {
          extractedParams.push({
            id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            key,
            value: val,
            enabled: true,
          });
        });
        if (extractedParams.length > 0) {
          onChangeRequest({ ...request, url, params: extractedParams });
          return;
        }
      }
    } catch (_) {}
    onChangeRequest({ ...request, url });
  };

  // Body JSON change
  const handleBodyChange = (bodyJson: string) => {
    onChangeRequest({ ...request, bodyJson });
  };

  // Client Key selection change
  const handleClientKeyChange = (clientKey: string) => {
    setSelectedClientKey(clientKey);
    onChangeRequest({ ...request, clientKey });
  };

  // Load Preset Demo API
  const handleSelectPreset = (presetId: string) => {
    const preset = demoApiPresets.find((p) => p.id === presetId);
    if (!preset) return;

    const newHeaders: KeyValueParam[] = preset.headers
      ? Object.entries(preset.headers).map(([k, v], idx) => ({
          id: `h-pre-${idx}`,
          key: k,
          value: v,
          enabled: true,
        }))
      : [];

    const newBodyJson = preset.body ? JSON.stringify(preset.body, null, 2) : '';

    onChangeRequest({
      ...request,
      name: preset.name,
      method: preset.method,
      url: preset.url,
      headers: newHeaders.length > 0 ? newHeaders : request.headers,
      bodyJson: newBodyJson,
      bodyType: preset.body ? 'json' : 'none',
      params: [],
    });

    if (preset.body) {
      setActiveTab('body');
    } else {
      setActiveTab('params');
    }
  };

  // Format JSON
  const formatJson = () => {
    try {
      const parsed = JSON.parse(request.bodyJson);
      onChangeRequest({ ...request, bodyJson: JSON.stringify(parsed, null, 2) });
    } catch (_) {}
  };

  // Quick Client Key template inject
  const injectClientKeyInBody = (clientKey: string) => {
    try {
      let parsed: any = {};
      if (request.bodyJson.trim()) {
        parsed = JSON.parse(request.bodyJson);
      }
      parsed.clientKey = clientKey;
      onChangeRequest({ ...request, bodyJson: JSON.stringify(parsed, null, 2) });
    } catch (_) {
      onChangeRequest({ ...request, bodyJson: JSON.stringify({ clientKey }, null, 2) });
    }
  };

  // Headers Key/Value Add & Update
  const addHeader = () => {
    const newHeaders: KeyValueParam[] = [
      ...request.headers,
      { id: `h-${Date.now()}`, key: '', value: '', enabled: true },
    ];
    onChangeRequest({ ...request, headers: newHeaders });
  };

  const updateHeader = (id: string, field: 'key' | 'value' | 'enabled', val: any) => {
    const updated = request.headers.map((h) => (h.id === id ? { ...h, [field]: val } : h));
    onChangeRequest({ ...request, headers: updated });
  };

  const removeHeader = (id: string) => {
    onChangeRequest({ ...request, headers: request.headers.filter((h) => h.id !== id) });
  };

  // Params Key/Value Add & Update (updates URL search query)
  const addParam = () => {
    const newParams: KeyValueParam[] = [
      ...request.params,
      { id: `p-${Date.now()}`, key: '', value: '', enabled: true },
    ];
    syncUrlWithParams(request.url, newParams);
  };

  const updateParam = (id: string, field: 'key' | 'value' | 'enabled', val: any) => {
    const updated = request.params.map((p) => (p.id === id ? { ...p, [field]: val } : p));
    syncUrlWithParams(request.url, updated);
  };

  const removeParam = (id: string) => {
    const updated = request.params.filter((p) => p.id !== id);
    syncUrlWithParams(request.url, updated);
  };

  const syncUrlWithParams = (baseUrl: string, params: KeyValueParam[]) => {
    const urlWithoutQuery = baseUrl.split('?')[0];
    const searchParams = new URLSearchParams();
    params.forEach((p) => {
      if (p.enabled && p.key.trim()) {
        searchParams.set(p.key.trim(), p.value);
      }
    });
    const queryString = searchParams.toString();
    const finalUrl = queryString ? `${urlWithoutQuery}?${queryString}` : urlWithoutQuery;
    onChangeRequest({ ...request, url: finalUrl, params });
  };

  // Find active client config
  const activeClient = clients.find((c) => c.clientKey === selectedClientKey) || clients[0] || null;

  // Method Colors
  const getMethodColor = (m: HttpMethod) => {
    switch (m) {
      case 'GET': return '#22C55E';
      case 'POST': return '#F59E0B';
      case 'PUT': return '#A855F7';
      case 'PATCH': return '#6366F1';
      case 'DELETE': return '#EF4444';
      case 'HEAD': return '#14B8A6';
      case 'OPTIONS': return '#94A3B8';
      default: return '#22C55E';
    }
  };

  // Code Generation
  const generateSnippet = () => {
    const effectiveUrl = request.url;
    const isExternal = effectiveUrl.startsWith('http://') || effectiveUrl.startsWith('https://');

    if (selectedCodeLang === 'curl') {
      if (isExternal && !effectiveUrl.includes('localhost:3000') && !effectiveUrl.includes('/v1/check')) {
        // Calling via LimiterLab Gateway
        let curl = `curl -X POST "http://localhost:3000/v1/proxy" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "url": "${effectiveUrl}",\n    "method": "${request.method}",\n    "clientKey": "${selectedClientKey}"`;
        if (request.headers.filter((h) => h.enabled && h.key).length > 0) {
          const hdrs: Record<string, string> = {};
          request.headers.filter((h) => h.enabled && h.key).forEach((h) => { hdrs[h.key] = h.value; });
          curl += `,\n    "headers": ${JSON.stringify(hdrs, null, 6)}`;
        }
        if (request.bodyType === 'json' && request.bodyJson.trim()) {
          try {
            curl += `,\n    "body": ${JSON.stringify(JSON.parse(request.bodyJson), null, 6)}`;
          } catch (_) {
            curl += `,\n    "body": ${JSON.stringify(request.bodyJson)}`;
          }
        }
        curl += `\n  }'`;
        return curl;
      }

      // Direct cURL
      let curl = `curl -X ${request.method} "${effectiveUrl}"`;
      request.headers.filter((h) => h.enabled && h.key).forEach((h) => {
        curl += ` \\\n  -H "${h.key}: ${h.value}"`;
      });
      if (request.authType === 'bearer' && request.bearerToken) {
        curl += ` \\\n  -H "Authorization: Bearer ${request.bearerToken}"`;
      }
      if (request.method !== 'GET' && request.bodyJson.trim()) {
        curl += ` \\\n  -d '${request.bodyJson.replace(/'/g, "\\'")}'`;
      }
      return curl;
    }

    if (selectedCodeLang === 'javascript') {
      return `// Send request through LimiterLab Gateway
const response = await fetch('http://localhost:3000/v1/proxy', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: '${effectiveUrl}',
    method: '${request.method}',
    clientKey: '${selectedClientKey}',
    headers: {
${request.headers.filter((h) => h.enabled && h.key).map((h) => `      '${h.key}': '${h.value}'`).join(',\n')}
    },
    ${request.bodyType === 'json' && request.bodyJson.trim() ? `body: ${request.bodyJson}` : ''}
  })
});

const data = await response.json();
console.log('Gateway Decision:', data.decision);
console.log('Upstream Status:', data.statusCode);
console.log('Remaining Tokens:', data.rateLimit?.remaining);
console.log('Response Payload:', data.body);`;
    }

    if (selectedCodeLang === 'python') {
      return `# Send request through LimiterLab Gateway
import requests

payload = {
    "url": "${effectiveUrl}",
    "method": "${request.method}",
    "clientKey": "${selectedClientKey}",
    "headers": {
${request.headers.filter((h) => h.enabled && h.key).map((h) => `        "${h.key}": "${h.value}"`).join(',\n')}
    },
    ${request.bodyType === 'json' && request.bodyJson.trim() ? `"body": ${request.bodyJson}` : ''}
}

response = requests.post("http://localhost:3000/v1/proxy", json=payload)
data = response.json()

print(f"Decision: {data.get('decision')}")
print(f"Status: {data.get('statusCode')}")
print(f"Remaining: {data.get('rateLimit', {}).get('remaining')}")
print(data.get('body'))`;
    }

    if (selectedCodeLang === 'go') {
      return `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"io"
)

func main() {
	payload := map[string]interface{}{
		"url":       "${effectiveUrl}",
		"method":    "${request.method}",
		"clientKey": "${selectedClientKey}",
	}

	bodyBytes, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "http://localhost:3000/v1/proxy", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("Gateway Response: %s\\n", string(body))
}`;
    }

    return '';
  };

  const copySnippet = () => {
    navigator.clipboard.writeText(generateSnippet());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="pm-pane">
      {/* 1. Preset Selector & Client Policy Ribbon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          background: '#0D0D11',
          borderBottom: '1px solid #1E1E24',
          fontSize: 11.5,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {/* Preset Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={13} color="#3B82F6" />
          <span style={{ color: '#71717A', fontWeight: 600 }}>Demo API Presets:</span>
          <select
            onChange={(e) => e.target.value && handleSelectPreset(e.target.value)}
            defaultValue=""
            style={{
              background: '#18181C',
              border: '1px solid #2A2A30',
              color: '#F4F4F5',
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: 11,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="" disabled>
              Load a real-world API...
            </option>
            {demoApiPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Client Key & Algorithm Policy Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sliders size={12} color="#A855F7" />
            <span style={{ color: '#71717A', fontWeight: 600 }}>Rate Limit Client:</span>
            <select
              value={selectedClientKey}
              onChange={(e) => handleClientKeyChange(e.target.value)}
              style={{
                background: '#18181C',
                border: '1px solid #2A2A30',
                color: '#A855F7',
                fontWeight: 700,
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 11,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {clients.map((c) => (
                <option key={c.clientKey} value={c.clientKey}>
                  {c.clientKey} ({c.algorithm === 'token_bucket' ? 'Token Bucket' : 'Sliding Window'})
                </option>
              ))}
              <option value="custom-gateway-client">+ custom-gateway-client</option>
            </select>
          </div>

          {activeClient && (
            <span
              style={{
                background: '#1E1E26',
                border: '1px solid #2E2E38',
                borderRadius: 4,
                padding: '2px 7px',
                color: '#F97316',
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
              }}
            >
              {activeClient.algorithm === 'token_bucket'
                ? `⚡ Capacity: ${activeClient.burstSize} | +${activeClient.requestsPerSecond}/s`
                : `🌊 Quota: ${activeClient.requestsPerSecond} req / ${activeClient.windowSize}s`}
            </span>
          )}
        </div>
      </div>

      {/* 2. Top URL Action Bar: Method + URL + Send + Burst */}
      <div className="pm-url-bar-container">
        {/* Method Select */}
        <select
          className="pm-method-select"
          value={request.method}
          onChange={(e) => handleMethodChange(e.target.value as HttpMethod)}
          style={{
            color: getMethodColor(request.method),
            fontWeight: 800,
          }}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
          <option value="HEAD">HEAD</option>
          <option value="OPTIONS">OPTIONS</option>
        </select>

        {/* URL Input */}
        <div className="pm-url-input-wrapper">
          <input
            type="text"
            className="pm-url-input"
            value={request.url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Enter ANY HTTP API (e.g. https://jsonplaceholder.typicode.com/posts/1)"
            spellCheck={false}
          />
        </div>

        {/* Action Buttons */}
        <div className="pm-url-actions">
          <button
            className="btn btn-send"
            onClick={onSend}
            disabled={isLoading}
            title="Execute Request through Rate Limiter Gateway"
          >
            <Send size={13} />
            <span>{isLoading ? 'SENDING...' : 'SEND'}</span>
          </button>

          <button
            className="btn btn-burst"
            onClick={onOpenBurst}
            title="Send High-Concurrency Burst Traffic"
          >
            <Flame size={13} />
            <span>BURST</span>
          </button>
        </div>
      </div>

      {/* 3. Request Tabs Header */}
      <div className="pm-pane-header">
        <div className="pm-tab-strip">
          <button
            className={`pm-tab ${activeTab === 'params' ? 'active' : ''}`}
            onClick={() => setActiveTab('params')}
          >
            <Layers size={11} />
            <span>Params ({request.params.filter((p) => p.enabled).length})</span>
          </button>

          <button
            className={`pm-tab ${activeTab === 'auth' ? 'active' : ''}`}
            onClick={() => setActiveTab('auth')}
          >
            <KeyRound size={11} />
            <span>Auth</span>
          </button>

          <button
            className={`pm-tab ${activeTab === 'headers' ? 'active' : ''}`}
            onClick={() => setActiveTab('headers')}
          >
            <Code2 size={11} />
            <span>Headers ({request.headers.filter((h) => h.enabled).length})</span>
          </button>

          <button
            className={`pm-tab ${activeTab === 'body' ? 'active' : ''}`}
            onClick={() => setActiveTab('body')}
          >
            <FileCode size={11} />
            <span>Body</span>
          </button>

          <button
            className={`pm-tab ${activeTab === 'code' ? 'active' : ''}`}
            onClick={() => setActiveTab('code')}
          >
            <Code2 size={11} />
            <span>Code Snippet</span>
          </button>
        </div>

        {hasLatestResponse && onViewLatestResponse && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onViewLatestResponse}
            style={{ fontSize: 11, padding: '4px 10px', gap: 5, color: '#F97316' }}
            title="View latest gateway response snapshot"
          >
            <span>View Response</span>
            <span>→</span>
          </button>
        )}
      </div>

      {/* 4. Request Pane Body */}
      <div className="pm-pane-body">
        {/* Tab: Params */}
        {activeTab === 'params' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: '#71717A' }}>URL Query Parameters (Synchronized with URL)</span>
              <button className="btn btn-secondary btn-sm" onClick={addParam}>
                <Plus size={12} color="#F97316" /> Add Param
              </button>
            </div>

            <table className="pm-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Key</th>
                  <th>Value</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {request.params.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: '#52525B', padding: 18 }}>
                      No query parameters configured. Click <strong>Add Param</strong> or append <code>?key=val</code> in the URL above.
                    </td>
                  </tr>
                ) : (
                  request.params.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={(e) => updateParam(p.id, 'enabled', e.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="Key"
                          value={p.key}
                          onChange={(e) => updateParam(p.id, 'key', e.target.value)}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: '#F4F4F5', outline: 'none' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="Value"
                          value={p.value}
                          onChange={(e) => updateParam(p.id, 'value', e.target.value)}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: '#F4F4F5', outline: 'none' }}
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => removeParam(p.id)}
                          style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Auth */}
        {activeTab === 'auth' && (
          <div style={{ maxWidth: 450 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 6, display: 'block' }}>
                Authorization Type:
              </label>
              <select
                value={request.authType}
                onChange={(e) => onChangeRequest({ ...request, authType: e.target.value as any })}
                style={{ width: '100%', padding: '8px 10px', background: '#121216', border: '1px solid #2A2A30', color: '#F4F4F5', borderRadius: 6 }}
              >
                <option value="none">No Auth (Public)</option>
                <option value="bearer">Bearer Token (Forward Authorization Header)</option>
                <option value="apikey">API Key Header</option>
              </select>
            </div>

            {request.authType === 'bearer' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 6, display: 'block' }}>
                  Bearer Token:
                </label>
                <input
                  type="text"
                  placeholder="e.g. {{ADMIN_API_KEY}} or eyJhbGciOi..."
                  value={request.bearerToken || ''}
                  onChange={(e) => onChangeRequest({ ...request, bearerToken: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', background: '#121216', border: '1px solid #2A2A30', color: '#F4F4F5', borderRadius: 6 }}
                />
              </div>
            )}

            {request.authType === 'apikey' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 4, display: 'block' }}>
                    Header Name:
                  </label>
                  <input
                    type="text"
                    placeholder="X-API-Key"
                    value={request.apiKeyName || 'X-API-Key'}
                    onChange={(e) => onChangeRequest({ ...request, apiKeyName: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#121216', border: '1px solid #2A2A30', color: '#F4F4F5', borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 4, display: 'block' }}>
                    API Key Value:
                  </label>
                  <input
                    type="text"
                    placeholder="key_live_..."
                    value={request.apiKeyValue || ''}
                    onChange={(e) => onChangeRequest({ ...request, apiKeyValue: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', background: '#121216', border: '1px solid #2A2A30', color: '#F4F4F5', borderRadius: 6 }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Headers */}
        {activeTab === 'headers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: '#71717A' }}>Forwarded HTTP Request Headers</span>
              <button className="btn btn-secondary btn-sm" onClick={addHeader}>
                <Plus size={12} color="#F97316" /> Add Header
              </button>
            </div>

            <table className="pm-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Header Name</th>
                  <th>Value</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {request.headers.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: '#52525B', padding: 18 }}>
                      No custom headers. Click <strong>Add Header</strong> to include custom headers.
                    </td>
                  </tr>
                ) : (
                  request.headers.map((h) => (
                    <tr key={h.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={h.enabled}
                          onChange={(e) => updateHeader(h.id, 'enabled', e.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="Header (e.g. Content-Type)"
                          value={h.key}
                          onChange={(e) => updateHeader(h.id, 'key', e.target.value)}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: '#F4F4F5', outline: 'none' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="Value"
                          value={h.value}
                          onChange={(e) => updateHeader(h.id, 'value', e.target.value)}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: '#F4F4F5', outline: 'none' }}
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => removeHeader(h.id)}
                          style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Body */}
        {activeTab === 'body' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Quick Helper Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#71717A' }}>Inject clientKey:</span>
                <select
                  onChange={(e) => e.target.value && injectClientKeyInBody(e.target.value)}
                  defaultValue=""
                  style={{
                    background: '#202024',
                    border: '1px solid #2A2A30',
                    color: '#F4F4F5',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: 11,
                    outline: 'none',
                  }}
                >
                  <option value="" disabled>
                    Select client...
                  </option>
                  {clients.map((c) => (
                    <option key={c.clientKey} value={c.clientKey}>
                      {c.clientKey}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={formatJson} style={{ padding: '3px 8px', fontSize: 11 }}>
                  <Wand2 size={11} color="#FB923C" /> Format JSON
                </button>
              </div>
            </div>

            {/* Code Textarea */}
            <textarea
              className="pm-code-editor"
              value={request.bodyJson}
              onChange={(e) => handleBodyChange(e.target.value)}
              placeholder="{\n  &quot;title&quot;: &quot;Post Title&quot;,\n  &quot;body&quot;: &quot;Content&quot;\n}"
              spellCheck={false}
            />
          </div>
        )}

        {/* Tab: Code Generator */}
        {activeTab === 'code' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['curl', 'javascript', 'python', 'go'] as const).map((lang) => (
                  <button
                    key={lang}
                    className={`btn btn-sm ${selectedCodeLang === lang ? 'btn-send' : 'btn-secondary'}`}
                    onClick={() => setSelectedCodeLang(lang)}
                    style={{ fontSize: 11, textTransform: 'capitalize' }}
                  >
                    {lang === 'javascript' ? 'JavaScript (Fetch)' : lang === 'curl' ? 'cURL' : lang}
                  </button>
                ))}
              </div>

              <button className="btn btn-secondary btn-sm" onClick={copySnippet} style={{ padding: '3px 9px', fontSize: 11 }}>
                {copiedCode ? <Check size={11} color="#22C55E" /> : <Copy size={11} />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <div
              style={{
                background: '#121216',
                border: '1px solid #2A2A30',
                borderRadius: 6,
                padding: 14,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: '#F4F4F5',
                overflowX: 'auto',
                lineHeight: 1.55,
              }}
            >
              <pre>{generateSnippet()}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
