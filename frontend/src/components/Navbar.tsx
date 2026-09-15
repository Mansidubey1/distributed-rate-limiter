import React, { useState } from 'react';
import {
  Zap,
  Server,
  Volume2,
  VolumeX,
  RefreshCw,
  Database,
  BarChart2,
  List,
  Flame,
  Sliders,
} from 'lucide-react';
import { Health } from '../types';
import { soundFX } from '../utils/helpers';
import { LimiterLabLogo } from './LimiterLabLogo';

interface NavbarProps {
  health: Health | null;
  onRefresh: () => void;
  onOpenBurstModal?: () => void;
  onOpenEnvModal?: () => void;
  eventCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  onRefresh,
  onOpenBurstModal,
  onOpenEnvModal,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('workbench');

  const toggleSound = () => {
    soundFX.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) {
      soundFX.playAllow();
    }
  };

  const navSections = [
    { id: 'workbench', label: 'API Client', icon: <Zap size={14} /> },
    { id: 'traffic', label: 'Traffic', icon: <BarChart2 size={14} /> },
    { id: 'activity', label: 'Live Stream', icon: <List size={14} /> },
    { id: 'events', label: 'Bucket & Events', icon: <Flame size={14} /> },
  ];

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const isHealthy = health?.status === 'ok';
  const redisHealthy = health?.services?.redis === 'healthy';

  return (
    <header className="app-header" style={{ background: '#121216', borderBottom: '1px solid #2A2A30', padding: '10px 24px', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        {/* Left: LIMITERLAB Brand */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
          onClick={() => scrollToSection('workbench')}
          title="Scroll to Top"
        >
          <LimiterLabLogo size={34} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.02em', color: '#F4F4F5' }}>
                LIMITERLAB
              </span>
              <span
                style={{
                  background: 'rgba(249, 115, 22, 0.12)',
                  color: '#F97316',
                  border: '1px solid rgba(249, 115, 22, 0.3)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                v2.4
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#71717A', fontWeight: 500 }}>
              API Gateway & Rate Limiting Workbench
            </div>
          </div>
        </div>

        {/* Center: Quick Section Navigation Anchors */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#18181C', padding: '3px 4px', borderRadius: 8, border: '1px solid #2A2A30' }}>
          {navSections.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: isActive ? '1px solid rgba(249, 115, 22, 0.35)' : '1px solid transparent',
                  background: isActive ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                  color: isActive ? '#F97316' : '#A1A1AA',
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {sec.icon}
                <span>{sec.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Cluster Status Badges & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Status Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isHealthy ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${isHealthy ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
              padding: '4px 9px',
              borderRadius: 20,
              fontSize: 11,
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

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: '#202024',
              border: '1px solid #2A2A30',
              padding: '4px 9px',
              borderRadius: 20,
              fontSize: 11,
              color: '#A1A1AA',
            }}
          >
            <Database size={11} color="#A855F7" />
            <span>Redis:</span>
            <strong style={{ color: redisHealthy ? '#22C55E' : '#F59E0B' }}>
              {health?.services?.redis || 'healthy'}
            </strong>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: '#202024',
              border: '1px solid #2A2A30',
              padding: '4px 9px',
              borderRadius: 20,
              fontSize: 11,
              color: '#A1A1AA',
            }}
          >
            <Server size={11} color="#F97316" />
            <strong style={{ color: '#F4F4F5' }}>{health?.instanceId || 'limiter-01'}</strong>
          </div>

          {/* Sound FX Toggle */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={toggleSound}
            title={soundEnabled ? 'Mute Sound FX' : 'Enable Synthesizer Feedback'}
            style={{ padding: '5px 8px' }}
          >
            {soundEnabled ? <Volume2 size={13} color="#22C55E" /> : <VolumeX size={13} color="#71717A" />}
          </button>

          {/* Manual Refresh */}
          <button className="btn btn-secondary btn-sm" onClick={onRefresh} title="Sync Cluster Telemetry" style={{ padding: '5px 8px' }}>
            <RefreshCw size={13} color="#A1A1AA" />
          </button>

          {/* Environment Variables Modal trigger */}
          {onOpenEnvModal && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onOpenEnvModal}
              title="Manage Environments & Variables"
              style={{ padding: '5px 8px' }}
            >
              <Sliders size={13} color="#A1A1AA" />
            </button>
          )}



          {/* Burst Button */}
          {onOpenBurstModal && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onOpenBurstModal}
              title="Run Burst Stress Test"
              style={{ padding: '5px 11px', color: '#F97316', fontWeight: 700 }}
            >
              <span>Burst 💥</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
