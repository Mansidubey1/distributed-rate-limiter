import React, { useState } from 'react';
import {
  Send,
  Flame,
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Check,
  Wand2
} from 'lucide-react';
import { RequestTemplate, HttpMethod, KeyValueParam } from '../../types/postman';
import { Client } from '../../types';

interface RequestBuilderProps {
  request: RequestTemplate;
  onChangeRequest: (updated: RequestTemplate) => void;
  onSend: () => void;
  onOpenBurst: () => void;
  onOpenVisualize: () => void;
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
  onOpenVisualize,
  isLoading,
  clients,
  hasLatestResponse,
  onViewLatestResponse,
}) => {
  const [activeTab, setActiveTab] = useState<'params' | 'auth' | 'headers' | 'body' | 'code'>('body');
  const [copiedCode, setCopiedCode] = useState(false);

  // Method change
  const handleMethodChange = (method: HttpMethod) => {
    onChangeRequest({ ...request, method });
  };

  // URL change
  const handleUrlChange = (url: string) => {
    onChangeRequest({ ...request, url });
  };

  // Body JSON change
  const handleBodyChange = (bodyJson: string) => {
    onChangeRequest({ ...request, bodyJson });
  };

  // Format JSON
  const formatJson = () => {
    try {
      const parsed = JSON.parse(request.bodyJson);
      onChangeRequest({ ...request, bodyJson: JSON.stringify(parsed, null, 2) });
    } catch (_) {}
  };

  // Quick Client Key template apply
  const setClientKeyInBody = (clientKey: string) => {
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

  // Headers Key/Value Add & Remove
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

  // Params Key/Value Add & Remove
  const addParam = () => {
    const newParams: KeyValueParam[] = [
      ...request.params,
      { id: `p-${Date.now()}`, key: '', value: '', enabled: true },
    ];
    onChangeRequest({ ...request, params: newParams });
  };

  const updateParam = (id: string, field: 'key' | 'value' | 'enabled', val: any) => {
    const updated = request.params.map((p) => (p.id === id ? { ...p, [field]: val } : p));
    onChangeRequest({ ...request, params: updated });
  };

  const removeParam = (id: string) => {
    onChangeRequest({ ...request, params: request.params.filter((p) => p.id !== id) });
  };

  // Live cURL preview
  const generateCurl = () => {
    let curl = `curl -X ${request.method} "${request.url}"`;
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
  };

  const copyCurl = () => {
    navigator.clipboard.writeText(generateCurl());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="pm-pane">
      {/* Postman Top Action Bar: Method + URL + Send + Burst */}
      <div className="pm-url-bar-container">
        {/* Method Select */}
        <select
          className="pm-method-select"
          value={request.method}
          onChange={(e) => handleMethodChange(e.target.value as HttpMethod)}
          style={{
            color:
              request.method === 'POST'
                ? '#F59E0B'
                : request.method === 'GET'
                ? '#22C55E'
                : request.method === 'PUT'
                ? '#A855F7'
                : '#EF4444',
          }}
        >
          <option value="POST">POST</option>
          <option value="GET">GET</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>

        {/* URL Input */}
        <div className="pm-url-input-wrapper">
          <input
            type="text"
            className="pm-url-input"
            value={request.url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Enter request URL (e.g. {{BASE_URL}}/v1/check)"
          />
        </div>

        {/* Action Buttons */}
        <div className="pm-url-actions">
          <button
            className="btn btn-send"
            onClick={onSend}
            disabled={isLoading}
            title="Execute Single Request"
          >
            <Send size={13} />
            <span>{isLoading ? 'SENDING...' : 'SEND'}</span>
          </button>

          <button
            className="btn btn-burst"
            onClick={onOpenBurst}
            title="Send Concurrent Burst Traffic"
          >
            <Flame size={13} />
            <span>BURST</span>
          </button>

          <button
            className="btn btn-visualize"
            onClick={onOpenVisualize}
            title="Live Algorithm Physics Visualizer"
          >
            <Sparkles size={13} />
            <span>VISUALIZE</span>
          </button>
        </div>
      </div>

      {/* Request Tabs Header */}
      <div className="pm-pane-header">
        <div className="pm-tab-strip">
          <button
            className={`pm-tab ${activeTab === 'params' ? 'active' : ''}`}
            onClick={() => setActiveTab('params')}
          >
            <span>Params ({request.params.filter((p) => p.enabled).length})</span>
          </button>

          <button
            className={`pm-tab ${activeTab === 'auth' ? 'active' : ''}`}
            onClick={() => setActiveTab('auth')}
          >
            <span>Auth</span>
          </button>

          <button
            className={`pm-tab ${activeTab === 'headers' ? 'active' : ''}`}
            onClick={() => setActiveTab('headers')}
          >
            <span>Headers ({request.headers.filter((h) => h.enabled).length})</span>
          </button>

          <button
            className={`pm-tab ${activeTab === 'body' ? 'active' : ''}`}
            onClick={() => setActiveTab('body')}
          >
            <span>Body</span>
          </button>

          <button
            className={`pm-tab ${activeTab === 'code' ? 'active' : ''}`}
            onClick={() => setActiveTab('code')}
          >
            <span>cURL Code</span>
          </button>
        </div>

        {hasLatestResponse && onViewLatestResponse && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onViewLatestResponse}
            style={{ fontSize: 11, padding: '4px 10px', gap: 5, color: '#F97316' }}
            title="View latest response snapshot"
          >
            <span>View Response</span>
            <span>→</span>
          </button>
        )}
      </div>

      {/* Request Pane Body */}
      <div className="pm-pane-body">
        {/* Tab: Params */}
        {activeTab === 'params' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: '#71717A' }}>Query Parameters</span>
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
                {request.params.map((p) => (
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Auth */}
        {activeTab === 'auth' && (
          <div style={{ maxWidth: 400 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 6, display: 'block' }}>
                Authorization Type:
              </label>
              <select
                value={request.authType}
                onChange={(e) => onChangeRequest({ ...request, authType: e.target.value as any })}
                style={{ width: '100%', padding: '8px 10px', background: '#121216', border: '1px solid #2A2A30', color: '#F4F4F5', borderRadius: 6 }}
              >
                <option value="none">No Auth (Public)</option>
                <option value="bearer">Bearer Token (Admin API Key)</option>
              </select>
            </div>

            {request.authType === 'bearer' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 6, display: 'block' }}>
                  Bearer Token / Admin Key:
                </label>
                <input
                  type="text"
                  placeholder="e.g. {{ADMIN_API_KEY}}"
                  value={request.bearerToken || ''}
                  onChange={(e) => onChangeRequest({ ...request, bearerToken: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', background: '#121216', border: '1px solid #2A2A30', color: '#F4F4F5', borderRadius: 6 }}
                />
              </div>
            )}
          </div>
        )}

        {/* Tab: Headers */}
        {activeTab === 'headers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: '#71717A' }}>HTTP Request Headers</span>
              <button className="btn btn-secondary btn-sm" onClick={addHeader}>
                <Plus size={12} color="#F97316" /> Add Header
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
                {request.headers.map((h) => (
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
                        placeholder="Header Name"
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Body */}
        {activeTab === 'body' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Quick Helper Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              {/* Client Preset Quick Injector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#71717A' }}>Inject Client Key:</span>
                <select
                  onChange={(e) => e.target.value && setClientKeyInBody(e.target.value)}
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
                      {c.clientKey} ({c.algorithm === 'token_bucket' ? 'Token Bucket' : 'Sliding Window'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Format JSON Button */}
              <button className="btn btn-secondary btn-sm" onClick={formatJson} style={{ padding: '3px 8px', fontSize: 11 }}>
                <Wand2 size={11} color="#FB923C" /> Format JSON
              </button>
            </div>

            {/* Monaco-style Code Textarea */}
            <textarea
              className="pm-code-editor"
              value={request.bodyJson}
              onChange={(e) => handleBodyChange(e.target.value)}
              placeholder="{\n  &quot;clientKey&quot;: &quot;mobile-app-client&quot;\n}"
              spellCheck={false}
            />
          </div>
        )}

        {/* Tab: cURL Code */}
        {activeTab === 'code' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#71717A' }}>Generated cURL Snippet</span>
              <button className="btn btn-secondary btn-sm" onClick={copyCurl} style={{ padding: '3px 8px', fontSize: 11 }}>
                {copiedCode ? <Check size={11} color="#22C55E" /> : <Copy size={11} />}
                <span>{copiedCode ? 'Copied' : 'Copy cURL'}</span>
              </button>
            </div>

            <div
              style={{
                background: '#121216',
                border: '1px solid #2A2A30',
                borderRadius: 6,
                padding: 12,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: '#F4F4F5',
                overflowX: 'auto',
                lineHeight: 1.5,
              }}
            >
              <pre>{generateCurl()}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
