import React, { useState } from 'react';
import {
  Globe,
  Settings,
  Volume2,
  VolumeX,
  Database,
  Sparkles,
  Server
} from 'lucide-react';
import { Health, Metrics } from '../../types';
import { EnvironmentProfile } from '../../types/postman';
import { soundFX } from '../../utils/helpers';
import { LimiterLabLogo } from '../LimiterLabLogo';

interface PostmanHeaderProps {
  environments: EnvironmentProfile[];
  activeEnvironmentId: string;
  onSelectEnvironment: (envId: string) => void;
  onOpenEnvironmentModal: () => void;
  health: Health | null;
  metrics?: Metrics;
  onOpenChaosModal: () => void;
}

export const PostmanHeader: React.FC<PostmanHeaderProps> = ({
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onOpenEnvironmentModal,
  health,
  metrics,
  onOpenChaosModal,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(false);

  const toggleSound = () => {
    soundFX.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) {
      soundFX.playAllow();
    }
  };

  const isHealthy = health?.status === 'ok';
  const redisHealthy = health?.services?.redis === 'healthy';

  return (
    <header className="pm-header" style={{ height: 56, minHeight: 56, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#121216', borderBottom: '1px solid #2A2A30' }}>
      {/* 1. Left: ⚡ LIMITERLAB Brand */}
      <div className="pm-header-left" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="pm-logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LimiterLabLogo size={32} />
          <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: '-0.02em', color: '#F4F4F5', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>LIMITERLAB</span>
          </span>
        </div>

        {/* 🟢 API HEALTHY Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: isHealthy ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${isHealthy ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 11.5,
            fontWeight: 700,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isHealthy ? '#22C55E' : '#EF4444',
              boxShadow: isHealthy ? '0 0 8px #22C55E' : '0 0 8px #EF4444',
            }}
          ></span>
          <span style={{ color: isHealthy ? '#22C55E' : '#EF4444' }}>
            {isHealthy ? 'API HEALTHY' : 'DEGRADED'}
          </span>
        </div>

        {metrics && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#18181C',
              border: '1px solid #2A2A30',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11,
              color: '#A1A1AA',
            }}
          >
            <span>Cluster Reqs: <strong style={{ color: '#F4F4F5' }}>{metrics.totalRequests.toLocaleString()}</strong></span>
            <span style={{ color: '#3F3F46' }}>|</span>
            <span style={{ color: '#22C55E' }}>{metrics.allowedRequests.toLocaleString()} allowed</span>
            {metrics.deniedRequests > 0 && (
              <>
                <span style={{ color: '#3F3F46' }}>|</span>
                <span style={{ color: '#EF4444' }}>{metrics.deniedRequests.toLocaleString()} blocked</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* 2. Right: Environment, Cluster Node, Tools */}
      <div className="pm-header-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Environment Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Globe size={13} color="#71717A" />
          <select
            value={activeEnvironmentId}
            onChange={(e) => onSelectEnvironment(e.target.value)}
            style={{
              background: '#202024',
              border: '1px solid #2A2A30',
              color: '#F4F4F5',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 11.5,
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                Env: {env.name}
              </option>
            ))}
            <option value="none">No Environment</option>
          </select>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onOpenEnvironmentModal}
            title="Manage Environment Variables"
            style={{ padding: '4px 8px' }}
          >
            <Settings size={13} color="#A1A1AA" />
          </button>
        </div>

        {/* Redis Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#202024',
            border: '1px solid #2A2A30',
            padding: '3px 10px',
            borderRadius: 20,
            fontSize: 11,
            color: '#A1A1AA',
          }}
        >
          <Database size={12} color="#A855F7" />
          <span>Redis:</span>
          <strong style={{ color: redisHealthy ? '#22C55E' : '#F59E0B' }}>
            {health?.services?.redis || 'healthy'}
          </strong>
        </div>

        {/* Node instance */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#202024',
            border: '1px solid #2A2A30',
            padding: '3px 10px',
            borderRadius: 20,
            fontSize: 11,
            color: '#A1A1AA',
          }}
        >
          <Server size={12} color="#F97316" />
          <span style={{ color: '#F4F4F5' }}>{health?.instanceId || 'limiter-01'}</span>
        </div>

        {/* Chaos Engineering modal shortcut */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onOpenChaosModal}
          title="Chaos Engineering & Fault Injection"
          style={{ padding: '4px 8px' }}
        >
          <Sparkles size={13} color="#A855F7" />
        </button>

        {/* Sound FX */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={toggleSound}
          title={soundEnabled ? 'Mute Audio FX' : 'Enable Synthesizer Feedback'}
          style={{ padding: '4px 8px' }}
        >
          {soundEnabled ? <Volume2 size={13} color="#22C55E" /> : <VolumeX size={13} color="#71717A" />}
        </button>
      </div>
    </header>
  );
};
