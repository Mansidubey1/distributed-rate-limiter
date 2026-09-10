import React, { useState } from 'react';
import {
  Globe,
  Settings,
  Volume2,
  VolumeX,
  Database,
  Sparkles,
  ShieldCheck,
  Activity,
  Zap,
  FileCode2,
  BarChart3,
  Cpu,
  Plus
} from 'lucide-react';
import { Health } from '../../types';
import { EnvironmentProfile } from '../../types/postman';
import { soundFX } from '../../utils/helpers';
import { LimiterLabLogo } from '../LimiterLabLogo';

interface PostmanHeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  environments: EnvironmentProfile[];
  activeEnvironmentId: string;
  onSelectEnvironment: (envId: string) => void;
  onOpenEnvironmentModal: () => void;
  health: Health | null;
  onOpenChaosModal: () => void;
  onOpenCreatePolicyModal?: () => void;
}

export const PostmanHeader: React.FC<PostmanHeaderProps> = ({
  currentTab,
  onSelectTab,
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onOpenEnvironmentModal,
  health,
  onOpenChaosModal,
  onOpenCreatePolicyModal,
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

  const navTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <Activity size={14} />, desc: 'Observability' },
    { id: 'apiclient', label: 'API Client', icon: <Zap size={14} />, desc: 'Testing' },
    { id: 'policies', label: 'Rate Limiter', icon: <FileCode2 size={14} />, desc: 'Configuration' },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={14} />, desc: 'Performance' },
    { id: 'infrastructure', label: 'Infrastructure', icon: <Cpu size={14} />, desc: 'Cluster & Chaos' },
  ];

  return (
    <header className="pm-header" style={{ height: 60, minHeight: 60, padding: '0 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#121216', borderBottom: '1px solid #2A2A30' }}>
      {/* 1. Left: Brand & Title */}
      <div className="pm-header-left" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          className="pm-logo"
          onClick={() => onSelectTab('dashboard')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <LimiterLabLogo size={32} />
          <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.02em', color: '#F4F4F5' }}>
            LIMITERLAB
          </span>
        </div>

        <div
          style={{
            background: 'linear-gradient(90deg, rgba(249, 115, 22, 0.12), rgba(168, 85, 247, 0.12))',
            color: '#F97316',
            border: '1px solid rgba(249, 115, 22, 0.35)',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            letterSpacing: '0.01em',
          }}
        >
          <ShieldCheck size={13} color="#22C55E" />
          <span>Gateway & Limiter</span>
        </div>
      </div>

      {/* 2. Center: 5 Product Pillar Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#0D0D0F', padding: '3px 4px', borderRadius: 8, border: '1px solid #2A2A30' }}>
        {navTabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: isActive ? '#202024' : 'transparent',
                color: isActive ? '#F4F4F5' : '#71717A',
                fontWeight: isActive ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
                borderBottom: isActive ? '2px solid #F97316' : '2px solid transparent',
              }}
            >
              <span style={{ color: isActive ? '#F97316' : '#71717A' }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Right: Environment, Health, Controls */}
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

        {/* Cluster Status Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#202024',
            border: '1px solid #2A2A30',
            padding: '3px 9px',
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
          <span style={{ color: '#F4F4F5' }}>{isHealthy ? 'Healthy' : 'Degraded'}</span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#202024',
            border: '1px solid #2A2A30',
            padding: '3px 9px',
            borderRadius: 20,
            fontSize: 11,
            color: '#A1A1AA',
          }}
        >
          <Database size={12} color="#A855F7" />
          <strong style={{ color: redisHealthy ? '#22C55E' : '#F59E0B' }}>
            {health?.services?.redis || 'healthy'}
          </strong>
        </div>

        {/* New Policy shortcut button */}
        {onOpenCreatePolicyModal && (
          <button
            className="btn btn-primary btn-sm"
            onClick={onOpenCreatePolicyModal}
            title="Create Rate Limiting Policy"
            style={{ padding: '4px 10px', fontSize: 11.5 }}
          >
            <Plus size={12} />
            <span>New Policy</span>
          </button>
        )}

        {/* Fault/Chaos shortcut */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onOpenChaosModal}
          title="Chaos Engineering & Fault Injection"
          style={{ padding: '4px 8px' }}
        >
          <Sparkles size={13} color="#A855F7" />
        </button>

        {/* Audio FX */}
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

