import React, { useState, useEffect } from 'react';
import {
  Sparkles
} from 'lucide-react';
import { Client } from '../../types';

interface VisualizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeClient: Client | null;
  remainingTokens: number;
  burstLimit: number;
}

export const VisualizeModal: React.FC<VisualizeModalProps> = ({
  isOpen,
  onClose,
  activeClient,
  remainingTokens,
  burstLimit,
}) => {
  const [simTokens, setSimTokens] = useState<number>(remainingTokens);
  const [dots, setDots] = useState<{ id: string; time: number; allowed: boolean }[]>([]);

  const limit = burstLimit || activeClient?.burstSize || activeClient?.requestsPerSecond || 20;
  const isTb = activeClient?.algorithm !== 'sliding_window';

  useEffect(() => {
    setSimTokens(remainingTokens);
  }, [remainingTokens]);

  // Continuous Refill Simulation tick for Token Bucket
  useEffect(() => {
    if (!isOpen || !isTb) return;
    const interval = setInterval(() => {
      setSimTokens((prev) => {
        const refill = (activeClient?.requestsPerSecond || 5) * 0.1;
        return Number(Math.min(limit, prev + refill).toFixed(2));
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isOpen, isTb, activeClient, limit]);

  // Sliding window dot cleanup
  useEffect(() => {
    if (!isOpen || isTb) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const winMs = (activeClient?.windowSize || 10) * 1000;
      setDots((prev) => prev.filter((d) => now - d.time < winMs));
    }, 500);
    return () => clearInterval(interval);
  }, [isOpen, isTb, activeClient]);

  if (!isOpen) return null;

  const fillPercent = Math.min(100, Math.max(0, (simTokens / Math.max(1, limit)) * 100));

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}>
            <Sparkles size={20} color="#A855F7" />
            <span style={{ color: '#F4F4F5' }}>Algorithm Physics Visualizer</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#71717A', fontSize: 20, cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        {/* Algorithm Type Info */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#121216',
            border: '1px solid #2A2A30',
            borderRadius: 8,
            padding: 12,
            marginBottom: 20,
          }}
        >
          <div>
            <span style={{ fontSize: 11, color: '#71717A' }}>Target Client:</span>
            <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#F4F4F5' }}>
              {activeClient?.clientKey || 'mobile-app-client'}
            </div>
          </div>
          <span className={`algo-tag ${isTb ? 'algo-tb' : 'algo-sw'}`}>
            {isTb ? 'Token Bucket (Continuous Refill)' : 'Sliding Window (Sorted Set)'}
          </span>
        </div>

        {/* Dynamic Animation */}
        {isTb ? (
          /* Token Bucket Liquid Physics */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
            <div
              style={{
                width: 170,
                height: 220,
                border: '3px solid #2A2A30',
                borderTop: 'none',
                borderRadius: '0 0 28px 28px',
                position: 'relative',
                overflow: 'hidden',
                background: '#202024',
                boxShadow: '0 0 30px rgba(249, 115, 22, 0.15), inset 0 0 20px rgba(0, 0, 0, 0.8)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${fillPercent}%`,
                  background:
                    fillPercent > 50
                      ? 'linear-gradient(180deg, #22C55E, #F97316)'
                      : fillPercent > 20
                      ? 'linear-gradient(180deg, #F59E0B, #A855F7)'
                      : 'linear-gradient(180deg, #EF4444, #991B1B)',
                  transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 0 20px rgba(249, 115, 22, 0.4)',
                }}
              ></div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F4F4F5' }}>
                {Math.round(simTokens)} <span style={{ fontSize: 16, color: '#71717A' }}>/ {limit} tokens</span>
              </div>
              <div style={{ fontSize: 12, color: '#71717A', marginTop: 4 }}>
                Refill Rate: +{activeClient?.requestsPerSecond || 5} tokens/sec
              </div>
            </div>
          </div>
        ) : (
          /* Sliding Window Timeline Animation */
          <div style={{ padding: '20px 0' }}>
            <div
              style={{
                position: 'relative',
                height: 120,
                background: '#121216',
                borderRadius: 8,
                border: '1px solid #2A2A30',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '8px 20px',
                  border: '2px dashed #A855F7',
                  borderRadius: 6,
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
                {activeClient?.windowSize || 10}s Active Window
              </div>

              {dots.map((dot) => {
                const now = Date.now();
                const winMs = (activeClient?.windowSize || 10) * 1000;
                const age = now - dot.time;
                const x = Math.max(5, Math.min(95, 100 - (age / winMs) * 90));
                return (
                  <div
                    key={dot.id}
                    style={{
                      position: 'absolute',
                      left: `${x}%`,
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: dot.allowed ? '#22C55E' : '#EF4444',
                      boxShadow: dot.allowed ? '0 0 10px #22C55E' : '0 0 10px #EF4444',
                    }}
                  ></div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: '#71717A' }}>
              <span>← Expired requests</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#A855F7' }}>
                Window Quota: {activeClient?.requestsPerSecond || 10} requests
              </span>
              <span>Latest (Now) →</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
