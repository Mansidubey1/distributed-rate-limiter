import React, { useState } from 'react';
import {
  FileCode2,
  Plus,
  Trash2,
  Edit2,
  Send,
  Search
} from 'lucide-react';
import { Client, AlgorithmType } from '../types';

interface PolicyManagerProps {
  clients: Client[];
  onRefresh: () => void;
  onOpenCreateModal: () => void;
  onTestClient: (clientKey: string) => void;
}

export const PolicyManager: React.FC<PolicyManagerProps> = ({
  clients,
  onRefresh,
  onOpenCreateModal,
  onTestClient,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterAlgo, setFilterAlgo] = useState<'ALL' | AlgorithmType>('ALL');
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Edit Modal State
  const [editRps, setEditRps] = useState<number>(10);
  const [editBurst, setEditBurst] = useState<number>(20);
  const [editWindow, setEditWindow] = useState<number>(10);
  const [editAlgo, setEditAlgo] = useState<AlgorithmType>('token_bucket');

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setEditAlgo(client.algorithm);
    setEditRps(client.requestsPerSecond);
    setEditBurst(client.burstSize || client.requestsPerSecond);
    setEditWindow(client.windowSize || 10);
  };

  const handleUpdatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    const payload = {
      algorithm: editAlgo,
      requestsPerSecond: editRps,
      burstSize: editAlgo === 'token_bucket' ? editBurst : editRps,
      windowSize: editAlgo === 'sliding_window' ? editWindow : 1.0,
    };

    try {
      const res = await fetch(`/v1/admin/clients/${editingClient.clientKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditingClient(null);
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update policy');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePolicy = async (key: string) => {
    if (!confirm(`Are you sure you want to permanently delete rate limit policy '${key}'?`)) {
      return;
    }

    try {
      const res = await fetch(`/v1/admin/clients/${key}`, { method: 'DELETE' });
      if (res.ok) {
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredClients = clients.filter((c) => {
    if (filterAlgo !== 'ALL' && c.algorithm !== filterAlgo) return false;
    if (searchQuery.trim()) {
      return c.clientKey.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">
            <FileCode2 size={18} color="#F97316" />
            <span>Client Rate Limiting Policies</span>
          </div>
          <div className="panel-subtitle">Manage persistent PostgreSQL policies and Redis quota limits</div>
        </div>

        <button className="btn btn-primary btn-sm" onClick={onOpenCreateModal}>
          <Plus size={14} /> Create Policy
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 18,
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
            placeholder="Search by client key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#F4F4F5', padding: '7px 0', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={`btn btn-sm ${filterAlgo === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterAlgo('ALL')}
          >
            All Algorithms ({clients.length})
          </button>
          <button
            className={`btn btn-sm ${filterAlgo === 'token_bucket' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterAlgo('token_bucket')}
          >
            Token Bucket ({clients.filter((c) => c.algorithm === 'token_bucket').length})
          </button>
          <button
            className={`btn btn-sm ${filterAlgo === 'sliding_window' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterAlgo('sliding_window')}
          >
            Sliding Window ({clients.filter((c) => c.algorithm === 'sliding_window').length})
          </button>
        </div>
      </div>

      {/* Policy Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Client Key</th>
              <th>Algorithm</th>
              <th>Refill / Quota</th>
              <th>Burst / Window</th>
              <th>Total Evaluated</th>
              <th>Allowed</th>
              <th>Throttled</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: '#71717A' }}>
                  No policies found matching your search.
                </td>
              </tr>
            ) : (
              filteredClients.map((c) => {
                const isTb = c.algorithm === 'token_bucket';
                const total = (c.allowedRequests || 0) + (c.deniedRequests || 0);
                return (
                  <tr key={c.clientKey}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F4F4F5' }}>
                      {c.clientKey}
                    </td>
                    <td>
                      <span className={`algo-tag ${isTb ? 'algo-tb' : 'algo-sw'}`}>
                        {isTb ? 'Token Bucket' : 'Sliding Window'}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#F4F4F5' }}>{c.requestsPerSecond}</strong> req/s
                    </td>
                    <td style={{ color: '#A1A1AA' }}>
                      {isTb ? `Burst: ${c.burstSize}` : `Window: ${c.windowSize}s`}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{total.toLocaleString()}</td>
                    <td style={{ color: '#22C55E', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {c.allowedRequests || 0}
                    </td>
                    <td style={{ color: '#EF4444', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {c.deniedRequests || 0}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onTestClient(c.clientKey)}
                          title="Test 1 Request"
                        >
                          <Send size={12} color="#F97316" /> Test
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditModal(c)}
                          title="Edit Parameters"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDeletePolicy(c.clientKey)}
                          title="Delete Policy"
                          style={{ color: '#EF4444' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Policy Modal */}
      {editingClient && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#F4F4F5' }}>Edit Rate Limit Policy</h2>
              <button
                onClick={() => setEditingClient(null)}
                style={{ background: 'transparent', border: 'none', color: '#71717A', fontSize: 20, cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdatePolicy} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', display: 'block', marginBottom: 6 }}>Client Key</label>
                <input
                  type="text"
                  value={editingClient.clientKey}
                  disabled
                  style={{ width: '100%', padding: '8px 10px', background: '#121216', border: '1px solid #2A2A30', color: '#71717A', borderRadius: 6 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', display: 'block', marginBottom: 6 }}>Algorithm</label>
                <select
                  value={editAlgo}
                  onChange={(e) => setEditAlgo(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', background: '#202024', border: '1px solid #2A2A30', color: '#F4F4F5', borderRadius: 6 }}
                >
                  <option value="token_bucket">Token Bucket (Continuous Refill)</option>
                  <option value="sliding_window">Sliding Window (Sliding Window Log)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', display: 'block', marginBottom: 6 }}>
                  {editAlgo === 'token_bucket'
                    ? 'Requests Per Second (Refill Rate)'
                    : 'Max Quota in Window'}
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={editRps}
                  onChange={(e) => setEditRps(parseFloat(e.target.value))}
                  required
                  style={{ width: '100%', padding: '8px 10px', background: '#121216', border: '1px solid #2A2A30', color: '#F4F4F5', borderRadius: 6 }}
                />
              </div>

              {editAlgo === 'token_bucket' ? (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', display: 'block', marginBottom: 6 }}>Burst Capacity (Max Tokens)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={editBurst}
                    onChange={(e) => setEditBurst(parseFloat(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', background: '#121216', border: '1px solid #2A2A30', color: '#F4F4F5', borderRadius: 6 }}
                  />
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', display: 'block', marginBottom: 6 }}>Window Size (Seconds)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={editWindow}
                    onChange={(e) => setEditWindow(parseFloat(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', background: '#121216', border: '1px solid #2A2A30', color: '#F4F4F5', borderRadius: 6 }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingClient(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
