import React, { useState } from 'react';
import {
  Sliders,
  Search,
  Download,
  AlertTriangle,
  Info,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { SystemEvent, EventSeverity } from '../types';
import { formatTime } from '../utils/helpers';

interface SystemEventStreamProps {
  events: SystemEvent[];
  onClearEvents: () => void;
}

export const SystemEventStream: React.FC<SystemEventStreamProps> = ({ events, onClearEvents }) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const filteredEvents = events.filter((e) => {
    if (filterSeverity !== 'ALL' && e.severity !== filterSeverity) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        e.message.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportEvents = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rate-limiter-events-${Date.now()}.json`;
    a.click();
  };

  const getSeverityBadge = (severity: EventSeverity) => {
    switch (severity) {
      case 'CRITICAL':
      case 'ERROR':
        return (
          <span className="status-badge-deny" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <XCircle size={10} /> {severity}
          </span>
        );
      case 'WARN':
        return (
          <span
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#F59E0B',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <AlertTriangle size={10} /> WARN
          </span>
        );
      case 'INFO':
      default:
        return (
          <span
            style={{
              background: 'rgba(168, 85, 247, 0.15)',
              color: '#A855F7',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Info size={10} /> INFO
          </span>
        );
    }
  };

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">
            <Sliders size={18} color="#F97316" />
            <span>Cluster System Event Stream & Audit Log</span>
          </div>
          <div className="panel-subtitle">Real-time telemetry events, policy mutations, and throttle triggers</div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={exportEvents} disabled={events.length === 0}>
            <Download size={13} color="#A1A1AA" /> Export JSON
          </button>
          {events.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={onClearEvents}>
              <Trash2 size={13} color="#EF4444" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            minWidth: 240,
            background: '#121216',
            border: '1px solid #2A2A30',
            borderRadius: 6,
            padding: '2px 10px',
          }}
        >
          <Search size={14} color="#71717A" />
          <input
            type="text"
            placeholder="Search event logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#F4F4F5', padding: '6px 0', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {['ALL', 'INFO', 'WARN', 'CRITICAL'].map((sev) => (
            <button
              key={sev}
              className={`btn btn-sm ${filterSeverity === sev ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterSeverity(sev)}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Event Feed List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 600, overflowY: 'auto' }}>
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#71717A' }}>
            No system events recorded in this session.
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const isExpanded = expandedEventId === evt.id;
            return (
              <div
                key={evt.id}
                style={{
                  background: '#202024',
                  border: '1px solid #2A2A30',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  transition: 'all 0.2s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: evt.details ? 'pointer' : 'default',
                  }}
                  onClick={() => evt.details && setExpandedEventId(isExpanded ? null : evt.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {getSeverityBadge(evt.severity)}
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        background: '#121216',
                        border: '1px solid #2A2A30',
                        padding: '2px 6px',
                        borderRadius: 4,
                        color: '#A1A1AA',
                      }}
                    >
                      {evt.category}
                    </span>
                    <strong style={{ fontSize: 13, color: '#F4F4F5' }}>{evt.title}</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#71717A' }}>
                    <span>{formatTime(evt.timestamp)}</span>
                    {evt.details && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: '#A1A1AA', marginTop: 6 }}>
                  {evt.message}
                </div>

                {isExpanded && evt.details && (
                  <div className="code-box" style={{ marginTop: 10 }}>
                    <pre>{JSON.stringify(evt.details, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
