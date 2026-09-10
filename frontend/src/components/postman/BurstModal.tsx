import React, { useState, useRef } from 'react';
import {
  Flame,
  Square,
  Activity,
  Globe
} from 'lucide-react';
import { calculatePercentile, soundFX } from '../../utils/helpers';
import { HttpMethod } from '../../types/postman';

interface BurstModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUrl: string;
  method?: HttpMethod;
  targetClientKey: string;
  headers?: Record<string, string>;
  bodyJson?: string;
  onBurstComplete: (summary: {
    total: number;
    allowed: number;
    denied: number;
    avgLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    rps: number;
    durationSec: string;
  }) => void;
}

export const BurstModal: React.FC<BurstModalProps> = ({
  isOpen,
  onClose,
  targetUrl,
  method = 'GET',
  targetClientKey,
  headers = {},
  bodyJson = '',
  onBurstComplete,
}) => {
  const [burstCount, setBurstCount] = useState<number>(50);
  const [concurrency, setConcurrency] = useState<number>(10);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [sent, setSent] = useState<number>(0);
  const [allowed, setAllowed] = useState<number>(0);
  const [denied, setDenied] = useState<number>(0);
  const [errors, setErrors] = useState<number>(0);
  const [completedSummary, setCompletedSummary] = useState<any>(null);

  const abortRef = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  const presets = [10, 50, 100, 250, 500];

  const isExternalUrl = targetUrl.startsWith('http://') || targetUrl.startsWith('https://');
  const isDirectCheck = targetUrl.includes('/v1/check');

  const handleRunBurst = async () => {
    setIsRunning(true);
    setProgress(0);
    setSent(0);
    setAllowed(0);
    setDenied(0);
    setErrors(0);
    setCompletedSummary(null);

    soundFX.playBurst();

    const abort = new AbortController();
    abortRef.current = abort;

    const recordedLatencies: number[] = [];
    let sentCount = 0;
    let allowCount = 0;
    let denyCount = 0;
    let errorCount = 0;
    const startTime = performance.now();

    // Worker function
    const runWorker = async () => {
      while (!abort.signal.aborted && sentCount < burstCount) {
        sentCount++;
        const currentCount = sentCount;
        setSent(currentCount);
        setProgress(Math.min(100, Math.floor((currentCount / burstCount) * 100)));

        const reqStart = performance.now();
        try {
          let res: Response;

          if (isExternalUrl && !targetUrl.includes('localhost:3000')) {
            // Send through Gateway Proxy
            let parsedBody: any = undefined;
            if (bodyJson.trim()) {
              try { parsedBody = JSON.parse(bodyJson); } catch (_) { parsedBody = bodyJson; }
            }

            res = await fetch('/v1/proxy', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: targetUrl,
                method,
                clientKey: targetClientKey,
                headers,
                body: parsedBody,
              }),
              signal: abort.signal,
            });
          } else {
            // Direct /v1/check
            res = await fetch('/v1/check', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...headers,
              },
              body: JSON.stringify({ clientKey: targetClientKey }),
              signal: abort.signal,
            });
          }

          const latency = Number((performance.now() - reqStart).toFixed(2));
          recordedLatencies.push(latency);

          if (res.status === 200 || res.status === 201) {
            allowCount++;
            setAllowed(allowCount);
          } else if (res.status === 429) {
            denyCount++;
            setDenied(denyCount);
          } else {
            errorCount++;
            setErrors(errorCount);
          }
        } catch (err: any) {
          if (err.name === 'AbortError') break;
          errorCount++;
          setErrors(errorCount);
        }
      }
    };

    const workerCount = Math.min(concurrency, burstCount);
    const workers = Array.from({ length: workerCount }, () => runWorker());
    await Promise.all(workers);

    const totalDurationMs = performance.now() - startTime;
    const durationSec = Math.max(0.01, totalDurationMs / 1000);
    const rps = Math.round(sentCount / durationSec);

    const avgLatency = recordedLatencies.length
      ? Number((recordedLatencies.reduce((a, b) => a + b, 0) / recordedLatencies.length).toFixed(2))
      : 0;

    const p50Latency = calculatePercentile(recordedLatencies, 50);
    const p95Latency = calculatePercentile(recordedLatencies, 95);
    const p99Latency = calculatePercentile(recordedLatencies, 99);

    setIsRunning(false);
    setProgress(100);

    const summary = {
      total: sentCount,
      allowed: allowCount,
      denied: denyCount,
      errors: errorCount,
      avgLatency,
      p50Latency,
      p95Latency,
      p99Latency,
      rps,
      durationSec: durationSec.toFixed(2),
    };
    setCompletedSummary(summary);
    onBurstComplete(summary);
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setIsRunning(false);
  };

  const allowPercent = sent > 0 ? Math.round((allowed / sent) * 100) : 0;
  const denyPercent = sent > 0 ? Math.round((denied / sent) * 100) : 0;

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 540 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}>
            <Flame size={20} color="#F97316" />
            <span style={{ color: '#F4F4F5' }}>Burst Traffic Stress Runner</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#71717A', fontSize: 20, cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        {/* Target Info Ribbon */}
        <div
          style={{
            background: '#121216',
            border: '1px solid #2A2A30',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#71717A' }}>
              Client Policy: <strong style={{ color: '#A855F7', fontFamily: 'var(--font-mono)' }}>{targetClientKey}</strong>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#3B82F6', fontSize: 11, fontWeight: 700 }}>
              <Globe size={11} /> {isDirectCheck ? 'Raw Check Mode' : 'Gateway Proxy Mode'}
            </span>
          </div>
          <div style={{ color: '#71717A', wordBreak: 'break-all' }}>
            Target: <strong style={{ color: '#F97316', fontFamily: 'var(--font-mono)' }}>{method} {targetUrl}</strong>
          </div>
        </div>

        {/* Presets Grid */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 8, display: 'block' }}>
            Total Request Volume:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {presets.map((p) => (
              <button
                key={p}
                className={`btn btn-sm ${burstCount === p ? 'btn-burst' : 'btn-secondary'}`}
                onClick={() => setBurstCount(p)}
                disabled={isRunning}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Concurrency Slider */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: '#A1A1AA', fontWeight: 600 }}>Virtual Concurrency Workers:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#A855F7' }}>{concurrency} workers</span>
          </div>
          <input
            type="range"
            min="1"
            max="50"
            value={concurrency}
            onChange={(e) => setConcurrency(parseInt(e.target.value))}
            disabled={isRunning}
            style={{ width: '100%' }}
          />
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          {isRunning ? (
            <button className="btn btn-secondary" onClick={handleStop} style={{ color: '#EF4444', flex: 1 }}>
              <Square size={13} /> Stop Stress Run
            </button>
          ) : (
            <button className="btn btn-burst" onClick={handleRunBurst} style={{ flex: 1, padding: '10px 16px' }}>
              <Flame size={15} /> Run {burstCount} Requests ({concurrency} Concurrent)
            </button>
          )}
        </div>

        {/* Real-time Progress Bar & Status Counters */}
        {(isRunning || completedSummary) && (
          <div style={{ background: '#121216', border: '1px solid #2A2A30', borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
              <span>Progress: {progress}%</span>
              <span>{sent} / {burstCount} requests</span>
            </div>

            {/* Split Progress Fill */}
            <div style={{ height: 10, background: '#202024', border: '1px solid #2A2A30', borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${allowPercent}%`, background: '#22C55E', transition: 'width 0.1s' }} />
              <div style={{ width: `${denyPercent}%`, background: '#EF4444', transition: 'width 0.1s' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: '#22C55E', fontWeight: 700 }}>● {allowed} ALLOW (200) [{allowPercent}%]</span>
              <span style={{ color: '#EF4444', fontWeight: 700 }}>● {denied} THROTTLED (429) [{denyPercent}%]</span>
              {errors > 0 && <span style={{ color: '#F59E0B' }}>● {errors} ERR</span>}
            </div>
          </div>
        )}

        {/* Completed Statistical Summary Report */}
        {completedSummary && (
          <div
            style={{
              background: '#15151B',
              border: '1px solid #2E2E38',
              borderRadius: 8,
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#F97316', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={14} />
                <span>BENCHMARK RESULTS ({completedSummary.total} reqs in {completedSummary.durationSec}s)</span>
              </div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#22C55E', fontWeight: 800 }}>
                ⚡ {completedSummary.rps} RPS
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 12 }}>
              <div style={{ background: '#1B1B22', padding: 8, borderRadius: 4 }}>
                <span style={{ color: '#71717A', display: 'block', fontSize: 11 }}>200 Allowed:</span>
                <strong style={{ color: '#22C55E', fontFamily: 'var(--font-mono)', fontSize: 14 }}>{completedSummary.allowed}</strong>
              </div>
              <div style={{ background: '#1B1B22', padding: 8, borderRadius: 4 }}>
                <span style={{ color: '#71717A', display: 'block', fontSize: 11 }}>429 Throttled:</span>
                <strong style={{ color: '#EF4444', fontFamily: 'var(--font-mono)', fontSize: 14 }}>{completedSummary.denied}</strong>
              </div>
              <div style={{ background: '#1B1B22', padding: 8, borderRadius: 4 }}>
                <span style={{ color: '#71717A', display: 'block', fontSize: 11 }}>Median (p50):</span>
                <strong style={{ color: '#F4F4F5', fontFamily: 'var(--font-mono)' }}>{completedSummary.p50Latency} ms</strong>
              </div>
              <div style={{ background: '#1B1B22', padding: 8, borderRadius: 4 }}>
                <span style={{ color: '#71717A', display: 'block', fontSize: 11 }}>P95 / P99 Latency:</span>
                <strong style={{ color: '#F97316', fontFamily: 'var(--font-mono)' }}>{completedSummary.p95Latency} ms / {completedSummary.p99Latency} ms</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
