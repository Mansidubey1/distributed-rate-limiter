import React, { useState } from 'react';
import {
  Terminal,
  ChevronUp,
  ChevronDown,
  Trash2
} from 'lucide-react';
import { ConsoleLogEntry, HttpMethod } from '../../types/postman';
import { formatTime } from '../../utils/helpers';

interface PostmanConsoleProps {
  logs: ConsoleLogEntry[];
  onClearLogs: () => void;
}

export const PostmanConsole: React.FC<PostmanConsoleProps> = ({ logs, onClearLogs }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const getMethodClass = (method?: HttpMethod) => {
    switch (method) {
      case 'GET':
        return 'method-get';
      case 'POST':
        return 'method-post';
      case 'PUT':
        return 'method-put';
      case 'DELETE':
        return 'method-delete';
      case 'PATCH':
        return 'method-patch';
      default:
        return 'method-post';
    }
  };

  return (
    <div
      className="pm-console-drawer"
      style={{
        height: isExpanded ? 220 : 36,
        minHeight: isExpanded ? 220 : 36,
      }}
    >
      {/* Console Header */}
      <div className="pm-console-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#A1A1AA' }}>
          <Terminal size={14} color="#F97316" />
          <span>Console</span>
          <span
            style={{
              background: '#202024',
              border: '1px solid #2A2A30',
              padding: '1px 6px',
              borderRadius: 10,
              fontSize: 10,
              color: '#71717A',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {logs.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={(e) => e.stopPropagation()}>
          {logs.length > 0 && (
            <button
              onClick={onClearLogs}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#71717A',
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Trash2 size={11} /> Clear
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ background: 'transparent', border: 'none', color: '#A1A1AA', cursor: 'pointer' }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {/* Logs View */}
      {isExpanded && (
        <div className="pm-console-logs">
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#71717A' }}>
              No console logs recorded in this session. Dispatch a request to view live network traffic.
            </div>
          ) : (
            logs.map((log) => {
              const isOk = log.status === 200;
              return (
                <div key={log.id} className="pm-console-row">
                  {/* Timestamp */}
                  <span style={{ color: '#71717A' }}>{formatTime(log.timestamp)}</span>

                  {/* Method */}
                  {log.method ? (
                    <span className={`method-pill ${getMethodClass(log.method)}`}>{log.method}</span>
                  ) : (
                    <span></span>
                  )}

                  {/* URL */}
                  <span style={{ color: '#F4F4F5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.url || log.message}
                  </span>

                  {/* Status */}
                  {log.status ? (
                    <span style={{ fontWeight: 800, color: isOk ? '#22C55E' : '#EF4444' }}>
                      {log.status} {log.statusText}
                    </span>
                  ) : (
                    <span></span>
                  )}

                  {/* Latency */}
                  {log.latencyMs !== undefined ? (
                    <span style={{ color: '#F97316' }}>{log.latencyMs}ms</span>
                  ) : (
                    <span></span>
                  )}

                  {/* Instance / Remaining */}
                  <span style={{ color: '#71717A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.instanceId ? `node: ${log.instanceId}` : ''}{' '}
                    {log.remaining !== undefined ? `| rem: ${log.remaining}/${log.limit}` : ''}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
