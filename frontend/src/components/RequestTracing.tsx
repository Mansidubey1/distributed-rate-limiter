import React, { useState } from 'react';
import {
  Radio,
  Search,
  Copy,
  Check,
  ChevronRight,
  Filter,
  Layers
} from 'lucide-react';
import { RequestTrace } from '../types';
import { formatTime } from '../utils/helpers';

interface RequestTracingProps {
  traces: RequestTrace[];
  onClearTraces: () => void;
}

export const RequestTracing: React.FC<RequestTracingProps> = ({ traces, onClearTraces }) => {
  const [selectedTrace, setSelectedTrace] = useState<RequestTrace | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ALLOW' | 'DENY'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTraces = traces.filter((t) => {
    if (filterStatus === 'ALLOW' && t.decision !== 'ALLOW') return false;
    if (filterStatus === 'DENY' && t.decision !== 'DENY') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.traceId.toLowerCase().includes(q) ||
        t.requestId.toLowerCase().includes(q) ||
        t.clientKey.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div>
      {/* Search & Filter Bar */}
      <div className="glass-panel" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
          }}
        >
          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flex: 1,
              minWidth: 260,
              background: '#121216',
              border: '1px solid #2A2A30',
              borderRadius: 6,
              padding: '2px 10px',
            }}
          >
            <Search size={16} color="#71717A" />
            <input
              type="text"
              placeholder="Search by Trace ID, Request ID, or Client Key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', color: '#F4F4F5', padding: '7px 0', outline: 'none' }}
            />
          </div>

          {/* Status Filter Buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#71717A', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Filter size={12} /> Filter:
            </span>
            <button
              className={`btn btn-sm ${filterStatus === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterStatus('ALL')}
            >
              All ({traces.length})
            </button>
            <button
              className={`btn btn-sm ${filterStatus === 'ALLOW' ? 'btn-emerald' : 'btn-secondary'}`}
              onClick={() => setFilterStatus('ALLOW')}
            >
              200 ALLOW ({traces.filter((t) => t.decision === 'ALLOW').length})
            </button>
            <button
              className={`btn btn-sm ${filterStatus === 'DENY' ? 'btn-rose' : 'btn-secondary'}`}
              onClick={() => setFilterStatus('DENY')}
            >
              429 DENY ({traces.filter((t) => t.decision === 'DENY').length})
            </button>
            {traces.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={onClearTraces}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Dual Grid: Table & Span Waterfall Detail */}
      <div className="grid-2col">
        {/* Left: Traces Stream Table */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <Radio size={18} color="#F97316" />
                <span>Distributed Request Traces</span>
              </div>
              <div className="panel-subtitle">End-to-end execution spans with sub-millisecond timestamps</div>
            </div>
          </div>

          <div className="table-wrapper" style={{ maxHeight: 600, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Trace ID</th>
                  <th>Client</th>
                  <th>Latency</th>
                  <th>Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredTraces.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#71717A' }}>
                      {traces.length === 0
                        ? 'No traces recorded yet. Fire requests from Traffic Simulator!'
                        : 'No traces match current search query.'}
                    </td>
                  </tr>
                ) : (
                  filteredTraces.map((trace) => {
                    const isAllow = trace.decision === 'ALLOW';
                    const isSelected = selectedTrace?.id === trace.id;
                    return (
                      <tr
                        key={trace.id}
                        onClick={() => setSelectedTrace(trace)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(249, 115, 22, 0.12)' : undefined,
                        }}
                      >
                        <td>
                          <span className={isAllow ? 'status-badge-allow' : 'status-badge-deny'}>
                            {trace.statusCode}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#A1A1AA' }}>
                          {trace.traceId.substring(0, 14)}...
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#F4F4F5' }}>{trace.clientKey}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: '#F97316', fontSize: 11 }}>
                          {trace.latencyMs}ms
                        </td>
                        <td style={{ fontSize: 11, color: '#71717A' }}>
                          {formatTime(trace.timestamp)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <ChevronRight size={14} color="#71717A" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Selected Trace Waterfall Drawer */}
        <div className="glass-panel">
          {selectedTrace ? (
            <div>
              <div className="panel-header">
                <div>
                  <div className="panel-title">
                    <Layers size={18} color="#A855F7" />
                    <span>Trace Span Waterfall</span>
                  </div>
                  <div className="panel-subtitle">
                    Trace: <strong style={{ fontFamily: 'var(--font-mono)', color: '#F4F4F5' }}>{selectedTrace.traceId}</strong>
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleCopy(JSON.stringify(selectedTrace, null, 2), 'trace-json')}
                >
                  {copiedId === 'trace-json' ? <Check size={12} color="#22C55E" /> : <Copy size={12} />}
                  <span>{copiedId === 'trace-json' ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>

              {/* Trace Summary Chips */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  marginBottom: 16,
                  fontSize: 11,
                  background: '#202024',
                  padding: 10,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #2A2A30',
                }}
              >
                <div>
                  <span style={{ color: '#71717A' }}>Decision:</span>
                  <div style={{ fontWeight: 700, color: selectedTrace.decision === 'ALLOW' ? '#22C55E' : '#EF4444' }}>
                    {selectedTrace.decision} ({selectedTrace.statusCode})
                  </div>
                </div>
                <div>
                  <span style={{ color: '#71717A' }}>Total Latency:</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F97316' }}>
                    {selectedTrace.latencyMs}ms
                  </div>
                </div>
                <div>
                  <span style={{ color: '#71717A' }}>Node Instance:</span>
                  <div style={{ fontFamily: 'var(--font-mono)', color: '#F4F4F5' }}>
                    {selectedTrace.instanceId}
                  </div>
                </div>
              </div>

              {/* Waterfall Spans */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: '#A1A1AA' }}>
                  Execution Spans Breakdown:
                </div>
                {selectedTrace.spans.map((span) => {
                  const percent = Math.max(5, Math.min(100, (span.durationMs / Math.max(0.1, selectedTrace.latencyMs)) * 100));
                  return (
                    <div
                      key={span.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '160px 1fr 60px',
                        alignItems: 'center',
                        gap: 12,
                        padding: '6px 0',
                        borderBottom: '1px solid #2A2A30',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#F4F4F5' }}>{span.name}</div>
                        <div style={{ fontSize: 10, color: '#71717A' }}>{span.description}</div>
                      </div>
                      <div style={{ height: 6, background: '#202024', border: '1px solid #2A2A30', borderRadius: 3, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${percent}%`,
                            background:
                              span.status === 'ok'
                                ? 'linear-gradient(90deg, #F97316, #FB923C)'
                                : 'linear-gradient(90deg, #F59E0B, #EF4444)',
                          }}
                        ></div>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'right', color: '#F97316' }}>
                        {span.durationMs}ms
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Header Dump */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#A1A1AA' }}>
                  Emitted RateLimit Headers:
                </div>
                <div className="code-box">
                  <div>X-RateLimit-Limit: {selectedTrace.limit}</div>
                  <div>X-RateLimit-Remaining: {selectedTrace.remaining}</div>
                  <div>X-RateLimit-Reset: {selectedTrace.reset}</div>
                  {selectedTrace.retryAfter && <div>Retry-After: {selectedTrace.retryAfter}s</div>}
                  <div>X-Instance-Id: {selectedTrace.instanceId}</div>
                  <div>X-Request-Id: {selectedTrace.requestId}</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: '#71717A' }}>
              <Radio size={36} color="#2A2A30" style={{ marginBottom: 12 }} />
              <div>Select a trace from the left panel to inspect detailed execution spans and waterfall timeline.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
