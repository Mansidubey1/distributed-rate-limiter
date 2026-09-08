import React, { useState } from 'react';
import {
  Zap,
  Globe,
  Settings,
  Volume2,
  VolumeX,
  Server,
  Database,
  Sparkles
} from 'lucide-react';
import { Health } from '../../types';
import { EnvironmentProfile } from '../../types/postman';
import { soundFX } from '../../utils/helpers';

interface PostmanHeaderProps {
  environments: EnvironmentProfile[];
  activeEnvironmentId: string;
  onSelectEnvironment: (envId: string) => void;
  onOpenEnvironmentModal: () => void;
  health: Health | null;
  onOpenChaosModal: () => void;
}

export const PostmanHeader: React.FC<PostmanHeaderProps> = ({
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onOpenEnvironmentModal,
  health,
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
    <header className="pm-header">
      {/* Brand */}
      <div className="pm-header-left">
        <div className="pm-logo">
          <div className="pm-logo-icon">
            <Zap size={16} color="#0D0D0F" />
          </div>
          <span>RateLimiter API Client</span>
        </div>

        {/* Workspace Tag */}
        <div
          style={{
            background: 'rgba(249, 115, 22, 0.12)',
            color: '#F97316',
            border: '1px solid rgba(249, 115, 22, 0.3)',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          Developer Workspace
        </div>
      </div>

      {/* Center/Right Controls */}
      <div className="pm-header-right">
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
              fontSize: 12,
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

        {/* Cluster Status Pills */}
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
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isHealthy ? '#22C55E' : '#EF4444',
              boxShadow: isHealthy ? '0 0 8px #22C55E' : '0 0 8px #EF4444',
            }}
          ></span>
          <span style={{ color: '#F4F4F5' }}>{isHealthy ? 'Cluster Healthy' : 'Degraded'}</span>
        </div>

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

        {/* Fault/Chaos injection button */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onOpenChaosModal}
          title="Chaos Engineering & Fault Injection"
          style={{ padding: '5px 8px' }}
        >
          <Sparkles size={13} color="#A855F7" />
        </button>

        {/* Audio FX */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={toggleSound}
          title={soundEnabled ? 'Mute Audio FX' : 'Enable Synthesizer Feedback'}
          style={{ padding: '5px 8px' }}
        >
          {soundEnabled ? <Volume2 size={13} color="#22C55E" /> : <VolumeX size={13} color="#71717A" />}
        </button>
      </div>
    </header>
  );
};
