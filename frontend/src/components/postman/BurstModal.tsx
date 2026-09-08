import React, { useState, useRef } from 'react';
import {
  Flame,
  Square
} from 'lucide-react';
import { calculatePercentile, soundFX } from '../../utils/helpers';

interface BurstModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUrl: string;
  targetClientKey: string;
  headers: Record<string, string>;
  onBurstComplete: (summary: { total: number; allowed: number; denied: number; avgLatency: number; p95Latency: number }) => void;
}

export const BurstModal: React.FC<BurstModalProps> = ({
  isOpen,
  onClose,
  targetUrl,
  targetClientKey,
  headers,
  onBurstComplete,
}) => {
  const [burstCount, setBurstCount] = useState<number>(50);
  const [concurrency, setConcurrency] = useState<number>(10);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [sent, setSent] = useState<number>(0);
  const [allowed, setAllowed] = useState<number>(0);
  const [denied, setDenied] = useState<number>(0);
  const [completedSummary, setCompletedSummary] = useState<any>(null);

  const abortRef = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  const presets = [1, 10, 50, 100, 250, 500];

  const handleRunBurst = async () => {
    setIsRunning(true);
    setProgress(0);
    setSent(0);
    setAllowed(0);
    setDenied(0);
    setCompletedSummary(null);

    soundFX.playBurst();

    const abort = new AbortController();
    abortRef.current = abort;

    const recordedLatencies: number[] = [];
    let sentCount = 0;
    let allowCount = 0;
    let denyCount = 0;
    const startTime = performance.now();

    const runWorker = async () => {
      while (!abort.signal.aborted && sentCount < burstCount) {
        sentCount++;
        setSent(sentCount);
        setProgress(Math.min(100, Math.floor((sentCount / burstCount) * 100)));

        const reqStart = performance.now();
        try {
          const res = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: JSON.stringify({ clientKey: targetClientKey }),
            signal: abort.signal,
          });

          const latency = Number((performance.now() - reqStart).toFixed(2));
          recordedLatencies.push(latency);

          if (res.status === 200) {
            allowCount++;
            setAllowed(allowCount);
          } else {
            denyCount++;
            setDenied(denyCount);
          }
        } catch (err: any) {
          if (err.name === 'AbortError') break;
          denyCount++;
          setDenied(denyCount);
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, burstCount) }, () => runWorker());
    await Promise.all(workers);

    const totalDurationMs = performance.now() - startTime;
    const avgLatency = recordedLatencies.length
      ? Number((recordedLatencies.reduce((a, b) => a + b, 0) / recordedLatencies.length).toFixed(2))
      : 0;
    const p95Latency = calculatePercentile(recordedLatencies, 95);

    setIsRunning(false);
    setProgress(100);

    const summary = {
      total: sentCount,
      allowed: allowCount,
      denied: denyCount,
      avgLatency,
      p95Latency,
      durationSec: (totalDurationMs / 1000).toFixed(2),
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

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}>
            <Flame size={20} color="#A855F7" />
            <span style={{ color: '#F4F4F5' }}>Send Requests (Burst Stress Runner)</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#71717A', fontSize: 20, cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        {/* Target Info */}
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
          <div style={{ color: '#71717A' }}>Target Client: <strong style={{ color: '#F4F4F5', fontFamily: 'var(--font-mono)' }}>{targetClientKey}</strong></div>
          <div style={{ color: '#71717A', marginTop: 2 }}>Endpoint: <strong style={{ color: '#F97316', fontFamily: 'var(--font-mono)' }}>{targetUrl}</strong></div>
        </div>

        {/* Presets Grid */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 8, display: 'block' }}>
            Request Volume Presets:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
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
        <div style={{ marginBottom: 20 }}>
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

        {/* Execution Actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          {isRunning ? (
            <button className="btn btn-secondary" onClick={handleStop} style={{ color: '#EF4444' }}>
              <Square size={13} /> Stop Burst
            </button>
          ) : (
            <button className="btn btn-burst" onClick={handleRunBurst} style={{ flex: 1 }}>
              <Flame size={14} /> Send {burstCount} Burst Requests
            </button>
          )}
        </div>

        {/* Real-time Progress Bar */}
        {(isRunning || completedSummary) && (
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 8, background: '#202024', border: '1px solid #2A2A30', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #A855F7, #F97316)',
                  transition: 'width 0.15s',
                }}
              ></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: '#22C55E' }}>● {allowed} ALLOW (200)</span>
              <span style={{ color: '#EF4444' }}>● {denied} THROTTLED (429)</span>
              <span style={{ color: '#71717A' }}>{sent} / {burstCount}</span>
            </div>
          </div>
        )}

        {/* Completed Summary Report */}
        {completedSummary && (
          <div
            style={{
              background: '#121216',
              border: '1px solid #2A2A30',
              borderRadius: 8,
              padding: 14,
              marginTop: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: '#A855F7', marginBottom: 8 }}>
              BURST RESULT ({completedSummary.total} requests in {completedSummary.durationSec}s)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12 }}>
              <div>200 OK: <strong style={{ color: '#22C55E', fontFamily: 'var(--font-mono)' }}>{completedSummary.allowed}</strong></div>
              <div>429 THROTTLED: <strong style={{ color: '#EF4444', fontFamily: 'var(--font-mono)' }}>{completedSummary.denied}</strong></div>
              <div>Average Latency: <strong style={{ color: '#F97316', fontFamily: 'var(--font-mono)' }}>{completedSummary.avgLatency} ms</strong></div>
              <div>P95 Latency: <strong style={{ color: '#F59E0B', fontFamily: 'var(--font-mono)' }}>{completedSummary.p95Latency} ms</strong></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
