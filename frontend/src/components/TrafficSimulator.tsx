import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Play,
  Square,
  Send,
  Clock,
  Sparkles,
  Layers
} from 'lucide-react';
import { Client, RequestTrace, HeaderSnapshot, SystemEvent } from '../types';
import { soundFX, formatRelativeReset } from '../utils/helpers';

interface TrafficSimulatorProps {
  clients: Client[];
  selectedClient: string;
  onSelectClient: (clientKey: string) => void;
  onNewTrace: (trace: RequestTrace) => void;
  onNewHeaderSnapshot: (snapshot: HeaderSnapshot) => void;
  onNewEvent: (event: SystemEvent) => void;
}

export const TrafficSimulator: React.FC<TrafficSimulatorProps> = ({
  clients,
  selectedClient,
  onSelectClient,
  onNewTrace,
  onNewHeaderSnapshot,
  onNewEvent,
}) => {
  const [customBurst, setCustomBurst] = useState<number>(15);
  const [isRunningBot, setIsRunningBot] = useState<boolean>(false);
  const [botRps, setBotRps] = useState<number>(12);
  const [recentLogs, setRecentLogs] = useState<RequestTrace[]>([]);
  const [simulatedTokens, setSimulatedTokens] = useState<number>(20);
  const [maxTokens, setMaxTokens] = useState<number>(20);
  const [resetEpoch, setResetEpoch] = useState<number>(Math.floor(Date.now() / 1000) + 1);
  const [isFiring, setIsFiring] = useState<boolean>(false);
  const [slidingWindowDots, setSlidingWindowDots] = useState<{ id: string; time: number; allowed: boolean }[]>([]);

  const botIntervalRef = useRef<any>(null);
  const activeClientObj = clients.find((c) => c.clientKey === selectedClient) || clients[0];

  // Synchronize initial capacity when client changes
  useEffect(() => {
    if (activeClientObj) {
      const burst = activeClientObj.burstSize || activeClientObj.requestsPerSecond || 20;
      setMaxTokens(burst);
      setSimulatedTokens(burst);
    }
  }, [selectedClient, activeClientObj]);

  // Continuous Refill Tick simulation for Token Bucket visualizer
  useEffect(() => {
    if (!activeClientObj || activeClientObj.algorithm !== 'token_bucket') return;

    const interval = setInterval(() => {
      setSimulatedTokens((prev) => {
        const refillPerTick = activeClientObj.requestsPerSecond * 0.1;
        const next = Math.min(maxTokens, prev + refillPerTick);
        return Number(next.toFixed(2));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeClientObj, maxTokens]);

  // Sliding window dot cleanup
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const windowMs = (activeClientObj?.windowSize || 10) * 1000;
      setSlidingWindowDots((prev) => prev.filter((d) => now - d.time < windowMs));
    }, 500);
    return () => clearInterval(timer);
  }, [activeClientObj]);

  // Execute Batch or Single Check Request
  const fireRequests = async (count: number) => {
    if (!selectedClient && clients.length > 0) {
      onSelectClient(clients[0].clientKey);
    }
    const targetKey = selectedClient || clients[0]?.clientKey;
    if (!targetKey) return;

    setIsFiring(true);
    if (count > 1) soundFX.playBurst();

    const promises = Array.from({ length: count }, async (_, index) => {
      const startMs = performance.now();
      const reqId = `sim-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const traceId = `trc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

      try {
        const res = await fetch('/v1/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Trace-Id': traceId,
          },
          body: JSON.stringify({ clientKey: targetKey }),
        });

        const latencyMs = Number((performance.now() - startMs).toFixed(2));
        const rawHeaders: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          rawHeaders[k] = v;
        });

        const data = await res.json().catch(() => ({}));
        const isAllow = res.status === 200;

        if (isAllow) soundFX.playAllow();
        else soundFX.playDeny();

        const limit = Number(res.headers.get('x-ratelimit-limit') || data.limit || maxTokens);
        const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? data.remaining ?? 0);
        const reset = Number(res.headers.get('x-ratelimit-reset') || data.reset || Math.floor(Date.now() / 1000) + 1);
        const retryAfter = res.headers.get('retry-after') ? Number(res.headers.get('retry-after')) : data.retryAfter;

        setMaxTokens(limit);
        setSimulatedTokens(remaining);
        setResetEpoch(reset);

        // Add sliding window dot
        setSlidingWindowDots((prev) => [
          ...prev,
          { id: reqId + index, time: Date.now(), allowed: isAllow },
        ]);

        // Synthesize waterfall spans for Request Tracing
        const ingressDuration = Number((latencyMs * 0.15).toFixed(2));
        const redisDuration = Number((latencyMs * 0.65).toFixed(2));
        const evalDuration = Number((latencyMs * 0.2).toFixed(2));

        const trace: RequestTrace = {
          id: reqId,
          traceId,
          requestId: data.requestId || reqId,
          clientKey: targetKey,
          algorithm: activeClientObj?.algorithm || 'token_bucket',
          decision: isAllow ? 'ALLOW' : 'DENY',
          statusCode: res.status,
          latencyMs,
          remaining,
          limit,
          reset,
          retryAfter,
          instanceId: res.headers.get('x-instance-id') || data.instanceId || 'limiter-01',
          timestamp: Date.now(),
          spans: [
            {
              id: 'sp-1',
              name: 'Gateway Ingress & Validation',
              startTime: 0,
              durationMs: ingressDuration,
              status: 'ok',
              description: 'Client authentication & payload validation',
            },
            {
              id: 'sp-2',
              name: 'Redis Lua Script Atomic Exec',
              startTime: ingressDuration,
              durationMs: redisDuration,
              status: isAllow ? 'ok' : 'throttled',
              description: activeClientObj?.algorithm === 'sliding_window'
                ? 'ZREMRANGEBYSCORE + ZADD sliding log evaluation'
                : 'Continuous token replenishment & capacity consumption',
            },
            {
              id: 'sp-3',
              name: 'Header Serialization & Decision',
              startTime: ingressDuration + redisDuration,
              durationMs: evalDuration,
              status: isAllow ? 'ok' : 'throttled',
              description: `Generated standard headers with ${remaining} tokens remaining`,
            },
          ],
          headers: rawHeaders,
          payload: { clientKey: targetKey },
        };

        // Notify parent streams
        onNewTrace(trace);
        onNewHeaderSnapshot({
          timestamp: Date.now(),
          clientKey: targetKey,
          statusCode: res.status,
          decision: isAllow ? 'ALLOW' : 'DENY',
          limit,
          remaining,
          reset,
          retryAfter,
          instanceId: trace.instanceId,
          requestId: trace.requestId,
          rawHeaders,
        });

        if (!isAllow) {
          onNewEvent({
            id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            timestamp: Date.now(),
            severity: 'WARN',
            category: 'THROTTLE',
            title: `Rate Limit Throttled: ${targetKey}`,
            message: `Client exceeded burst limit. HTTP 429 emitted (Retry-After: ${retryAfter || 1}s)`,
            details: { clientKey: targetKey, remaining, limit, retryAfter },
          });
        }

        return trace;
      } catch (err: any) {
        return null;
      }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter((r): r is RequestTrace => r !== null);
    setRecentLogs((prev) => [...validResults.slice(-15), ...prev].slice(0, 30));
    setIsFiring(false);
  };

  // Automated Traffic Bot Start / Stop
  const toggleTrafficBot = () => {
    if (isRunningBot) {
      if (botIntervalRef.current) clearInterval(botIntervalRef.current);
      setIsRunningBot(false);
    } else {
      setIsRunningBot(true);
      const intervalMs = Math.max(50, Math.floor(1000 / botRps));
      botIntervalRef.current = setInterval(() => {
        fireRequests(1);
      }, intervalMs);
    }
  };

  useEffect(() => {
    return () => {
      if (botIntervalRef.current) clearInterval(botIntervalRef.current);
    };
  }, []);

  const fillPercent = Math.min(100, Math.max(0, (simulatedTokens / Math.max(1, maxTokens)) * 100));
  const isTb = activeClientObj?.algorithm === 'token_bucket';

  return (
    <div>
      {/* Top Selector & Bot Control Bar */}
      <div className="glass-panel" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {/* Client Target Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#F4F4F5' }}>
              Target Client:
            </label>
            <select
              value={selectedClient}
              onChange={(e) => onSelectClient(e.target.value)}
              style={{
                minWidth: 240,
                fontWeight: 600,
                background: '#202024',
                color: '#F4F4F5',
                border: '1px solid #2A2A30',
                borderRadius: 6,
                padding: '6px 10px',
              }}
            >
              {clients.map((c) => (
                <option key={c.clientKey} value={c.clientKey}>
                  {c.clientKey} ({c.algorithm === 'token_bucket' ? 'Token Bucket' : 'Sliding Window'} - {c.requestsPerSecond} req/s)
                </option>
              ))}
            </select>

            <span className={`algo-tag ${isTb ? 'algo-tb' : 'algo-sw'}`}>
              {isTb ? 'Continuous Refill' : 'Sliding Window Log'}
            </span>
          </div>

          {/* Automated Traffic Bot Switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: '#202024',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #2A2A30',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: '#A1A1AA' }}>
              Automated Bot:
            </span>
            <input
              type="range"
              min="1"
              max="40"
              value={botRps}
              onChange={(e) => setBotRps(parseInt(e.target.value))}
              disabled={isRunningBot}
              style={{ width: 90 }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 50, color: '#F59E0B' }}>
              {botRps} req/s
            </span>
            <button
              className={`btn btn-sm ${isRunningBot ? 'btn-rose' : 'btn-emerald'}`}
              onClick={toggleTrafficBot}
            >
              {isRunningBot ? (
                <>
                  <Square size={12} /> Stop Bot
                </>
              ) : (
                <>
                  <Play size={12} /> Run Bot
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Visualizer & Trigger Deck */}
      <div className="grid-2col">
        {/* Left: Dynamic Visualizer (Token Bucket / Sliding Window) */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <Sparkles size={18} color="#A855F7" />
                <span>{isTb ? 'Live Token Bucket Liquid Reservoir' : 'Live Sliding Window Timeline'}</span>
              </div>
              <div className="panel-subtitle">
                {isTb
                  ? 'Visual token replenishment & burst consumption physics'
                  : 'Time-window sliding log request distribution'}
              </div>
            </div>
            <div className="pill-badge">
              <Clock size={12} color="#F97316" />
              <span>Reset: {formatRelativeReset(resetEpoch)}</span>
            </div>
          </div>

          {isTb ? (
            /* Token Bucket Liquid Animation */
            <div className="bucket-visualizer-card">
              <div className="bucket-cylinder">
                <div
                  className="bucket-liquid"
                  style={{
                    height: `${fillPercent}%`,
                    background:
                      fillPercent > 50
                        ? 'linear-gradient(180deg, #22C55E, #F97316)'
                        : fillPercent > 20
                        ? 'linear-gradient(180deg, #F59E0B, #A855F7)'
                        : 'linear-gradient(180deg, #EF4444, #991B1B)',
                  }}
                >
                  <div className="bucket-liquid-wave"></div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: 18 }}>
                <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F4F4F5' }}>
                  {Math.round(simulatedTokens)}{' '}
                  <span style={{ fontSize: 16, color: '#71717A' }}>/ {maxTokens} tokens</span>
                </div>
                <div style={{ fontSize: 12, color: '#71717A', marginTop: 4 }}>
                  Refill Rate: +{activeClientObj?.requestsPerSecond || 10} tokens/sec
                </div>
              </div>
            </div>
          ) : (
            /* Sliding Window Timeline Animation */
            <div style={{ padding: '24px 12px' }}>
              <div
                style={{
                  position: 'relative',
                  height: 120,
                  background: '#121216',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #2A2A30',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {/* Active Window Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: '8px 20px',
                    border: '2px dashed #A855F7',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(168, 85, 247, 0.08)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-end',
                    padding: 6,
                    fontSize: 11,
                    color: '#A855F7',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Active Window ({activeClientObj?.windowSize || 10}s)
                </div>

                {/* Plotted Dots */}
                {slidingWindowDots.map((dot) => {
                  const now = Date.now();
                  const windowMs = (activeClientObj?.windowSize || 10) * 1000;
                  const ageMs = now - dot.time;
                  const xPercent = Math.max(5, Math.min(95, 100 - (ageMs / windowMs) * 90));
                  return (
                    <div
                      key={dot.id}
                      style={{
                        position: 'absolute',
                        left: `${xPercent}%`,
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: dot.allowed ? '#22C55E' : '#EF4444',
                        boxShadow: dot.allowed ? '0 0 10px #22C55E' : '0 0 10px #EF4444',
                        transition: 'left 0.5s linear',
                      }}
                      title={dot.allowed ? '200 ALLOW' : '429 THROTTLED'}
                    ></div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12 }}>
                <span style={{ color: '#71717A' }}>← Older (Expiring)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#A855F7' }}>
                  Current Window Count: {slidingWindowDots.filter((d) => d.allowed).length} / {activeClientObj?.requestsPerSecond || 10} quota
                </span>
                <span style={{ color: '#71717A' }}>Latest (Now) →</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Interactive Burst Dispatcher */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <Zap size={18} color="#F97316" />
                <span>Interactive Traffic Dispatcher</span>
              </div>
              <div className="panel-subtitle">Fire single checks or instant high-concurrency bursts</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Quick Burst Presets */}
            <div>
              <label style={{ marginBottom: 8, display: 'block', color: '#A1A1AA', fontSize: 12, fontWeight: 600 }}>Instant Burst Presets:</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => fireRequests(1)}
                  disabled={isFiring}
                >
                  <Send size={13} color="#F97316" />
                  <span>1 Req</span>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => fireRequests(5)}
                  disabled={isFiring}
                >
                  <span>5 Burst</span>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => fireRequests(25)}
                  disabled={isFiring}
                >
                  <span>25 Burst</span>
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => fireRequests(50)}
                  disabled={isFiring}
                >
                  <Zap size={13} />
                  <span>50 Stress</span>
                </button>
              </div>
            </div>

            {/* Custom Burst Slider */}
            <div
              style={{
                background: '#202024',
                border: '1px solid #2A2A30',
                borderRadius: 'var(--radius-md)',
                padding: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#A1A1AA' }}>Custom Concurrent Burst Size:</label>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F97316' }}>
                  {customBurst} requests
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={customBurst}
                  onChange={(e) => setCustomBurst(parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => fireRequests(customBurst)}
                  disabled={isFiring}
                >
                  Fire {customBurst}x
                </button>
              </div>
            </div>

            {/* Live Parameter Summary */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                background: '#202024',
                border: '1px solid #2A2A30',
                padding: 12,
                borderRadius: 'var(--radius-md)',
                fontSize: 11,
              }}
            >
              <div>
                <span style={{ color: '#71717A' }}>Configured Rate:</span>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, marginTop: 2, color: '#F4F4F5' }}>
                  {activeClientObj?.requestsPerSecond || 10} req/s
                </div>
              </div>
              <div>
                <span style={{ color: '#71717A' }}>Burst Capacity:</span>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, marginTop: 2, color: '#F4F4F5' }}>
                  {isTb ? activeClientObj?.burstSize || 20 : `${activeClientObj?.windowSize || 10}s window`}
                </div>
              </div>
              <div>
                <span style={{ color: '#71717A' }}>Current Status:</span>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: 13,
                    marginTop: 2,
                    color: isRunningBot ? '#22C55E' : isFiring ? '#F59E0B' : '#A1A1AA',
                  }}
                >
                  {isRunningBot ? 'Bot Active' : isFiring ? 'Firing...' : 'Ready'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Decision Feed */}
      <div className="glass-panel" style={{ marginTop: 24 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">
              <Layers size={18} color="#F97316" />
              <span>Live Decision Stream</span>
            </div>
            <div className="panel-subtitle">Immediate response logs from recent evaluations</div>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Decision</th>
                <th>Trace / Request ID</th>
                <th>Client Key</th>
                <th>Remaining</th>
                <th>Reset In</th>
                <th>Latency</th>
                <th>Node Instance</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#71717A' }}>
                    No test requests dispatched yet. Click a burst button above!
                  </td>
                </tr>
              ) : (
                recentLogs.slice(0, 10).map((log) => {
                  const isAllow = log.decision === 'ALLOW';
                  return (
                    <tr key={log.id}>
                      <td>
                        <span className={isAllow ? 'status-badge-allow' : 'status-badge-deny'}>
                          {isAllow ? '200 ALLOW' : '429 THROTTLE'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#A1A1AA' }}>
                        {log.requestId}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#F4F4F5' }}>{log.clientKey}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: isAllow ? '#22C55E' : '#EF4444' }}>
                        {log.remaining} / {log.limit}
                      </td>
                      <td style={{ fontSize: 11, color: '#71717A' }}>
                        {formatRelativeReset(log.reset)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#F97316' }}>
                        {log.latencyMs}ms
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#71717A' }}>
                        {log.instanceId}
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
