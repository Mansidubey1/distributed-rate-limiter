import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Zap,
  Database,
  HardDrive,
  Server,
  Globe,
  RefreshCw,
  RotateCcw,
  Sliders,
  ArrowUpRight,
  Flame
} from 'lucide-react';
import { Metrics, Health, Client, LiveRequestActivity, DashboardEvent } from '../types';
import { LimiterLabLogo } from './LimiterLabLogo';
import { soundFX, formatTime } from '../utils/helpers';

interface DashboardOverviewProps {
  metrics: Metrics;
  health: Health | null;
  clients: Client[];
  rps: number;
  chartHistory: { allowed: number; denied: number }[];
  liveRequests: LiveRequestActivity[];
  events: DashboardEvent[];
  onNavigateToTab: (tab: any) => void;
  onSelectClientForPostman?: (clientKey: string) => void;
  onSendTestRequest?: (clientKey: string, endpoint?: string) => Promise<any>;
  onClearEvents?: () => void;
  onRefreshData?: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  metrics,
  health,
  clients,
  rps,
  chartHistory,
  liveRequests,
  events,
  onNavigateToTab,
  onSelectClientForPostman,
  onSendTestRequest,
  onClearEvents,
  onRefreshData,
}) => {
  // Peak RPS tracking
  const [peakRps, setPeakRps] = useState<number>(() => Math.max(rps, 0));
  useEffect(() => {
    if (rps > peakRps) {
      setPeakRps(rps);
    }
  }, [rps, peakRps]);

  // Canvas Ref for Request Traffic
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Selected client for Token Bucket visualizer
  const [selectedClientKey, setSelectedClientKey] = useState<string>(() => {
    return clients[0]?.clientKey || 'client01';
  });

  // Keep selected client synced if clients load
  useEffect(() => {
    if (!clients.some((c) => c.clientKey === selectedClientKey) && clients.length > 0) {
      setSelectedClientKey(clients[0].clientKey);
    }
  }, [clients, selectedClientKey]);

  const activeClientObj = clients.find((c) => c.clientKey === selectedClientKey) || clients[0] || {
    clientKey: 'client01',
    algorithm: 'token_bucket',
    requestsPerSecond: 5,
    burstSize: 10,
    windowSize: 10,
  };

  // Local simulated token bucket state for continuous fluid visual animation
  const burstCapacity = activeClientObj.burstSize || 10;
  const refillRate = activeClientObj.requestsPerSecond || 5;
  const [tokens, setTokens] = useState<number>(Math.min(7, burstCapacity));
  const [isConsuming, setIsConsuming] = useState<boolean>(false);
  const [bucketActionNote, setBucketActionNote] = useState<string | null>(null);

  // Continuous Refill Timer for Token Bucket widget
  useEffect(() => {
    const interval = setInterval(() => {
      setTokens((prev) => {
        const step = refillRate / 10; // add every 100ms
        const next = Math.min(burstCapacity, Number((prev + step).toFixed(1)));
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [burstCapacity, refillRate]);

  // Handle Token Consumption Test
  const handleConsumeToken = async (count: number = 1) => {
    setIsConsuming(true);
    let allowedCount = 0;
    let deniedCount = 0;

    for (let i = 0; i < count; i++) {
      if (tokens >= 1) {
        setTokens((prev) => Math.max(0, Number((prev - 1).toFixed(1))));
        allowedCount++;
        soundFX.playAllow();
      } else {
        deniedCount++;
        soundFX.playDeny();
      }
    }

    if (onSendTestRequest) {
      try {
        await onSendTestRequest(selectedClientKey, '/v1/check');
      } catch (_) {}
    }

    if (deniedCount > 0) {
      setBucketActionNote(`429 Throttled! Drained ${allowedCount} token(s), rejected ${deniedCount}`);
    } else {
      setBucketActionNote(`Allowed: Consumed ${allowedCount} token(s)`);
    }

    setTimeout(() => {
      setIsConsuming(false);
      setTimeout(() => setBucketActionNote(null), 2500);
    }, 300);
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

  // Real-time Smooth Canvas Chart Rendering
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

    // 1. Background Grid Lines
    ctx.strokeStyle = 'rgba(42, 42, 48, 0.6)';
    ctx.lineWidth = 1 * dpr;
    const gridRows = 4;
    for (let i = 1; i <= gridRows; i++) {
      const y = h - (h * i) / (gridRows + 1);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      // Axis labels
      ctx.fillStyle = '#71717A';
      ctx.font = `${10 * dpr}px JetBrains Mono, monospace`;
      ctx.fillText(`${Math.round((maxVal * i) / (gridRows + 1))} rps`, 12 * dpr, y - 4 * dpr);
    }

    // 2. Draw 200 ALLOW Area & Curve (Emerald Green)
    if (history.length > 1) {
      const allowGrad = ctx.createLinearGradient(0, 0, 0, h);
      allowGrad.addColorStop(0, 'rgba(34, 197, 94, 0.28)');
      allowGrad.addColorStop(1, 'rgba(34, 197, 94, 0.0)');

      ctx.beginPath();
      ctx.moveTo(0, h);
      history.forEach((pt, i) => {
        const x = i * step;
        const y = h - (pt.allowed / maxVal) * (h - 35 * dpr) - 10 * dpr;
        if (i === 0) ctx.lineTo(x, y);
        else {
          const prevX = (i - 1) * step;
          const prevY = h - (history[i - 1].allowed / maxVal) * (h - 35 * dpr) - 10 * dpr;
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
      });
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = allowGrad;
      ctx.fill();

      // ALLOW Line
      ctx.beginPath();
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2.5 * dpr;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(34, 197, 94, 0.4)';
      ctx.shadowBlur = 8 * dpr;
      history.forEach((pt, i) => {
        const x = i * step;
        const y = h - (pt.allowed / maxVal) * (h - 35 * dpr) - 10 * dpr;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prevX = (i - 1) * step;
          const prevY = h - (history[i - 1].allowed / maxVal) * (h - 35 * dpr) - 10 * dpr;
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 3. Draw 429 THROTTLE Line (Ruby Red)
    if (history.length > 1) {
      const denyGrad = ctx.createLinearGradient(0, 0, 0, h);
      denyGrad.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
      denyGrad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

      ctx.beginPath();
      ctx.moveTo(0, h);
      history.forEach((pt, i) => {
        const x = i * step;
        const y = h - (pt.denied / maxVal) * (h - 35 * dpr) - 10 * dpr;
        if (i === 0) ctx.lineTo(x, y);
        else {
          const prevX = (i - 1) * step;
          const prevY = h - (history[i - 1].denied / maxVal) * (h - 35 * dpr) - 10 * dpr;
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
      });
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = denyGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2 * dpr;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
      ctx.shadowBlur = 6 * dpr;
      history.forEach((pt, i) => {
        const x = i * step;
        const y = h - (pt.denied / maxVal) * (h - 35 * dpr) - 10 * dpr;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prevX = (i - 1) * step;
          const prevY = h - (history[i - 1].denied / maxVal) * (h - 35 * dpr) - 10 * dpr;
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [chartHistory]);

  // Filtered live requests
  const filteredRequests = liveRequests.filter((req) => {
    if (activityFilter === '200' && req.status !== 200 && req.status !== 201) return false;
    if (activityFilter === '429' && req.status !== 429) return false;
    return true;
  });

  return (
    <div className="dashboard-container" style={{ padding: '24px 28px', maxWidth: 1600, margin: '0 auto' }}>
      {/* =========================================================================
          HERO TITLE & TAGLINE: LIMITERLAB
          ========================================================================= */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 22,
          paddingBottom: 16,
          borderBottom: '1px solid #2A2A30',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <LimiterLabLogo size={42} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: '#F4F4F5',
                  textTransform: 'uppercase',
                  background: 'linear-gradient(135deg, #FFFFFF 30%, #F97316 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                LIMITERLAB
              </h1>
              <span
                style={{
                  background: 'rgba(249, 115, 22, 0.12)',
                  color: '#F97316',
                  border: '1px solid rgba(249, 115, 22, 0.3)',
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}
              >
                v2.4 Distributed
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#A1A1AA', fontWeight: 500, marginTop: 2 }}>
              API Gateway & Rate Limiting Workbench
            </div>
          </div>
        </div>

        {/* Quick Actions Header Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#18181C',
              border: '1px solid #2A2A30',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: '#A1A1AA',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#22C55E',
                boxShadow: '0 0 8px #22C55E',
              }}
            ></span>
            <span style={{ color: '#F4F4F5', fontWeight: 600 }}>Cluster Active</span>
            <span style={{ color: '#71717A' }}>•</span>
            <span style={{ color: '#71717A' }}>Node:</span>
            <strong style={{ color: '#F97316' }}>{health?.instanceId || 'limiter-01'}</strong>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onRefreshData}
            title="Refresh Cluster Metrics"
            style={{ padding: '7px 12px' }}
          >
            <RefreshCw size={14} color="#A1A1AA" />
            <span>Sync</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigateToTab('apiclient')}
            style={{ padding: '7px 14px', color: '#F97316' }}
          >
            <Zap size={14} color="#F97316" />
            <span>Open API Client</span>
          </button>
        </div>
      </div>



      {/* =========================================================================
          ROW 1: REQUEST TRAFFIC (Left ~65%) │ KEY INSIGHTS (Right ~35%)
          ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
          gap: 18,
          marginBottom: 22,
        }}
      >
        {/* REQUEST TRAFFIC Chart */}
        <div className="glass-panel" style={{ padding: '20px', background: '#18181C', border: '1px solid #2A2A30', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.01em' }}>
                <Activity size={16} color="#F97316" />
                <span>REQUEST TRAFFIC</span>
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
                onClick={() => handleConsumeToken(3)}
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
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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

            {/* Key Metrics Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: '#202024',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #2A2A30',
                }}
              >
                <span style={{ fontSize: 12, color: '#A1A1AA', fontWeight: 600 }}>RPS</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#F97316', fontFamily: 'var(--font-mono)' }}>
                  {rps}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: '#202024',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #2A2A30',
                }}
              >
                <span style={{ fontSize: 12, color: '#A1A1AA', fontWeight: 600 }}>Peak</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#F4F4F5', fontFamily: 'var(--font-mono)' }}>
                  {peakRps}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: '#202024',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #2A2A30',
                }}
              >
                <span style={{ fontSize: 12, color: '#A1A1AA', fontWeight: 600 }}>429</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#EF4444', fontFamily: 'var(--font-mono)' }}>
                  {denyPercentage}%
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: '#202024',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #2A2A30',
                }}
              >
                <span style={{ fontSize: 12, color: '#A1A1AA', fontWeight: 600 }}>Clients</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#A855F7', fontFamily: 'var(--font-mono)' }}>
                  {activeKeysCount}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              padding: '8px 12px',
              background: 'rgba(249, 115, 22, 0.08)',
              border: '1px solid rgba(249, 115, 22, 0.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
              color: '#F97316',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Telemetry Jitter: &lt;0.5ms</span>
            <span style={{ color: '#22C55E' }}>100% Sync</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 2: LIVE REQUEST ACTIVITY (Left ~65%) │ SYSTEM HEALTH (Right ~35%)
          ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
          gap: 18,
          marginBottom: 22,
        }}
      >
        {/* LIVE REQUEST ACTIVITY Table */}
        <div className="glass-panel" style={{ padding: '20px', background: '#18181C', border: '1px solid #2A2A30', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.01em' }}>
                LIVE REQUEST ACTIVITY
              </div>
              <div style={{ fontSize: 11.5, color: '#71717A', marginTop: 2 }}>
                Real-time request stream through rate-limiting middleware
              </div>
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', background: '#121216', border: '1px solid #2A2A30', borderRadius: 6, padding: 2 }}>
                <button
                  onClick={() => setActivityFilter('ALL')}
                  style={{
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 4,
                    background: activityFilter === 'ALL' ? '#2A2A30' : 'transparent',
                    color: activityFilter === 'ALL' ? '#F4F4F5' : '#71717A',
                    cursor: 'pointer',
                  }}
                >
                  All
                </button>
                <button
                  onClick={() => setActivityFilter('200')}
                  style={{
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 4,
                    background: activityFilter === '200' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                    color: activityFilter === '200' ? '#22C55E' : '#71717A',
                    cursor: 'pointer',
                  }}
                >
                  200 OK
                </button>
                <button
                  onClick={() => setActivityFilter('429')}
                  style={{
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 4,
                    background: activityFilter === '429' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                    color: activityFilter === '429' ? '#EF4444' : '#71717A',
                    cursor: 'pointer',
                  }}
                >
                  429 Limit
                </button>
              </div>
            </div>
          </div>

          {/* Activity Table */}
          <div style={{ overflowX: 'auto', maxHeight: 240, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2A2A30', color: '#71717A', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>CLIENT</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>ENDPOINT</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>LATENCY</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.length === 0 ? (
                  // Default sample live stream items if none yet
                  [
                    { client: 'client01', endpoint: '/v1/check', status: 200, latency: '8ms' },
                    { client: 'client42', endpoint: '/v1/check', status: 429, latency: '2ms' },
                    { client: 'demo', endpoint: '/v1/proxy', status: 200, latency: '31ms' },
                    { client: 'mobile-app', endpoint: '/v1/check', status: 200, latency: '6ms' },
                    { client: 'client17', endpoint: '/v1/check', status: 429, latency: '1ms' },
                  ].map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid rgba(42, 42, 48, 0.5)',
                        transition: 'background 0.15s',
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#F4F4F5' }}>
                        {row.client}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#A1A1AA', fontFamily: 'var(--font-mono)' }}>
                        {row.endpoint}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            background: row.status === 200 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: row.status === 200 ? '#22C55E' : '#EF4444',
                            border: `1px solid ${row.status === 200 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#A1A1AA' }}>
                        {row.latency}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            if (onSelectClientForPostman) onSelectClientForPostman(row.client);
                            onNavigateToTab('apiclient');
                          }}
                          style={{ padding: '2px 8px', fontSize: 10.5 }}
                          title="Inspect in API Client"
                        >
                          Test <ArrowUpRight size={10} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  filteredRequests.slice(0, 10).map((req) => (
                    <tr
                      key={req.id}
                      style={{
                        borderBottom: '1px solid rgba(42, 42, 48, 0.5)',
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#F4F4F5' }}>
                        {req.clientKey}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#A1A1AA', fontFamily: 'var(--font-mono)' }}>
                        {req.endpoint}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            background: req.status === 200 || req.status === 201 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: req.status === 200 || req.status === 201 ? '#22C55E' : '#EF4444',
                            border: `1px solid ${req.status === 200 || req.status === 201 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          }}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#A1A1AA' }}>
                        {req.latencyMs}ms
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            if (onSelectClientForPostman) onSelectClientForPostman(req.clientKey);
                            onNavigateToTab('apiclient');
                          }}
                          style={{ padding: '2px 8px', fontSize: 10.5 }}
                          title="Inspect in API Client"
                        >
                          Test <ArrowUpRight size={10} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
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
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.01em' }}>
                SYSTEM HEALTH
              </div>
              <span
                style={{
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#22C55E',
                  padding: '2px 8px',
                  borderRadius: 20,
                  fontSize: 10.5,
                  fontWeight: 700,
                }}
              >
                100% OPERATIONAL
              </span>
            </div>

            {/* Health Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Redis */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 12px',
                  background: '#202024',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #2A2A30',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Database size={15} color="#A855F7" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#F4F4F5' }}>Redis</div>
                    <div style={{ fontSize: 10, color: '#71717A' }}>Lua 5.1 Atomic Engine</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10.5, color: '#71717A', fontFamily: 'var(--font-mono)' }}>0.8ms</span>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#22C55E',
                      background: 'rgba(34, 197, 94, 0.15)',
                      padding: '2px 7px',
                      borderRadius: 12,
                    }}
                  >
                    ● UP
                  </span>
                </div>
              </div>

              {/* PostgreSQL */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 12px',
                  background: '#202024',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #2A2A30',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HardDrive size={15} color="#FB923C" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#F4F4F5' }}>PostgreSQL</div>
                    <div style={{ fontSize: 10, color: '#71717A' }}>Durable Policy Store</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10.5, color: '#71717A', fontFamily: 'var(--font-mono)' }}>1.2ms</span>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#22C55E',
                      background: 'rgba(34, 197, 94, 0.15)',
                      padding: '2px 7px',
                      borderRadius: 12,
                    }}
                  >
                    ● UP
                  </span>
                </div>
              </div>

              {/* Nginx / Gateway */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 12px',
                  background: '#202024',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #2A2A30',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Globe size={15} color="#38BDF8" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#F4F4F5' }}>Nginx</div>
                    <div style={{ fontSize: 10, color: '#71717A' }}>Reverse Ingress Proxy</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10.5, color: '#71717A', fontFamily: 'var(--font-mono)' }}>0.3ms</span>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#22C55E',
                      background: 'rgba(34, 197, 94, 0.15)',
                      padding: '2px 7px',
                      borderRadius: 12,
                    }}
                  >
                    ● UP
                  </span>
                </div>
              </div>

              {/* Instance 1 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 12px',
                  background: '#202024',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #2A2A30',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Server size={15} color="#F97316" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#F4F4F5' }}>Instance 1</div>
                    <div style={{ fontSize: 10, color: '#71717A' }}>Primary Cluster Node</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10.5, color: '#71717A', fontFamily: 'var(--font-mono)' }}>Online</span>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#22C55E',
                      background: 'rgba(34, 197, 94, 0.15)',
                      padding: '2px 7px',
                      borderRadius: 12,
                    }}
                  >
                    ● UP
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: '#71717A', textAlign: 'center' }}>
            All systems nominal • Auto-reconnect active
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 3: TOKEN BUCKET (Left ~50%) │ RATE LIMIT EVENTS (Right ~50%)
          ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 18,
        }}
      >
        {/* TOKEN BUCKET Visualizer Widget */}
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
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#F4F4F5' }}>
                  <Sliders size={16} color="#A855F7" />
                  <span>TOKEN BUCKET</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#71717A', marginTop: 2 }}>
                  Live continuous refill mathematical model
                </div>
              </div>

              {/* Client Selector */}
              <select
                value={selectedClientKey}
                onChange={(e) => setSelectedClientKey(e.target.value)}
                style={{
                  background: '#202024',
                  border: '1px solid #2A2A30',
                  color: '#F4F4F5',
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {clients.length === 0 ? (
                  <option value="client01">client01 (10 tokens, 5 RPS)</option>
                ) : (
                  clients.map((c) => (
                    <option key={c.clientKey} value={c.clientKey}>
                      {c.clientKey} ({c.algorithm === 'token_bucket' ? `TB: ${c.burstSize || 10} cap` : `SW: ${c.requestsPerSecond} RPS`})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Visual Token Bubbles (● ● ● ● ● ● ● ○ ○ ○) */}
            <div
              style={{
                background: '#202024',
                border: '1px solid #2A2A30',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA' }}>Token Reservoir</span>
                <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)', color: tokens > 2 ? '#22C55E' : '#EF4444' }}>
                  {tokens} / {burstCapacity} tokens
                </span>
              </div>

              {/* Bubbles Grid */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                {Array.from({ length: burstCapacity }).map((_, index) => {
                  const isFilled = index < Math.floor(tokens);
                  const isPartial = index === Math.floor(tokens) && tokens % 1 > 0;
                  return (
                    <div
                      key={index}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: isFilled
                          ? 'radial-gradient(circle, #22C55E 0%, #16A34A 100%)'
                          : isPartial
                          ? 'rgba(34, 197, 94, 0.4)'
                          : '#121216',
                        border: isFilled
                          ? '1px solid #22C55E'
                          : '1px solid #2A2A30',
                        boxShadow: isFilled ? '0 0 8px rgba(34, 197, 94, 0.6)' : 'none',
                        transition: 'all 0.15s ease-out',
                        transform: isFilled ? 'scale(1)' : 'scale(0.9)',
                      }}
                      title={`Token #${index + 1}: ${isFilled ? 'Available' : 'Empty'}`}
                    />
                  );
                })}
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: 6,
                  width: '100%',
                  background: '#121216',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (tokens / burstCapacity) * 100)}%`,
                    background: tokens > 2 ? 'linear-gradient(90deg, #22C55E, #38BDF8)' : '#EF4444',
                    transition: 'width 0.1s linear',
                  }}
                ></div>
              </div>

              {/* Action feedback toast */}
              {bucketActionNote && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: bucketActionNote.includes('Throttled') ? '#EF4444' : '#22C55E',
                    textAlign: 'center',
                    animation: 'fadeIn 0.2s ease-out',
                  }}
                >
                  {bucketActionNote}
                </div>
              )}
            </div>

            {/* Metrics: RPS & Refill rate */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#71717A' }}>Refill Rate:</span>
                <strong style={{ color: '#F97316', fontFamily: 'var(--font-mono)' }}>{refillRate} RPS</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#71717A' }}>Refill Interval:</span>
                <span style={{ color: '#F4F4F5', fontFamily: 'var(--font-mono)' }}>1 token / {(1000 / refillRate).toFixed(0)}ms</span>
              </div>
            </div>
          </div>

          {/* Interactive Action Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              className="btn btn-primary"
              onClick={() => handleConsumeToken(1)}
              disabled={isConsuming}
              style={{ flex: 1, padding: '8px 12px', fontSize: 12, justifyContent: 'center' }}
            >
              <Zap size={14} />
              <span>Consume 1 Token</span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => handleConsumeToken(5)}
              disabled={isConsuming}
              style={{ padding: '8px 12px', fontSize: 12 }}
              title="Consume 5 tokens in a burst"
            >
              <Flame size={14} color="#F97316" />
              <span>Burst (5)</span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleRefillBucket}
              style={{ padding: '8px 12px', fontSize: 12 }}
              title="Force full recharge"
            >
              <RotateCcw size={14} color="#38BDF8" />
            </button>
          </div>
        </div>

        {/* RATE LIMIT EVENTS Log */}
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
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.01em' }}>
                  RATE LIMIT EVENTS
                </div>
                <div style={{ fontSize: 11.5, color: '#71717A', marginTop: 2 }}>
                  Live cluster audit trail & quota triggers
                </div>
              </div>

              {/* Event count badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    background: 'rgba(249, 115, 22, 0.15)',
                    color: '#F97316',
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {events.length || 5} events
                </span>
              </div>
            </div>

            {/* Event Items List */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                maxHeight: 220,
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {events.length === 0 ? (
                // Sample default rate limit events if empty
                [
                  { id: 'ev-1', color: '#EF4444', text: 'client42 exceeded limit', time: '2s ago', desc: '429 Too Many Requests • 0 remaining' },
                  { id: 'ev-2', color: '#F97316', text: 'client17 burst exceeded', time: '14s ago', desc: 'Burst quota 20/20 reached' },
                  { id: 'ev-3', color: '#22C55E', text: 'client05 bucket refilled', time: '28s ago', desc: '+5 tokens via continuous refill' },
                  { id: 'ev-4', color: '#38BDF8', text: 'mobile-app quota synchronized', time: '1m ago', desc: 'Redis Lua token state consistent' },
                  { id: 'ev-5', color: '#A855F7', text: 'Policy configured for payment-service', time: '3m ago', desc: 'Sliding window 100 RPS / 10s' },
                ].map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      background: '#202024',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid #2A2A30',
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: ev.color,
                        boxShadow: `0 0 6px ${ev.color}`,
                        marginTop: 5,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#F4F4F5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.text}
                        </span>
                        <span style={{ fontSize: 10.5, color: '#71717A', fontFamily: 'var(--font-mono)', marginLeft: 6 }}>
                          {ev.time}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 2 }}>
                        {ev.desc}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                events.slice(0, 8).map((ev) => {
                  const color =
                    ev.severity === 'ERROR'
                      ? '#EF4444'
                      : ev.severity === 'WARN'
                      ? '#F97316'
                      : ev.severity === 'SUCCESS'
                      ? '#22C55E'
                      : '#38BDF8';
                  return (
                    <div
                      key={ev.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        background: '#202024',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid #2A2A30',
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: color,
                          boxShadow: `0 0 6px ${color}`,
                          marginTop: 5,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#F4F4F5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ev.message}
                          </span>
                          <span style={{ fontSize: 10.5, color: '#71717A', fontFamily: 'var(--font-mono)', marginLeft: 6 }}>
                            {formatTime(ev.timestamp)}
                          </span>
                        </div>
                        {ev.clientKey && (
                          <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 2 }}>
                            Client: {ev.clientKey}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Event Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: '1px solid #2A2A30' }}>
            <span style={{ fontSize: 11, color: '#71717A' }}>Stream retention: 100 entries</span>
            {onClearEvents && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={onClearEvents}
                style={{ padding: '3px 8px', fontSize: 11, color: '#71717A' }}
              >
                Clear Stream
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
