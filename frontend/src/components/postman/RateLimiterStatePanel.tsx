import React, { useEffect, useState } from 'react';
import {
  Zap,
  Clock
} from 'lucide-react';
import { ResponseSnapshot } from '../../types/postman';
import { Client } from '../../types';

interface RateLimiterStatePanelProps {
  latestResponse: ResponseSnapshot | null;
  activeClient: Client | null;
}

export const RateLimiterStatePanel: React.FC<RateLimiterStatePanelProps> = ({
  latestResponse,
  activeClient,
}) => {
  const [countdownSec, setCountdownSec] = useState<string>('0.0s');

  const limit = latestResponse?.limit || activeClient?.burstSize || activeClient?.requestsPerSecond || 20;
  const remaining = latestResponse ? latestResponse.remaining : limit;
  const resetEpoch = latestResponse?.reset || Math.floor(Date.now() / 1000) + 1;
  const isAllow = latestResponse ? latestResponse.decision === 'ALLOW' : true;
  const algo = latestResponse?.algorithm || activeClient?.algorithm || 'token_bucket';
  const clientKey = latestResponse?.body?.clientKey || activeClient?.clientKey || 'mobile-app-client';

  // Live countdown timer for reset
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now() / 1000;
      const diff = Math.max(0, resetEpoch - now);
      setCountdownSec(`${diff.toFixed(1)}s`);
    }, 100);
    return () => clearInterval(timer);
  }, [resetEpoch]);

  const fillPercent = Math.min(100, Math.max(0, (remaining / Math.max(1, limit)) * 100));

  // ASCII Bar for Postman Terminal Aesthetic
  const totalBlocks = 20;
  const filledBlocks = Math.round((remaining / Math.max(1, limit)) * totalBlocks);
  const asciiBar = '█'.repeat(filledBlocks) + '░'.repeat(Math.max(0, totalBlocks - filledBlocks));

  return (
    <div className="pm-limiter-state-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#A855F7' }}>
          <Zap size={14} color="#A855F7" />
          <span>Rate Limit State</span>
        </div>
      </div>

      {/* Grid of Key Properties */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 11, marginBottom: 12 }}>
        <div>
          <span style={{ color: '#71717A' }}>Client Key</span>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F4F4F5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {clientKey}
          </div>
        </div>

        <div>
          <span style={{ color: '#71717A' }}>Algorithm</span>
          <div>
            <span className={`algo-tag ${algo === 'token_bucket' ? 'algo-tb' : 'algo-sw'}`} style={{ fontSize: 10 }}>
              {algo === 'token_bucket' ? 'Token Bucket' : 'Sliding Window'}
            </span>
          </div>
        </div>

        <div>
          <span style={{ color: '#71717A' }}>Refill Rate</span>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#A1A1AA' }}>
            {activeClient?.requestsPerSecond || 10} tokens/sec
          </div>
        </div>

        <div>
          <span style={{ color: '#71717A' }}>Capacity / Window</span>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#A1A1AA' }}>
            {algo === 'token_bucket' ? `${limit} tokens burst` : `${activeClient?.windowSize || 10}s window`}
          </div>
        </div>
      </div>

      {/* Visual Token Fill Progress Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: '#71717A', fontWeight: 600 }}>Available Tokens:</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: fillPercent > 20 ? '#22C55E' : '#EF4444' }}>
            {remaining} / {limit} tokens
          </span>
        </div>

        <div className="pm-token-progress-bar">
          <div
            className="pm-token-progress-fill"
            style={{
              width: `${fillPercent}%`,
              background:
                fillPercent > 50
                  ? 'linear-gradient(90deg, #22C55E, #F97316)'
                  : fillPercent > 20
                  ? 'linear-gradient(90deg, #F59E0B, #A855F7)'
                  : 'linear-gradient(90deg, #EF4444, #B91C1C)',
              boxShadow: fillPercent > 20 ? '0 0 10px rgba(34, 197, 94, 0.4)' : '0 0 10px rgba(239, 68, 68, 0.4)',
            }}
          ></div>
        </div>

        {/* ASCII Readout */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#71717A', letterSpacing: '0.05em' }}>
          {asciiBar}
        </div>
      </div>

      {/* Decision Status & Reset Countdown */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid #2A2A30', fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#71717A' }}>Decision:</span>
          <span
            style={{
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: isAllow ? '#22C55E' : '#EF4444',
            }}
          >
            {isAllow ? '🟢 ALLOW (200)' : '🔴 THROTTLED (429)'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#F97316', fontFamily: 'var(--font-mono)' }}>
          <Clock size={12} />
          <span>Reset: {countdownSec}</span>
        </div>
      </div>
    </div>
  );
};
