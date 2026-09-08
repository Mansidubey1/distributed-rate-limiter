import React, { useEffect, useRef } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Zap,
  Layers,
  ArrowRight,
  Database,
  HardDrive,
  Cpu,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { Metrics, Health, Client } from '../types';

interface TelemetryOverviewProps {
  metrics: Metrics;
  health: Health | null;
  clients: Client[];
  rps: number;
  chartHistory: { allowed: number; denied: number }[];
  onNavigateToTab: (tab: any) => void;
}

export const TelemetryOverview: React.FC<TelemetryOverviewProps> = ({
  metrics,
  health,
  clients,
  rps,
  chartHistory,
  onNavigateToTab,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const total = metrics.allowedRequests + metrics.deniedRequests || 1;
  const allowRate = ((metrics.allowedRequests / total) * 100).toFixed(1);
  const denyRate = ((metrics.deniedRequests / total) * 100).toFixed(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const history = chartHistory;
    const step = w / Math.max(1, history.length - 1);
    let maxVal = 10;
    history.forEach((pt) => {
      const sum = Math.max(pt.allowed, pt.denied);
      if (sum > maxVal) maxVal = sum;
    });
    maxVal = Math.ceil(maxVal * 1.2);

    // Draw background grid lines
    ctx.strokeStyle = 'rgba(42, 42, 48, 0.8)';
    ctx.lineWidth = 1;
    const gridRows = 4;
    for (let i = 1; i <= gridRows; i++) {
      const y = h - (h * i) / (gridRows + 1);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      // Axis labels
      ctx.fillStyle = '#71717A';
      ctx.font = `${10 * (window.devicePixelRatio || 1)}px JetBrains Mono`;
      ctx.fillText(`${Math.round((maxVal * i) / (gridRows + 1))} rps`, 10, y - 4);
    }

    // Gradient fills
    // 1. Allowed (Green #22C55E)
    if (history.length > 1) {
      const allowedGrad = ctx.createLinearGradient(0, 0, 0, h);
      allowedGrad.addColorStop(0, 'rgba(34, 197, 94, 0.25)');
      allowedGrad.addColorStop(1, 'rgba(34, 197, 94, 0.0)');

      ctx.beginPath();
      ctx.moveTo(0, h);
      history.forEach((pt, i) => {
        const x = i * step;
        const y = h - (pt.allowed / maxVal) * (h - 30) - 10;
        ctx.lineTo(x, y);
      });
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = allowedGrad;
      ctx.fill();

      // Allowed Line
      ctx.beginPath();
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2.5 * (window.devicePixelRatio || 1);
      ctx.lineJoin = 'round';
      history.forEach((pt, i) => {
        const x = i * step;
        const y = h - (pt.allowed / maxVal) * (h - 30) - 10;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // 2. Denied (Red #EF4444)
    if (history.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.5 * (window.devicePixelRatio || 1);
      ctx.lineJoin = 'round';
      history.forEach((pt, i) => {
        const x = i * step;
        const y = h - (pt.denied / maxVal) * (h - 30) - 10;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [chartHistory]);

  return (
    <div>
      {/* 5 KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Total Evaluated</span>
            <Activity size={18} color="#F97316" />
          </div>
          <div className="stat-value" style={{ color: '#F97316' }}>
            {metrics.totalRequests.toLocaleString()}
          </div>
          <div className="stat-footer">
            <ShieldCheck size={14} color="#F97316" />
            <span>Multi-node cluster checks</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Allowed (200 OK)</span>
            <CheckCircle2 size={18} color="#22C55E" />
          </div>
          <div className="stat-value" style={{ color: '#22C55E' }}>
            {metrics.allowedRequests.toLocaleString()}
          </div>
          <div className="stat-footer">
            <span style={{ color: '#22C55E', fontWeight: 700 }}>{allowRate}%</span>
            <span>token quota fulfilled</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Throttled (429)</span>
            <XCircle size={18} color="#EF4444" />
          </div>
          <div className="stat-value" style={{ color: '#EF4444' }}>
            {metrics.deniedRequests.toLocaleString()}
          </div>
          <div className="stat-footer">
            <span style={{ color: '#EF4444', fontWeight: 700 }}>{denyRate}%</span>
            <span>burst limits enforced</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Live Throughput</span>
            <Zap size={18} color="#F59E0B" />
          </div>
          <div className="stat-value" style={{ color: '#F59E0B' }}>
            {rps} <span style={{ fontSize: 16, fontWeight: 500, color: '#71717A' }}>req/s</span>
          </div>
          <div className="stat-footer">
            <TrendingUp size={14} color="#F59E0B" />
            <span>Sampling every 1s</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Active Clients</span>
            <Layers size={18} color="#A855F7" />
          </div>
          <div className="stat-value" style={{ color: '#A855F7' }}>
            {clients.length}
          </div>
          <div className="stat-footer">
            <span>Configured rate policies</span>
          </div>
        </div>
      </div>

      {/* Main Real-Time Stream Chart & Architecture Topology */}
      <div className="grid-2col" style={{ marginBottom: 20 }}>
        {/* Real-time Stream */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <Activity size={18} color="#F97316" />
                <span>Real-Time Traffic Throughput Stream</span>
              </div>
              <div className="panel-subtitle">Live request throughput (1.0s sample interval)</div>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, background: '#22C55E', borderRadius: 3 }}></span>
                <span style={{ color: '#A1A1AA' }}>200 ALLOW</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, background: '#EF4444', borderRadius: 3 }}></span>
                <span style={{ color: '#A1A1AA' }}>429 THROTTLE</span>
              </div>
            </div>
          </div>

          <div style={{ height: 220, position: 'relative', width: '100%', marginBottom: 12 }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }}></canvas>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#71717A' }}>
              Sliding real-time stream: 45-second retention
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigateToTab('simulator')}>
              <Zap size={13} color="#F97316" />
              <span>Launch Traffic Simulator</span>
            </button>
          </div>
        </div>

        {/* Distributed Architecture Topology */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <Cpu size={18} color="#A855F7" />
                <span>Cluster Topology & Data Pipeline</span>
              </div>
              <div className="panel-subtitle">Distributed execution flow</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Stage 1: Ingress API */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: '#202024',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #2A2A30',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'rgba(249, 115, 22, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F97316',
                }}
              >
                <Zap size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#F4F4F5' }}>Fastify Ingress Gateway</div>
                <div style={{ fontSize: 11, color: '#71717A' }}>
                  Node: {health?.instanceId || 'limiter-01'} | CORS & Static Assets Active
                </div>
              </div>
              <span className="pill-badge" style={{ color: '#22C55E' }}>
                Online
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', color: '#71717A' }}>
              <ArrowRight size={16} style={{ transform: 'rotate(90deg)' }} />
            </div>

            {/* Stage 2: Redis Lua Engine */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: '#202024',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #2A2A30',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'rgba(168, 85, 247, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#A855F7',
                }}
              >
                <Database size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#F4F4F5' }}>Redis Atomic Lua Engine</div>
                <div style={{ fontSize: 11, color: '#71717A' }}>
                  Sub-millisecond token refill math & sliding sorted set
                </div>
              </div>
              <span
                className="pill-badge"
                style={{ color: health?.services?.redis === 'healthy' ? '#22C55E' : '#F59E0B' }}
              >
                {health?.services?.redis || 'healthy'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', color: '#71717A' }}>
              <ArrowRight size={16} style={{ transform: 'rotate(90deg)' }} />
            </div>

            {/* Stage 3: PostgreSQL Database */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: '#202024',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #2A2A30',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'rgba(251, 146, 60, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FB923C',
                }}
              >
                <HardDrive size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#F4F4F5' }}>PostgreSQL Persistence Store</div>
                <div style={{ fontSize: 11, color: '#71717A' }}>
                  Durable client policies & fallback audit logs
                </div>
              </div>
              <span
                className="pill-badge"
                style={{ color: health?.database === 'connected' ? '#22C55E' : '#EF4444' }}
              >
                {health?.database === 'connected' ? 'Connected' : 'Degraded'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Policy Performance Matrix */}
      <div className="glass-panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">
              <Layers size={18} color="#A855F7" />
              <span>Active Policy Performance Matrix</span>
            </div>
            <div className="panel-subtitle">Configured client rate limits and live distribution</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigateToTab('policies')}>
            <span>Manage All Policies</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Client Key</th>
                <th>Algorithm</th>
                <th>Rate / Quota</th>
                <th>Burst / Window</th>
                <th>Allowed</th>
                <th>Denied</th>
                <th>Success Ratio</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#71717A' }}>
                    No client policies configured yet. Click "New Policy" in the top bar.
                  </td>
                </tr>
              ) : (
                clients.slice(0, 5).map((c) => {
                  const clientTotal = (c.allowedRequests || 0) + (c.deniedRequests || 0) || 1;
                  const ratio = (((c.allowedRequests || 0) / clientTotal) * 100).toFixed(0);
                  const isTb = c.algorithm === 'token_bucket';
                  return (
                    <tr key={c.clientKey}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#F4F4F5' }}>
                        {c.clientKey}
                      </td>
                      <td>
                        <span className={`algo-tag ${isTb ? 'algo-tb' : 'algo-sw'}`}>
                          {isTb ? 'Token Bucket' : 'Sliding Window'}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#F4F4F5' }}>{c.requestsPerSecond}</strong> req/s
                      </td>
                      <td style={{ color: '#A1A1AA' }}>
                        {isTb ? `Burst: ${c.burstSize}` : `Window: ${c.windowSize}s`}
                      </td>
                      <td style={{ color: '#22C55E', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {c.allowedRequests || 0}
                      </td>
                      <td style={{ color: '#EF4444', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {c.deniedRequests || 0}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 6,
                              background: '#202024',
                              border: '1px solid #2A2A30',
                              borderRadius: 3,
                              overflow: 'hidden',
                              minWidth: 60,
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${ratio}%`,
                                background: 'linear-gradient(90deg, #22C55E, #F97316)',
                                borderRadius: 3,
                              }}
                            ></div>
                          </div>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#71717A' }}>
                            {ratio}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
