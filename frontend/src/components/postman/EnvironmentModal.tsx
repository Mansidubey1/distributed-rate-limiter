import React, { useState } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  HelpCircle
} from 'lucide-react';
import { EnvironmentProfile, EnvironmentVariable } from '../../types/postman';

interface EnvironmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  environments: EnvironmentProfile[];
  activeEnvironmentId: string;
  onUpdateEnvironments: (envs: EnvironmentProfile[]) => void;
}

export const EnvironmentModal: React.FC<EnvironmentModalProps> = ({
  isOpen,
  onClose,
  environments,
  activeEnvironmentId,
  onUpdateEnvironments,
}) => {
  const [selectedEnvId, setSelectedEnvId] = useState<string>(activeEnvironmentId || environments[0]?.id);

  if (!isOpen) return null;

  const currentEnv = environments.find((e) => e.id === selectedEnvId) || environments[0];

  const handleAddVariable = () => {
    if (!currentEnv) return;
    const newVar: EnvironmentVariable = {
      id: `v-${Date.now()}`,
      key: '',
      value: '',
      enabled: true,
    };
    const updated = environments.map((e) =>
      e.id === currentEnv.id ? { ...e, variables: [...e.variables, newVar] } : e
    );
    onUpdateEnvironments(updated);
  };

  const handleUpdateVar = (varId: string, field: 'key' | 'value' | 'enabled', val: any) => {
    if (!currentEnv) return;
    const updatedVars = currentEnv.variables.map((v) =>
      v.id === varId ? { ...v, [field]: val } : v
    );
    const updatedEnvs = environments.map((e) =>
      e.id === currentEnv.id ? { ...e, variables: updatedVars } : e
    );
    onUpdateEnvironments(updatedEnvs);
  };

  const handleDeleteVar = (varId: string) => {
    if (!currentEnv) return;
    const updatedVars = currentEnv.variables.filter((v) => v.id !== varId);
    const updatedEnvs = environments.map((e) =>
      e.id === currentEnv.id ? { ...e, variables: updatedVars } : e
    );
    onUpdateEnvironments(updatedEnvs);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}>
            <Globe size={18} color="#F97316" />
            <span style={{ color: '#F4F4F5' }}>Manage Environment Variables</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#71717A', fontSize: 20, cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        {/* Environment Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid #2A2A30', paddingBottom: 8 }}>
          {environments.map((env) => (
            <button
              key={env.id}
              className={`btn btn-sm ${selectedEnvId === env.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedEnvId(env.id)}
            >
              {env.name}
            </button>
          ))}
        </div>

        {/* Variable Table */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA' }}>
              Variables for <strong style={{ color: '#F4F4F5' }}>{currentEnv?.name}</strong>:
            </span>
            <button className="btn btn-secondary btn-sm" onClick={handleAddVariable}>
              <Plus size={12} color="#F97316" /> Add Variable
            </button>
          </div>

          <table className="pm-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>Variable Key</th>
                <th>Value</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {currentEnv?.variables.map((v) => (
                <tr key={v.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={v.enabled}
                      onChange={(e) => handleUpdateVar(v.id, 'enabled', e.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="e.g. BASE_URL"
                      value={v.key}
                      onChange={(e) => handleUpdateVar(v.id, 'key', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: '#F97316',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        outline: 'none',
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="e.g. http://localhost:3000"
                      value={v.value}
                      onChange={(e) => handleUpdateVar(v.id, 'value', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: '#F4F4F5',
                        fontFamily: 'var(--font-mono)',
                        outline: 'none',
                      }}
                    />
                  </td>
                  <td>
                    <button
                      onClick={() => handleDeleteVar(v.id)}
                      style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Interpolation Help Hint */}
        <div
          style={{
            background: 'rgba(249, 115, 22, 0.08)',
            border: '1px solid rgba(249, 115, 22, 0.25)',
            borderRadius: 6,
            padding: 10,
            fontSize: 11,
            color: '#A1A1AA',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <HelpCircle size={16} color="#F97316" />
          <span>
            Use double curly braces in your URLs or JSON request bodies (e.g.{' '}
            <code style={{ color: '#F97316', fontFamily: 'var(--font-mono)' }}>&#123;&#123;BASE_URL&#125;&#125;/v1/check</code> or <code style={{ color: '#F97316', fontFamily: 'var(--font-mono)' }}>"clientKey": "&#123;&#123;CLIENT_KEY&#125;&#125;"</code>).
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
