import React, { useState } from 'react';
import {
  Activity,
  Zap,
  Radio,
  Server,
  FileCode2,
  Sliders,
  Flame,
  Volume2,
  VolumeX,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  BookOpen,
  Code2,
  Database
} from 'lucide-react';
import { Health, TabType } from '../types';
import { soundFX } from '../utils/helpers';

import { LimiterLabLogo } from './LimiterLabLogo';

interface NavbarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  health: Health | null;
  onRefresh: () => void;
  onOpenCreateModal: () => void;
  eventCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  health,
  onRefresh,
  onOpenCreateModal,
  eventCount,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(false);

  const toggleSound = () => {
    soundFX.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) {
      soundFX.playAllow();
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Cluster Telemetry', icon: <Activity size={15} /> },
    { id: 'simulator', label: 'Traffic Simulator', icon: <Zap size={15} /> },
    { id: 'tracing', label: 'Request Tracing', icon: <Radio size={15} /> },
    { id: 'telemetry', label: 'Per-Instance', icon: <Server size={15} /> },
    { id: 'headers', label: 'Header Inspector', icon: <Search size={15} /> },
    { id: 'benchmark', label: 'Benchmark Lab', icon: <Flame size={15} /> },
    { id: 'chaos', label: 'Chaos Lab', icon: <Sparkles size={15} /> },
    { id: 'events', label: 'Event Stream', icon: <Sliders size={15} />, badge: eventCount },
    { id: 'policies', label: 'Policy Manager', icon: <FileCode2 size={15} /> },
    { id: 'algorithms', label: 'Algorithm Lab', icon: <BookOpen size={15} /> },
    { id: 'apihub', label: 'API & Code Hub', icon: <Code2 size={15} /> },
  ];

  const isHealthy = health?.status === 'ok';
  const redisHealthy = health?.services?.redis === 'healthy';

  return (
    <header className="app-header" style={{ background: '#121216', borderBottom: '1px solid #2A2A30', padding: '12px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LimiterLabLogo size={38} />
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: '#F4F4F5' }}>Token Bucket Rate Limiter</h1>
            <div style={{ fontSize: 11, color: '#71717A' }}>
              <span>Distributed High-Throughput Token Bucket & Sliding Window Cluster</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Status Badges */}
          <div className="pill-badge" title="Overall System Health">
            <span className={`pulse-dot ${isHealthy ? 'online' : 'danger'}`}></span>
            <span style={{ color: '#F4F4F5' }}>{isHealthy ? 'Cluster Healthy' : 'Degraded'}</span>
          </div>

          <div className="pill-badge" title="Redis Connection Status">
            <Database size={13} color="#A855F7" />
            <span style={{ color: '#71717A' }}>Redis:</span>
            <strong style={{ color: redisHealthy ? '#22C55E' : '#F59E0B' }}>
              {health?.services?.redis || 'healthy'}
            </strong>
          </div>

          <div className="pill-badge" title="Active Host Instance Node">
            <Server size={13} color="#F97316" />
            <span style={{ color: '#71717A' }}>Node:</span>
            <strong style={{ color: '#F4F4F5' }}>{health?.instanceId || 'limiter-01'}</strong>
          </div>

          {/* Sound FX Toggle */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={toggleSound}
            title={soundEnabled ? 'Mute Sound FX' : 'Enable Audio Synthesizer FX'}
            style={{ padding: '6px 8px' }}
          >
            {soundEnabled ? <Volume2 size={15} color="#22C55E" /> : <VolumeX size={15} color="#71717A" />}
          </button>

          {/* Manual Refresh */}
          <button className="btn btn-secondary btn-sm" onClick={onRefresh} title="Fetch Latest Metrics" style={{ padding: '6px 8px' }}>
            <RefreshCw size={14} color="#A1A1AA" />
          </button>

          {/* Create Policy Button */}
          <button className="btn btn-primary btn-sm" onClick={onOpenCreateModal}>
            <Plus size={14} />
            <span>New Policy</span>
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div style={{ display: 'flex', gap: 4, marginTop: 12, overflowX: 'auto', borderTop: '1px solid #2A2A30', paddingTop: 8 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`pm-sidebar-tab ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap' }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                style={{
                  background: 'rgba(249, 115, 22, 0.2)',
                  color: '#F97316',
                  padding: '1px 6px',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </header>
  );
};
