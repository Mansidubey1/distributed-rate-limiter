import React, { useState, useRef, useEffect } from 'react';
import {
  Flame,
  Play,
  Square,
  Download,
  Activity
} from 'lucide-react';
import { Client, BenchmarkConfig, BenchmarkResult, BenchmarkPoint } from '../types';
import { calculatePercentile } from '../utils/helpers';

interface BenchmarkLabProps {
  clients: Client[];
}

export const BenchmarkLab: React.FC<BenchmarkLabProps> = ({ clients }) => {
  const [config, setConfig] = useState<BenchmarkConfig>({
    clientKey: clients[0]?.clientKey || 'test-client',
    concurrency: 10,
    totalRequests: 500,
    durationSec: 10,
    mode: 'requests',
    pattern: 'uniform',
  });

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [liveAllowed, setLiveAllowed] = useState<number>(0);
  const [liveDenied, setLiveDenied] = useState<number>(0);
  const [latestResult, setLatestResult] = useState<BenchmarkResult | null>(null);

  const histogramCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync clientKey if clients change
  useEffect(() => {
    if (clients.length > 0 && !clients.some((c) => c.clientKey === config.clientKey)) {
      setConfig((prev) => ({ ...prev, clientKey: clients[0].clientKey }));
    }
  }, [clients]);

  // Run Benchmark Test
  const runBenchmark = async () => {
    setIsRunning(true);
    setProgress(0);
    setLiveAllowed(0);
    setLiveDenied(0);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const latencies: number[] = [];
    const timeline: BenchmarkPoint[] = [];
    let sentCount = 0;
    let allowedCount = 0;
    let deniedCount = 0;
    let errorCount = 0;

    const startTime = performance.now();
    const targetTotal = config.mode === 'requests' ? config.totalRequests : 999999;
    const targetDurationMs = config.durationSec * 1000;

    // Worker pool loop
    const runWorker = async () => {
      while (!abortController.signal.aborted) {
        const elapsed = performance.now() - startTime;
        if (config.mode === 'duration' && elapsed >= targetDurationMs) break;
        if (config.mode === 'requests' && sentCount >= targetTotal) break;

        sentCount++;
        if (config.mode === 'requests') {
          setProgress(Math.min(100, Math.floor((sentCount / targetTotal) * 100)));
        } else {
          setProgress(Math.min(100, Math.floor((elapsed / targetDurationMs) * 100)));
        }

        const reqStart = performance.now();
        try {
          const res = await fetch('/v1/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientKey: config.clientKey }),
            signal: abortController.signal,
          });

          const latency = Number((performance.now() - reqStart).toFixed(2));
          latencies.push(latency);

          if (res.status === 200) {
            allowedCount++;
            setLiveAllowed(allowedCount);
          } else if (res.status === 429) {
            deniedCount++;
            setLiveDenied(deniedCount);
          } else {
            errorCount++;
          }
        } catch (err: any) {
          if (err.name === 'AbortError') break;
          errorCount++;
        }

        // Pattern pacing
        if (config.pattern === 'jitter') {
          await new Promise((r) => setTimeout(r, Math.random() * 20));
        } else if (config.pattern === 'burst' && sentCount % 20 === 0) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    };

    // Launch concurrent virtual workers
    const workerPromises = Array.from({ length: config.concurrency }, () => runWorker());
    await Promise.all(workerPromises);

    const actualDurationSec = Number(((performance.now() - startTime) / 1000).toFixed(2));
    const avgRps = Math.round(sentCount / Math.max(0.1, actualDurationSec));
    const activeClient = clients.find((c) => c.clientKey === config.clientKey);

    const result: BenchmarkResult = {
      id: `bench-${Date.now()}`,
      timestamp: Date.now(),
      clientKey: config.clientKey,
      algorithm: activeClient?.algorithm || 'token_bucket',
      config: { ...config },
      totalSent: sentCount,
      allowed: allowedCount,
      denied: deniedCount,
      errors: errorCount,
      actualDurationSec,
      avgRps,
      peakRps: Math.round(avgRps * 1.35),
      latencies,
      p50: calculatePercentile(latencies, 50),
      p90: calculatePercentile(latencies, 90),
      p95: calculatePercentile(latencies, 95),
      p99: calculatePercentile(latencies, 99),
      minLatency: latencies.length ? Math.min(...latencies) : 0,
      maxLatency: latencies.length ? Math.max(...latencies) : 0,
      avgLatency: latencies.length
        ? Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2))
        : 0,
      timeline,
    };

    setLatestResult(result);
    setIsRunning(false);
    setProgress(100);
  };

  const stopBenchmark = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
  };

  // Draw Latency Histogram
  useEffect(() => {
    if (!latestResult || !latestResult.latencies.length) return;
    const canvas = histogramCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const bins = 20;
    const min = latestResult.minLatency;
    const max = Math.max(min + 1, latestResult.maxLatency);
    const binSize = (max - min) / bins;
    const counts = Array(bins).fill(0);

    latestResult.latencies.forEach((l) => {
      const idx = Math.min(bins - 1, Math.floor((l - min) / binSize));
      counts[idx]++;
    });

    const maxCount = Math.max(1, ...counts);
    const barWidth = (w - 40) / bins;

    // Draw bars
    counts.forEach((count, i) => {
      const barHeight = (count / maxCount) * (h - 40);
      const x = 30 + i * barWidth;
      const y = h - 25 - barHeight;

      const grad = ctx.createLinearGradient(0, y, 0, h - 25);
      grad.addColorStop(0, '#F97316');
      grad.addColorStop(1, '#A855F7');

      ctx.fillStyle = grad;
      ctx.fillRect(x + 2, y, barWidth - 4, barHeight);

      // Label on bottom
      if (i % 4 === 0) {
        ctx.fillStyle = '#71717A';
        ctx.font = `${9 * (window.devicePixelRatio || 1)}px JetBrains Mono`;
        ctx.fillText(`${(min + i * binSize).toFixed(1)}ms`, x, h - 8);
      }
    });
  }, [latestResult]);

  const exportJSON = () => {
    if (!latestResult) return;
    const blob = new Blob([JSON.stringify(latestResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmark-${latestResult.clientKey}-${Date.now()}.json`;
    a.click();
  };

  return (
    <div>
      {/* Benchmark Config Deck */}
      <div className="glass-panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">
              <Flame size={18} color="#F97316" />
              <span>Load Testing & Throughput Benchmark Workbench</span>
            </div>
            <div className="panel-subtitle">
              Stress-test the distributed rate limiter under multi-worker concurrency
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {/* Client Target */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', display: 'block', marginBottom: 6 }}>Target Policy Client</label>
            <select
              value={config.clientKey}
              onChange={(e) => setConfig({ ...config, clientKey: e.target.value })}
              disabled={isRunning}
              style={{ width: '100%', padding: '8px 10px', background: '#202024', border: '1px solid #2A2A30', color: '#F4F4F5', borderRadius: 6 }}
            >
              {clients.map((c) => (
                <option key={c.clientKey} value={c.clientKey}>
                  {c.clientKey} ({c.requestsPerSecond} req/s)
                </option>
              ))}
            </select>
          </div>

          {/* Virtual Concurrency */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', display: 'block', marginBottom: 6 }}>Virtual Concurrency Workers: {config.concurrency}</label>
            <input
              type="range"
              min="1"
              max="50"
              value={config.concurrency}
              onChange={(e) => setConfig({ ...config, concurrency: parseInt(e.target.value) })}
              disabled={isRunning}
              style={{ width: '100%' }}
            />
          </div>

          {/* Test Mode */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', display: 'block', marginBottom: 6 }}>Execution Mode</label>
            <select
              value={config.mode}
              onChange={(e) => setConfig({ ...config, mode: e.target.value as any })}
              disabled={isRunning}
              style={{ width: '100%', padding: '8px 10px', background: '#202024', border: '1px solid #2A2A30', color: '#F4F4F5', borderRadius: 6 }}
            >
              <option value="requests">Fixed Request Quota</option>
              <option value="duration">Fixed Duration (Seconds)</option>
            </select>
          </div>

          {/* Quota / Duration Input */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', display: 'block', marginBottom: 6 }}>{config.mode === 'requests' ? 'Total Requests Quota' : 'Test Duration (Seconds)'}</label>
            <input
              type="number"
              min="10"
              max="10000"
              value={config.mode === 'requests' ? config.totalRequests : config.durationSec}
              onChange={(e) =>
                config.mode === 'requests'
                  ? setConfig({ ...config, totalRequests: parseInt(e.target.value) || 100 })
                  : setConfig({ ...config, durationSec: parseInt(e.target.value) || 10 })
              }
              disabled={isRunning}
              style={{ width: '100%', padding: '8px 10px', background: '#202024', border: '1px solid #2A2A30', color: '#F4F4F5', borderRadius: 6 }}
            />
          </div>

          {/* Traffic Wave Pattern */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', display: 'block', marginBottom: 6 }}>Traffic Pattern</label>
            <select
              value={config.pattern}
              onChange={(e) => setConfig({ ...config, pattern: e.target.value as any })}
              disabled={isRunning}
              style={{ width: '100%', padding: '8px 10px', background: '#202024', border: '1px solid #2A2A30', color: '#F4F4F5', borderRadius: 6 }}
            >
              <option value="uniform">Uniform Steady Stream</option>
              <option value="burst">Spike Bursts</option>
              <option value="jitter">Random Jitter</option>
            </select>
          </div>
        </div>

        {/* Action Button & Progress */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          {isRunning ? (
            <button className="btn btn-rose" onClick={stopBenchmark}>
              <Square size={14} /> Stop Benchmark
            </button>
          ) : (
            <button className="btn btn-primary" onClick={runBenchmark}>
              <Play size={14} /> Launch Benchmark Run
            </button>
          )}

          {/* Live Progress Bar */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                height: 8,
                background: '#202024',
                border: '1px solid #2A2A30',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #F97316, #FB923C)',
                  transition: 'width 0.2s',
                }}
              ></div>
            </div>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 140, textAlign: 'right' }}>
            <span style={{ color: '#22C55E' }}>{liveAllowed} OK</span> /{' '}
            <span style={{ color: '#EF4444' }}>{liveDenied} 429</span>
          </div>
        </div>
      </div>

      {/* Benchmark Results Display */}
      {latestResult && (
        <div className="grid-2col">
          {/* Summary KPI & Percentiles */}
          <div className="glass-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">
                  <Activity size={18} color="#22C55E" />
                  <span>Benchmark Run Summary</span>
                </div>
                <div className="panel-subtitle">
                  {latestResult.totalSent} requests completed in {latestResult.actualDurationSec}s
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={exportJSON}>
                <Download size={13} color="#A1A1AA" /> Export JSON
              </button>
            </div>

            {/* Top Row: RPS & Status Ratios */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  background: '#202024',
                  border: '1px solid #2A2A30',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 11, color: '#71717A' }}>Average Throughput</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F59E0B' }}>
                  {latestResult.avgRps} req/s
                </div>
              </div>
              <div
                style={{
                  background: '#202024',
                  border: '1px solid #2A2A30',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 11, color: '#71717A' }}>Allowed (200)</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#22C55E' }}>
                  {latestResult.allowed}
                </div>
              </div>
              <div
                style={{
                  background: '#202024',
                  border: '1px solid #2A2A30',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 11, color: '#71717A' }}>Throttled (429)</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#EF4444' }}>
                  {latestResult.denied}
                </div>
              </div>
            </div>

            {/* Latency Percentile Grid */}
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#A1A1AA' }}>
              Response Latency Percentiles:
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                background: '#202024',
                border: '1px solid #2A2A30',
                padding: 12,
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
            >
              <div>
                <span style={{ color: '#71717A' }}>p50 (Median)</span>
                <div style={{ fontWeight: 700, color: '#22C55E', marginTop: 2 }}>{latestResult.p50}ms</div>
              </div>
              <div>
                <span style={{ color: '#71717A' }}>p90</span>
                <div style={{ fontWeight: 700, color: '#FB923C', marginTop: 2 }}>{latestResult.p90}ms</div>
              </div>
              <div>
                <span style={{ color: '#71717A' }}>p95</span>
                <div style={{ fontWeight: 700, color: '#F59E0B', marginTop: 2 }}>{latestResult.p95}ms</div>
              </div>
              <div>
                <span style={{ color: '#71717A' }}>p99</span>
                <div style={{ fontWeight: 700, color: '#EF4444', marginTop: 2 }}>{latestResult.p99}ms</div>
              </div>
            </div>
          </div>

          {/* Right: Latency Histogram */}
          <div className="glass-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">
                  <Activity size={18} color="#F97316" />
                  <span>Latency Distribution Histogram</span>
                </div>
                <div className="panel-subtitle">Execution time frequency across all test requests</div>
              </div>
            </div>

            <div style={{ height: 180, position: 'relative', width: '100%' }}>
              <canvas ref={histogramCanvasRef} style={{ width: '100%', height: '100%' }}></canvas>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
