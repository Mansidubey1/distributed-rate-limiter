import React, { useState, useEffect } from 'react';
import {
  Search,
  Clock,
  Zap,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import { HeaderSnapshot, Client } from '../types';
import { formatTime } from '../utils/helpers';

interface HeaderInspectorProps {
  latestSnapshot: HeaderSnapshot | null;
  snapshots: HeaderSnapshot[];
  clients: Client[];
  onTriggerCheck: (clientKey: string) => void;
}

export const HeaderInspector: React.FC<HeaderInspectorProps> = ({
  latestSnapshot,
  snapshots,
  clients,
  onTriggerCheck,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [countdownSec, setCountdownSec] = useState<string>('0.0s');

  const activeSnapshot = latestSnapshot || snapshots[0];
  const previousSnapshot = snapshots.length > 1 ? snapshots[1] : null;

  // Real-time Countdown Timer for X-RateLimit-Reset
  useEffect(() => {
    if (!activeSnapshot) return;

    const timer = setInterval(() => {
      const now = Date.now() / 1000;
      const diff = Math.max(0, activeSnapshot.reset - now);
      setCountdownSec(`${diff.toFixed(1)}s`);
    }, 100);

    return () => clearInterval(timer);
  }, [activeSnapshot]);

  const copyHeaders = () => {
    if (!activeSnapshot) return;
    const headerStr = Object.entries(activeSnapshot.rawHeaders)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    navigator.clipboard.writeText(headerStr);
    setCopiedKey('all-headers');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div>
      {/* Header Cards Deck */}
      <div className="stats-grid">
        {/* X-RateLimit-Limit */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">X-RateLimit-Limit</span>
            <ShieldCheck size={18} color="#F97316" />
          </div>
          <div className="stat-value" style={{ color: '#F97316' }}>
            {activeSnapshot?.limit ?? '-'}
          </div>
          <div className="stat-footer">
            <span>Burst capacity / Max quota</span>
          </div>
        </div>

        {/* X-RateLimit-Remaining */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">X-RateLimit-Remaining</span>
            <Zap size={18} color="#22C55E" />
          </div>
          <div
            className="stat-value"
            style={{ color: (activeSnapshot?.remaining ?? 0) > 0 ? '#22C55E' : '#EF4444' }}
          >
            {activeSnapshot?.remaining ?? '-'}
          </div>
          <div className="stat-footer">
            <span>Live available tokens</span>
          </div>
        </div>

        {/* X-RateLimit-Reset */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">X-RateLimit-Reset</span>
            <Clock size={18} color="#A855F7" />
          </div>
          <div className="stat-value" style={{ color: '#A855F7', fontSize: 24 }}>
            {countdownSec}
          </div>
          <div className="stat-footer">
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              Epoch: {activeSnapshot?.reset ?? '-'}
            </span>
          </div>
        </div>

        {/* Retry-After / Status */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Retry-After Header</span>
            <Clock size={18} color="#F59E0B" />
          </div>
          <div className="stat-value" style={{ color: '#F59E0B' }}>
            {activeSnapshot?.retryAfter ? `${activeSnapshot.retryAfter}s` : 'N/A'}
          </div>
          <div className="stat-footer">
            <span>Emitted on HTTP 429 status</span>
          </div>
        </div>
      </div>

      {/* Main Dual Grid: Live Header Table & Delta Comparison */}
      <div className="grid-2col">
        {/* Left: Raw HTTP Headers Table */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <Search size={18} color="#F97316" />
                <span>Active Response Headers Workbench</span>
              </div>
              <div className="panel-subtitle">
                Latest check evaluation ({activeSnapshot ? formatTime(activeSnapshot.timestamp) : 'No data'})
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {clients.length > 0 && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onTriggerCheck(clients[0].clientKey)}
                >
                  <Zap size={12} /> Test Check ({clients[0].clientKey})
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={copyHeaders} disabled={!activeSnapshot}>
                {copiedKey === 'all-headers' ? <Check size={12} color="#22C55E" /> : <Copy size={12} />}
                <span>{copiedKey === 'all-headers' ? 'Copied' : 'Copy All'}</span>
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Header Field</th>
                  <th>Value</th>
                  <th>Standard Specification</th>
                </tr>
              </thead>
              <tbody>
                {activeSnapshot ? (
                  <>
                    <tr>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F97316' }}>
                        X-RateLimit-Limit
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#F4F4F5' }}>{activeSnapshot.limit}</td>
                      <td style={{ fontSize: 11, color: '#71717A' }}>
                        Maximum requests permitted in time window
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#22C55E' }}>
                        X-RateLimit-Remaining
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F4F4F5' }}>
                        {activeSnapshot.remaining}
                      </td>
                      <td style={{ fontSize: 11, color: '#71717A' }}>
                        Available tokens remaining for client
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#A855F7' }}>
                        X-RateLimit-Reset
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#F4F4F5' }}>{activeSnapshot.reset}</td>
                      <td style={{ fontSize: 11, color: '#71717A' }}>
                        UTC Unix timestamp when bucket refills
                      </td>
                    </tr>
                    {activeSnapshot.retryAfter && (
                      <tr>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#EF4444' }}>
                          Retry-After
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: '#EF4444', fontWeight: 700 }}>
                          {activeSnapshot.retryAfter}
                        </td>
                        <td style={{ fontSize: 11, color: '#71717A' }}>
                          Seconds to backoff before next retry (RFC 6585)
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#A1A1AA' }}>X-Instance-Id</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#F4F4F5' }}>{activeSnapshot.instanceId}</td>
                      <td style={{ fontSize: 11, color: '#71717A' }}>
                        Cluster worker node executing check
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#A1A1AA' }}>X-Request-Id</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#F4F4F5' }}>{activeSnapshot.requestId}</td>
                      <td style={{ fontSize: 11, color: '#71717A' }}>Unique trace identifier</td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: 30, color: '#71717A' }}>
                      No headers captured yet. Fire a test request from the simulator!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Header Delta & Compliance */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <BookOpen size={18} color="#A855F7" />
                <span>Header Delta & RFC Specifications</span>
              </div>
              <div className="panel-subtitle">Consecutive request header mutations</div>
            </div>
          </div>

          {/* Delta Box */}
          <div
            style={{
              background: '#202024',
              border: '1px solid #2A2A30',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              marginBottom: 18,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: '#A1A1AA' }}>
              Consecutive Token Consumption Delta (N-1 → N):
            </div>
            {previousSnapshot && activeSnapshot ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#71717A' }}>Remaining Tokens Delta:</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color:
                        activeSnapshot.remaining < previousSnapshot.remaining
                          ? '#EF4444'
                          : '#22C55E',
                    }}
                  >
                    {previousSnapshot.remaining} → {activeSnapshot.remaining} (
                    {activeSnapshot.remaining - previousSnapshot.remaining})
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#71717A' }}>Status Transition:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F4F4F5' }}>
                    HTTP {previousSnapshot.statusCode} → HTTP {activeSnapshot.statusCode}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#71717A' }}>
                Fire multiple requests to observe real-time header delta transitions.
              </div>
            )}
          </div>

          {/* RFC Compliance Checklist */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: '#A1A1AA' }}>
              IETF & RFC Standard Compliance Checklist:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#F4F4F5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <CheckCircle2 size={14} color="#22C55E" />
                <span>
                  <strong>RFC 6585:</strong> HTTP 429 Status Code on limit breach
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <CheckCircle2 size={14} color="#22C55E" />
                <span>
                  <strong>RFC 7231:</strong> Exponential backoff delay via <code>Retry-After</code>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <CheckCircle2 size={14} color="#22C55E" />
                <span>
                  <strong>IETF Draft:</strong> Standard rate limit remaining & reset epoch headers
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
