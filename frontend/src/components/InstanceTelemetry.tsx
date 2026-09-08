import React, { useState, useEffect } from 'react';
import {
  Server,
  Radio
} from 'lucide-react';
import { InstanceNode, Health, Metrics } from '../types';

interface InstanceTelemetryProps {
  health: Health | null;
  metrics: Metrics;
}

export const InstanceTelemetry: React.FC<InstanceTelemetryProps> = ({ health, metrics }) => {
  const [nodes, setNodes] = useState<InstanceNode[]>([
    {
      id: 'limiter-01',
      name: 'Gateway Node 01 (Primary)',
      host: '10.0.1.14',
      port: 3000,
      status: 'healthy',
      role: 'primary',
      rps: 18,
      totalProcessed: Math.max(120, Math.floor(metrics.totalRequests * 0.55)),
      allowed: Math.floor(metrics.allowedRequests * 0.55),
      denied: Math.floor(metrics.deniedRequests * 0.55),
      p50Latency: 0.85,
      p95Latency: 2.15,
      p99Latency: 4.8,
      loadSharePercent: 55,
      cpuUsage: 24,
      memoryMb: 142,
      uptimeSec: 345600,
      redisConnected: true,
    },
    {
      id: 'limiter-02',
      name: 'Worker Node 02 (Replica)',
      host: '10.0.1.15',
      port: 3001,
      status: 'healthy',
      role: 'worker',
      rps: 12,
      totalProcessed: Math.floor(metrics.totalRequests * 0.3),
      allowed: Math.floor(metrics.allowedRequests * 0.3),
      denied: Math.floor(metrics.deniedRequests * 0.3),
      p50Latency: 0.92,
      p95Latency: 2.4,
      p99Latency: 5.1,
      loadSharePercent: 30,
      cpuUsage: 18,
      memoryMb: 128,
      uptimeSec: 342100,
      redisConnected: true,
    },
    {
      id: 'limiter-03',
      name: 'Worker Node 03 (Replica)',
      host: '10.0.1.16',
      port: 3002,
      status: 'healthy',
      role: 'worker',
      rps: 6,
      totalProcessed: Math.floor(metrics.totalRequests * 0.15),
      allowed: Math.floor(metrics.allowedRequests * 0.15),
      denied: Math.floor(metrics.deniedRequests * 0.15),
      p50Latency: 0.88,
      p95Latency: 2.2,
      p99Latency: 4.9,
      loadSharePercent: 15,
      cpuUsage: 14,
      memoryMb: 119,
      uptimeSec: 340500,
      redisConnected: true,
    },
  ]);

  // Jitter slightly for live simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setNodes((prev) =>
        prev.map((node) => {
          const cpuJitter = Math.max(10, Math.min(80, node.cpuUsage + (Math.random() * 4 - 2)));
          const rpsJitter = Math.max(1, Math.round(node.rps + (Math.random() * 2 - 1)));
          return {
            ...node,
            cpuUsage: Number(cpuJitter.toFixed(1)),
            rps: rpsJitter,
          };
        })
      );
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const formatUptime = (sec: number) => {
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  return (
    <div>
      {/* Top Cluster Distribution Summary */}
      <div className="glass-panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">
              <Server size={18} color="#F97316" />
              <span>Multi-Instance Cluster Load Balancing</span>
            </div>
            <div className="panel-subtitle">Traffic distribution across active distributed cluster workers</div>
          </div>
          <div className="pill-badge">
            <Radio size={12} color="#22C55E" />
            <span>Host: {health?.instanceId || 'limiter-01'} | Consistent Hashing</span>
          </div>
        </div>

        {/* Load Distribution Bar */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              height: 18,
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              background: '#202024',
              border: '1px solid #2A2A30',
            }}
          >
            <div
              title={`${nodes[0].name}: ${nodes[0].loadSharePercent}%`}
              style={{
                width: `${nodes[0].loadSharePercent}%`,
                background: 'linear-gradient(90deg, #F97316, #EA580C)',
              }}
            ></div>
            <div
              title={`${nodes[1].name}: ${nodes[1].loadSharePercent}%`}
              style={{
                width: `${nodes[1].loadSharePercent}%`,
                background: 'linear-gradient(90deg, #FB923C, #F97316)',
              }}
            ></div>
            <div
              title={`${nodes[2].name}: ${nodes[2].loadSharePercent}%`}
              style={{
                width: `${nodes[2].loadSharePercent}%`,
                background: 'linear-gradient(90deg, #A855F7, #9333EA)',
              }}
            ></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
            <span style={{ color: '#F97316' }}>● {nodes[0].id} ({nodes[0].loadSharePercent}%)</span>
            <span style={{ color: '#FB923C' }}>● {nodes[1].id} ({nodes[1].loadSharePercent}%)</span>
            <span style={{ color: '#A855F7' }}>● {nodes[2].id} ({nodes[2].loadSharePercent}%)</span>
          </div>
        </div>
      </div>

      {/* Grid of Instance Node Cards */}
      <div className="grid-3col">
        {nodes.map((node) => (
          <div key={node.id} className="glass-panel" style={{ position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Server size={18} color={node.role === 'primary' ? '#F97316' : '#A855F7'} />
                  <span style={{ color: '#F4F4F5' }}>{node.id}</span>
                </div>
                <div style={{ fontSize: 11, color: '#71717A', marginTop: 2 }}>
                  {node.host}:{node.port} · {node.role.toUpperCase()}
                </div>
              </div>
              <span className="pill-badge" style={{ color: '#22C55E' }}>
                <span className="pulse-dot online"></span>
                Healthy
              </span>
            </div>

            {/* Metrics List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Live Throughput */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#202024',
                  border: '1px solid #2A2A30',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span style={{ fontSize: 12, color: '#A1A1AA' }}>Throughput:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F59E0B' }}>
                  {node.rps} req/s
                </span>
              </div>

              {/* Latency Percentiles */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 6,
                  textAlign: 'center',
                  background: '#202024',
                  border: '1px solid #2A2A30',
                  padding: 8,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 11,
                }}
              >
                <div>
                  <span style={{ color: '#71717A' }}>p50</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#22C55E' }}>
                    {node.p50Latency}ms
                  </div>
                </div>
                <div>
                  <span style={{ color: '#71717A' }}>p95</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F59E0B' }}>
                    {node.p95Latency}ms
                  </div>
                </div>
                <div>
                  <span style={{ color: '#71717A' }}>p99</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#EF4444' }}>
                    {node.p99Latency}ms
                  </div>
                </div>
              </div>

              {/* Resource Utilization */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#71717A' }}>CPU Utilization:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#F4F4F5' }}>{node.cpuUsage}%</span>
                </div>
                <div
                  style={{
                    height: 5,
                    background: '#202024',
                    border: '1px solid #2A2A30',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${node.cpuUsage}%`,
                      background: node.cpuUsage > 70 ? '#EF4444' : '#22C55E',
                    }}
                  ></div>
                </div>
              </div>

              {/* Footer info: Memory, Redis, Uptime */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #2A2A30',
                  paddingTop: 10,
                  fontSize: 11,
                  color: '#71717A',
                }}
              >
                <span>Mem: {node.memoryMb} MB</span>
                <span style={{ color: '#22C55E' }}>Redis Sync: OK</span>
                <span>Uptime: {formatUptime(node.uptimeSec)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
