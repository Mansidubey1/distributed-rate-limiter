import React, { useState } from 'react';
import {
  Sparkles,
  AlertTriangle,
  Flame,
  Clock,
  ShieldCheck,
  RotateCcw,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { ChaosState, SystemEvent } from '../types';

interface ChaosLabProps {
  onNewEvent: (event: SystemEvent) => void;
  onTriggerSurge: () => void;
}

export const ChaosLab: React.FC<ChaosLabProps> = ({ onNewEvent, onTriggerSurge }) => {
  const [chaosState, setChaosState] = useState<ChaosState>({
    redisLatencyMs: 0,
    redisFailure: false,
    ddosSurge: false,
    clockDriftMs: 0,
    degradedDb: false,
    activeInjections: 0,
  });

  const toggleRedisFailure = () => {
    const next = !chaosState.redisFailure;
    setChaosState((prev) => ({
      ...prev,
      redisFailure: next,
      activeInjections: prev.activeInjections + (next ? 1 : -1),
    }));

    onNewEvent({
      id: `evt-${Date.now()}`,
      timestamp: Date.now(),
      severity: next ? 'CRITICAL' : 'INFO',
      category: 'CHAOS',
      title: next ? 'Chaos Injected: Redis Outage' : 'Chaos Cleared: Redis Restored',
      message: next
        ? 'Simulating severed Redis connection. Ingress gateway will trigger 503 Unavailable fallback.'
        : 'Redis connection returned to normal healthy state.',
    });
  };

  const setLatencyInjection = (ms: number) => {
    const wasZero = chaosState.redisLatencyMs === 0;
    const isZero = ms === 0;
    let diff = 0;
    if (wasZero && !isZero) diff = 1;
    if (!wasZero && isZero) diff = -1;

    setChaosState((prev) => ({
      ...prev,
      redisLatencyMs: ms,
      activeInjections: prev.activeInjections + diff,
    }));

    if (!isZero) {
      onNewEvent({
        id: `evt-${Date.now()}`,
        timestamp: Date.now(),
        severity: 'WARN',
        category: 'CHAOS',
        title: `Chaos Injected: ${ms}ms Redis Latency`,
        message: `Simulating high network latency on Redis cluster link (${ms}ms added per check).`,
      });
    }
  };

  const triggerDDoS = () => {
    onTriggerSurge();
    onNewEvent({
      id: `evt-${Date.now()}`,
      timestamp: Date.now(),
      severity: 'WARN',
      category: 'CHAOS',
      title: 'Chaos Triggered: DDoS Traffic Surge Wave',
      message: 'Dispatched 100+ concurrent burst requests to test token bucket drain & throttle defense.',
    });
  };

  const resetAllChaos = () => {
    setChaosState({
      redisLatencyMs: 0,
      redisFailure: false,
      ddosSurge: false,
      clockDriftMs: 0,
      degradedDb: false,
      activeInjections: 0,
    });

    onNewEvent({
      id: `evt-${Date.now()}`,
      timestamp: Date.now(),
      severity: 'INFO',
      category: 'CHAOS',
      title: 'Chaos Deck Reset: Normalcy Restored',
      message: 'All injected latency, simulated outages, and clock drifts have been cleared.',
    });
  };

  return (
    <div>
      {/* Top Banner */}
      <div className="glass-panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">
              <Sparkles size={18} color="#A855F7" />
              <span>Chaos Engineering & Fault Injection Deck</span>
            </div>
            <div className="panel-subtitle">
              Verify distributed fault isolation, fallback responses, and cluster resilience
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={resetAllChaos}>
            <RotateCcw size={13} /> Reset All Injections
          </button>
        </div>

        {/* Status Chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div
            style={{
              background: '#202024',
              padding: 12,
              borderRadius: 'var(--radius-md)',
              border: '1px solid #2A2A30',
            }}
          >
            <span style={{ fontSize: 11, color: '#71717A' }}>Active Fault Injections</span>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: chaosState.activeInjections > 0 ? '#EF4444' : '#22C55E',
                marginTop: 2,
              }}
            >
              {chaosState.activeInjections} Active
            </div>
          </div>

          <div
            style={{
              background: '#202024',
              padding: 12,
              borderRadius: 'var(--radius-md)',
              border: '1px solid #2A2A30',
            }}
          >
            <span style={{ fontSize: 11, color: '#71717A' }}>System Resilience State</span>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: chaosState.redisFailure ? '#F59E0B' : '#22C55E',
                marginTop: 2,
              }}
            >
              {chaosState.redisFailure ? '503 Fallback Active' : 'Normal Operation'}
            </div>
          </div>
        </div>
      </div>

      {/* Fault Injection Cards Grid */}
      <div className="grid-2col">
        {/* Card 1: Redis Network Latency */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <Clock size={18} color="#F59E0B" />
                <span>Synthetic Redis Latency Injection</span>
              </div>
              <div className="panel-subtitle">Inject cross-region network delay into atomic Redis checks</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#F4F4F5' }}>
              <span>Injected Latency:</span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: '#F59E0B' }}>
                +{chaosState.redisLatencyMs}ms
              </strong>
            </div>

            <input
              type="range"
              min="0"
              max="250"
              step="10"
              value={chaosState.redisLatencyMs}
              onChange={(e) => setLatencyInjection(parseInt(e.target.value))}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`btn btn-sm ${chaosState.redisLatencyMs === 0 ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setLatencyInjection(0)}
              >
                0ms (Normal)
              </button>
              <button
                className={`btn btn-sm ${chaosState.redisLatencyMs === 50 ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setLatencyInjection(50)}
              >
                +50ms (Mild)
              </button>
              <button
                className={`btn btn-sm ${chaosState.redisLatencyMs === 200 ? 'btn-rose' : 'btn-secondary'}`}
                onClick={() => setLatencyInjection(200)}
              >
                +200ms (Severe)
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Redis Outage / 503 Fallback */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <AlertTriangle size={18} color="#EF4444" />
                <span>Redis Outage & 503 Fallback</span>
              </div>
              <div className="panel-subtitle">Sever atomic Redis connection to test circuit breaker</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 12, color: '#A1A1AA' }}>
              Under distributed failure policy, when Redis becomes unreachable, the rate limiter enters a protective
              state returning <strong>HTTP 503 Service Unavailable</strong> (preventing upstream service floods).
            </p>

            <button
              className={`btn ${chaosState.redisFailure ? 'btn-emerald' : 'btn-rose'}`}
              onClick={toggleRedisFailure}
            >
              <AlertTriangle size={14} />
              <span>{chaosState.redisFailure ? 'Restore Redis Connection' : 'Sever Redis Connection'}</span>
            </button>
          </div>
        </div>

        {/* Card 3: DDoS Traffic Surge */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <Flame size={18} color="#F97316" />
                <span>Simulated DDoS Traffic Spike</span>
              </div>
              <div className="panel-subtitle">Trigger an immediate 100+ request burst wave</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 12, color: '#A1A1AA' }}>
              Instantly fires concurrent requests to verify token consumption atomically saturates and immediately
              triggers 429 Too Many Requests with accurate Retry-After backoff delays.
            </p>

            <button className="btn btn-primary" onClick={triggerDDoS}>
              <Zap size={14} />
              <span>Dispatch 100x DDoS Burst Wave</span>
            </button>
          </div>
        </div>

        {/* Card 4: Architecture Isolation Explainer */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <ShieldCheck size={18} color="#22C55E" />
                <span>Cluster Resilience Mechanisms</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#F4F4F5' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <CheckCircle2 size={14} color="#22C55E" />
              <span>
                <strong>Atomic Lua Scripts:</strong> Eliminate race conditions under concurrency spikes.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <CheckCircle2 size={14} color="#22C55E" />
              <span>
                <strong>Durable Fallback:</strong> PostgreSQL maintains authoritative client configurations.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <CheckCircle2 size={14} color="#22C55E" />
              <span>
                <strong>Zero Memory Leaks:</strong> Sliding window automatically prunes expired timestamps.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
