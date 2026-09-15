import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Clock,
  Zap,
  RefreshCw,
  Send,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  HardDrive
} from 'lucide-react';
import { ResponseSnapshot, RequestTemplate } from '../../types/postman';
import { RateLimiterStatePanel } from './RateLimiterStatePanel';
import { Client } from '../../types';

interface ResponseViewerProps {
  response: ResponseSnapshot | null;
  isLoading: boolean;
  activeClient: Client | null;
  activeRequest: RequestTemplate;
  onBackToRequest: () => void;
  onSend: () => void;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({
  response,
  isLoading,
  activeClient,
  activeRequest,
  onBackToRequest,
  onSend,
}) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'timeline' | 'limiter'>('body');
  const [copied, setCopied] = useState(false);
  const [countdownSec, setCountdownSec] = useState<string>('0.0s');

  const resetEpoch = response?.reset || Math.floor(Date.now() / 1000) + 1;

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now() / 1000;
      const diff = Math.max(0, resetEpoch - now);
      setCountdownSec(`${diff.toFixed(1)}s`);
    }, 100);
    return () => clearInterval(timer);
  }, [resetEpoch]);

  const handleCopy = () => {
    if (!response) return;
    navigator.clipboard.writeText(
      typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2)
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isThrottled = response?.status === 429 || response?.decision === 'DENY';
  const isError = response?.status && response.status >= 400 && response.status !== 429;

  const limit = response?.limit || activeClient?.burstSize || activeClient?.requestsPerSecond || 20;
  const remaining = response ? response.remaining : limit;
  const fillPercent = Math.min(100, Math.max(0, (remaining / Math.max(1, limit)) * 100));

  const totalBlocks = 20;
  const filledBlocks = Math.round((remaining / Math.max(1, limit)) * totalBlocks);
  const asciiBar =
    '█'.repeat(Math.max(0, Math.min(totalBlocks, filledBlocks))) +
    '░'.repeat(Math.max(0, totalBlocks - Math.min(totalBlocks, filledBlocks)));

  const algo = response?.algorithm || activeClient?.algorithm || 'token_bucket';
  const refillRate = activeClient?.requestsPerSecond || 5;

  const getMethodBadgeClass = (method: string) => {
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
    <div className="pm-workspace pm-response-workspace">
      {/* 1. Top Response Header Bar */}
      <div className="pm-response-top-bar">
        {/* Left: Back button + Request summary */}
        <div className="pm-response-top-left">
          <button
            className="btn btn-back-request"
            onClick={onBackToRequest}
            title="Return to Request editor"
            id="back-to-request-btn"
          >
            <ArrowLeft size={14} />
            <span>← Request</span>
          </button>

          <div className="pm-req-summary-pill">
            <span className={`method-pill ${getMethodBadgeClass(activeRequest.method)}`}>
              {activeRequest.method}
            </span>
            <span className="pm-req-summary-url" title={response?.targetUrl || activeRequest.url}>
              {response?.targetUrl || activeRequest.url}
            </span>
          </div>
        </div>

        {/* Right: Status / Gate Decision / Latency / Size / Actions */}
        <div className="pm-response-top-right">
          {response && !isLoading && (
            <>
              {/* Gate Decision Badge */}
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 9px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  background: isThrottled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                  border: isThrottled ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
                  color: isThrottled ? '#EF4444' : '#22C55E',
                }}
              >
                {isThrottled ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                <span>{isThrottled ? 'GATEWAY: 429 THROTTLED' : 'GATEWAY: ALLOWED'}</span>
              </span>

              {/* Upstream Status Badge */}
              <span className={isThrottled ? 'status-badge-429' : isError ? 'status-badge-429' : 'status-badge-200'}>
                {response.status} {response.statusText}
              </span>

              {/* Latency */}
              <span className="pm-stat-badge-latency">
                <Clock size={12} />
                <span>{response.latencyMs} ms</span>
              </span>

              {/* Payload Size */}
              <span className="pm-stat-badge-size">
                <HardDrive size={11} style={{ marginRight: 3 }} />
                <span>{response.sizeBytes > 1024 ? `${(response.sizeBytes / 1024).toFixed(1)} KB` : `${response.sizeBytes} B`}</span>
              </span>
            </>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={onSend}
            disabled={isLoading}
            title="Re-send this exact request"
          >
            {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
            <span>Send Again</span>
          </button>
        </div>
      </div>

      {/* 2. Response Tabs Header */}
      <div className="pm-pane-header">
        <div className="pm-tab-strip">
          <button
            className={`pm-tab ${activeTab === 'body' ? 'active' : ''}`}
            onClick={() => setActiveTab('body')}
          >
            <span>Response Body</span>
          </button>

          <button
            className={`pm-tab ${activeTab === 'headers' ? 'active' : ''}`}
            onClick={() => setActiveTab('headers')}
          >
            <span>Headers ({response ? Object.keys(response.headers).length : 0})</span>
          </button>

          <button
            className={`pm-tab ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            <span>Gateway Waterfall</span>
          </button>

          <button
            className={`pm-tab ${activeTab === 'limiter' ? 'active' : ''}`}
            onClick={() => setActiveTab('limiter')}
          >
            <Zap size={12} color={activeTab === 'limiter' ? '#F97316' : '#71717A'} />
            <span>Rate Limiter Telemetry</span>
          </button>
        </div>
      </div>

      {/* 3. Pane Content */}
      <div className="pm-pane-body">
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 280, color: '#F97316', gap: 14 }}>
            <Zap size={36} className="animate-spin" />
            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              Routing request through Rate Limiter Gateway...
            </span>
          </div>
        ) : !response ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#71717A' }}>
            <Zap size={36} color="#2A2A30" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#A1A1AA' }}>No response recorded</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Click <strong>← Request</strong> to edit and send.</div>
          </div>
        ) : (
          <div>
            {/* Tab 1: Body View with JSON & Integrated Rate Limiter State */}
            {activeTab === 'body' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Throttled Alert Banner */}
                {isThrottled && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: 6,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      color: '#F87171',
                      fontSize: 12.5,
                    }}
                  >
                    <ShieldAlert size={18} color="#EF4444" />
                    <div>
                      <strong>Rate Limit Exceeded (HTTP 429)</strong>: Client token bucket was depleted. The target API was NOT invoked to protect upstream services.
                    </div>
                  </div>
                )}

                {/* JSON / Text Response Block */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: '#71717A', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                      Target Response Payload
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleCopy}
                      style={{ padding: '3px 9px', fontSize: 11 }}
                    >
                      {copied ? <Check size={11} color="#22C55E" /> : <Copy size={11} />}
                      <span>{copied ? 'Copied' : 'Copy Payload'}</span>
                    </button>
                  </div>

                  <div
                    style={{
                      background: '#121216',
                      border: '1px solid #2A2A30',
                      borderRadius: 6,
                      padding: 14,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12.5,
                      color: '#F4F4F5',
                      overflowX: 'auto',
                      lineHeight: 1.55,
                      maxHeight: 380,
                    }}
                  >
                    <pre>{typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2)}</pre>
                  </div>
                </div>

                {/* Divider Line */}
                <div style={{ borderTop: '1px solid #2A2A30', margin: '4px 0' }} />

                {/* Integrated Rate Limiter State Section */}
                <div className="pm-integrated-limiter-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#A855F7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Zap size={14} color="#A855F7" />
                      <span>⚡ {algo === 'token_bucket' ? 'Token Bucket Telemetry' : 'Sliding Window Log'}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: '#71717A', fontFamily: 'var(--font-mono)' }}>
                        Client: <strong style={{ color: '#F4F4F5' }}>{activeRequest.clientKey || response.body?.clientKey || activeClient?.clientKey || 'mobile-app-client'}</strong>
                      </span>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setActiveTab('limiter')}
                        style={{ padding: '2px 8px', fontSize: 11 }}
                      >
                        <Sliders size={11} />
                        <span>Inspect State</span>
                      </button>
                    </div>
                  </div>

                  {/* Token ASCII + Numeric readout */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.04em', color: fillPercent > 20 ? '#22C55E' : '#EF4444' }}>
                        {asciiBar}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: fillPercent > 20 ? '#22C55E' : '#EF4444' }}>
                        {remaining} / {limit} tokens
                      </span>
                    </div>

                    {/* Gradient Progress Bar */}
                    <div className="pm-token-progress-bar" style={{ margin: '6px 0 10px 0' }}>
                      <div
                        className="pm-token-progress-fill"
                        style={{
                          width: `${fillPercent}%`,
                          background:
                            fillPercent > 50
                              ? 'linear-gradient(90deg, #22C55E, #F97316)'
                              : fillPercent > 20
                              ? 'linear-gradient(90deg, #F59E0B, #A855F7)'
                              : 'linear-gradient(90deg, #EF4444, #B91C1C)',
                          boxShadow: fillPercent > 20 ? '0 0 10px rgba(34, 197, 94, 0.4)' : '0 0 10px rgba(239, 68, 68, 0.4)',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#A1A1AA', fontFamily: 'var(--font-mono)' }}>
                      <span>Refill rate: <strong style={{ color: '#F97316' }}>+{refillRate} tokens/sec</strong></span>
                      <span>Next refill / reset in: <strong style={{ color: '#F97316' }}>{countdownSec}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Response Headers Table */}
            {activeTab === 'headers' && (
              <div>
                <table className="pm-table">
                  <thead>
                    <tr>
                      <th style={{ width: '35%' }}>Header Key</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(response.headers).map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: k.toLowerCase().startsWith('x-ratelimit') ? '#F97316' : '#A1A1AA' }}>
                          {k}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: '#F4F4F5' }}>
                          {v}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 3: Execution Waterfall */}
            {activeTab === 'timeline' && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: '#A1A1AA' }}>
                  Gateway Pipeline Spans ({response.latencyMs} ms total roundtrip):
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: '#18181C', padding: 10, borderRadius: 6, border: '1px solid #2A2A30' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: '#F4F4F5' }}>1. Gateway Ingress & SSRF DNS Verification</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#3B82F6' }}>{(response.latencyMs * 0.1).toFixed(2)} ms</span>
                    </div>
                    <div style={{ height: 4, background: '#202024', borderRadius: 2 }}>
                      <div style={{ width: '10%', height: '100%', background: '#3B82F6', borderRadius: 2 }} />
                    </div>
                  </div>

                  <div style={{ background: '#18181C', padding: 10, borderRadius: 6, border: '1px solid #2A2A30' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: '#F4F4F5' }}>2. Redis Lua Atomic Rate Limit Evaluation</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#A855F7' }}>{(response.latencyMs * 0.2).toFixed(2)} ms</span>
                    </div>
                    <div style={{ height: 4, background: '#202024', borderRadius: 2 }}>
                      <div style={{ width: '20%', height: '100%', background: '#A855F7', borderRadius: 2 }} />
                    </div>
                  </div>

                  <div style={{ background: '#18181C', padding: 10, borderRadius: 6, border: '1px solid #2A2A30' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: '#F4F4F5' }}>3. Target API Outbound Dispatch & Streaming</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#22C55E' }}>{(response.latencyMs * 0.6).toFixed(2)} ms</span>
                    </div>
                    <div style={{ height: 4, background: '#202024', borderRadius: 2 }}>
                      <div style={{ width: '60%', height: '100%', background: '#22C55E', borderRadius: 2 }} />
                    </div>
                  </div>

                  <div style={{ background: '#18181C', padding: 10, borderRadius: 6, border: '1px solid #2A2A30' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: '#F4F4F5' }}>4. RFC RateLimit Header Assembly & Egress</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#F97316' }}>{(response.latencyMs * 0.1).toFixed(2)} ms</span>
                    </div>
                    <div style={{ height: 4, background: '#202024', borderRadius: 2 }}>
                      <div style={{ width: '10%', height: '100%', background: '#F97316', borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Rate Limiter State Deep Dive Panel */}
            {activeTab === 'limiter' && (
              <RateLimiterStatePanel
                latestResponse={response}
                activeClient={activeClient}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
