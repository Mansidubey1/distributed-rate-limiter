import React, { useState } from 'react';
import {
  Zap,
  Clock,
  Sparkles,
  RotateCcw
} from 'lucide-react';

export const AlgorithmVisualizer: React.FC = () => {
  // Sandbox State for Step-by-Step Lab
  const [tbTokens, setTbTokens] = useState<number>(10);
  const tbMax = 10;
  const tbRate = 5; // 5 tokens/s

  const [swLogs, setSwLogs] = useState<number[]>([]);
  const swWindowSec = 10;
  const swQuota = 8;

  const [simTimeSec, setSimTimeSec] = useState<number>(0);
  const [logHistory, setLogHistory] = useState<string[]>([]);

  // Step Time Forward
  const stepTime = (deltaSec: number) => {
    const nextTime = simTimeSec + deltaSec;
    setSimTimeSec(Number(nextTime.toFixed(1)));

    // Token Bucket Refill Math
    setTbTokens((prev) => {
      const added = deltaSec * tbRate;
      const total = Math.min(tbMax, prev + added);
      return Number(total.toFixed(2));
    });

    // Sliding Window Expiration Math
    setSwLogs((prev) => prev.filter((t) => nextTime - t <= swWindowSec));
  };

  // Dispatch Manual Request in Sandbox
  const dispatchSandboxRequest = () => {
    let tbResult = false;
    let swResult = false;

    // Token Bucket check
    if (tbTokens >= 1) {
      setTbTokens((prev) => Number((prev - 1).toFixed(2)));
      tbResult = true;
    }

    // Sliding Window check
    const currentValidLogs = swLogs.filter((t) => simTimeSec - t <= swWindowSec);
    if (currentValidLogs.length < swQuota) {
      setSwLogs([...currentValidLogs, simTimeSec]);
      swResult = true;
    }

    const logEntry = `T+${simTimeSec.toFixed(1)}s: Request dispatched → TB: ${
      tbResult ? '✅ ALLOW (-1 Token)' : '❌ DENY (Empty Bucket)'
    } | SW: ${swResult ? '✅ ALLOW (Logged)' : '❌ DENY (Quota Full)'}`;

    setLogHistory((prev) => [logEntry, ...prev].slice(0, 8));
  };

  const resetSandbox = () => {
    setTbTokens(tbMax);
    setSwLogs([]);
    setSimTimeSec(0);
    setLogHistory([]);
  };

  return (
    <div>
      {/* Side-by-Side Algorithm Architecture */}
      <div className="grid-2col" style={{ marginBottom: 24 }}>
        {/* Token Bucket Overview */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <Zap size={18} color="#F97316" />
                <span>Token Bucket Algorithm</span>
              </div>
              <div className="panel-subtitle">Continuous Mathematical Replenishment</div>
            </div>
            <span className="algo-tag algo-tb">Continuous Refill</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              Tokens are added to a bucket at a constant refill rate $r$. The bucket holds up to burst capacity $B$.
              Incoming requests consume 1 token. If the bucket is empty, requests are throttled (HTTP 429).
            </p>

            <div className="code-box">
              <span style={{ color: '#F97316' }}>Tokens(t)</span> = min(BurstCapacity, Tokens(t_last) + RefillRate × (t - t_last))
            </div>

            <div style={{ background: '#202024', border: '1px solid #2A2A30', padding: 12, borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: '#22C55E' }}>Key Advantages:</div>
              <ul style={{ paddingLeft: 18, color: 'var(--text-muted)', fontSize: 12 }}>
                <li>Extremely memory efficient (O(1) memory per client key in Redis).</li>
                <li>Allows sudden bursts without violating long-term average rate.</li>
                <li>Zero background timers; evaluated lazily on each request.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Sliding Window Overview */}
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <Clock size={18} color="#A855F7" />
                <span>Sliding Window Log Algorithm</span>
              </div>
              <div className="panel-subtitle">Rolling Time Window with Atomic Sorted Sets</div>
            </div>
            <span className="algo-tag algo-sw">Sliding Window Log</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              Tracks exact timestamps of past requests within a moving time window $W$. On each request, expired
              timestamps are atomically pruned, and current count is compared against quota $Q$.
            </p>

            <div className="code-box">
              <span style={{ color: '#A855F7' }}>ActiveCount(t)</span> = |&#123; t_i ∈ RedisSortedSet | t_i &gt; t - WindowSize &#125;|
            </div>

            <div style={{ background: '#202024', border: '1px solid #2A2A30', padding: 12, borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: '#A855F7' }}>Key Advantages:</div>
              <ul style={{ paddingLeft: 18, color: 'var(--text-muted)', fontSize: 12 }}>
                <li>Completely prevents boundary burst exploits (unlike Fixed Window).</li>
                <li>Guarantees strict rolling window quota enforcement.</li>
                <li>Atomic execution via Redis Lua script (ZREMRANGEBYSCORE + ZCARD).</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Step-by-Step Simulation Sandbox */}
      <div className="glass-panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">
              <Sparkles size={18} color="#A855F7" />
              <span>Interactive Step-by-Step Simulation Lab</span>
            </div>
            <div className="panel-subtitle">
              Simulate time passage and fire requests to observe side-by-side internal state mutations
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="pill-badge">
              <Clock size={12} color="#F59E0B" />
              <span>Simulated Time: T+{simTimeSec.toFixed(1)}s</span>
            </span>
            <button className="btn btn-secondary btn-sm" onClick={resetSandbox}>
              <RotateCcw size={12} /> Reset Lab
            </button>
          </div>
        </div>

        {/* Step Time Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: '#202024',
            border: '1px solid #2A2A30',
            padding: 14,
            borderRadius: 'var(--radius-md)',
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: '#F4F4F5' }}>Advance Clock:</span>
          <button className="btn btn-secondary btn-sm" onClick={() => stepTime(0.1)}>
            +0.1s
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => stepTime(0.5)}>
            +0.5s
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => stepTime(1.0)}>
            +1.0s
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => stepTime(2.0)}>
            +2.0s
          </button>

          <div style={{ width: 1, height: 24, background: '#2A2A30', margin: '0 8px' }}></div>

          <button className="btn btn-primary" onClick={dispatchSandboxRequest}>
            <Zap size={14} /> Dispatch Request (Consume 1 Token)
          </button>
        </div>

        {/* State Comparison Display */}
        <div className="grid-2col" style={{ marginBottom: 20 }}>
          {/* TB Live State */}
          <div
            style={{
              background: 'rgba(249, 115, 22, 0.05)',
              border: '1px solid rgba(249, 115, 22, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 700, color: '#F97316', marginBottom: 8 }}>
              Token Bucket State (Refill: {tbRate}/s, Max: {tbMax})
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F4F4F5' }}>
              {tbTokens} <span style={{ fontSize: 14, color: '#71717A' }}>/ {tbMax} tokens</span>
            </div>
            <div
              style={{
                height: 8,
                background: '#202024',
                border: '1px solid #2A2A30',
                borderRadius: 4,
                overflow: 'hidden',
                marginTop: 10,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${(tbTokens / tbMax) * 100}%`,
                  background: 'linear-gradient(90deg, #F97316, #FB923C)',
                }}
              ></div>
            </div>
          </div>

          {/* SW Live State */}
          <div
            style={{
              background: 'rgba(168, 85, 247, 0.05)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 700, color: '#A855F7', marginBottom: 8 }}>
              Sliding Window State (Window: {swWindowSec}s, Quota: {swQuota})
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F4F4F5' }}>
              {swLogs.length} <span style={{ fontSize: 14, color: '#71717A' }}>/ {swQuota} requests logged</span>
            </div>
            <div
              style={{
                height: 8,
                background: '#202024',
                border: '1px solid #2A2A30',
                borderRadius: 4,
                overflow: 'hidden',
                marginTop: 10,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (swLogs.length / swQuota) * 100)}%`,
                  background: swLogs.length >= swQuota ? '#EF4444' : '#22C55E',
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Sandbox Step Log */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#A1A1AA' }}>
            Sandbox Execution Log:
          </div>
          <div className="code-box" style={{ minHeight: 100 }}>
            {logHistory.length === 0 ? (
              <span style={{ color: '#71717A' }}>
                Click "Dispatch Request" or advance the clock to observe live step evaluations...
              </span>
            ) : (
              logHistory.map((line, idx) => (
                <div key={idx} style={{ color: line.includes('ALLOW') ? '#22C55E' : '#EF4444' }}>
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
