import React, { useState } from 'react';
import {
  Folder,
  ChevronRight,
  ChevronDown,
  Clock,
  Search,
  Trash2,
  Plus
} from 'lucide-react';
import { RequestCollection, RequestTemplate, HistoryItem, HttpMethod } from '../../types/postman';

export type SidebarTab = 'collections' | 'history';

interface PostmanSidebarProps {
  collections: RequestCollection[];
  history: HistoryItem[];
  activeRequestId: string;
  onSelectRequest: (req: RequestTemplate) => void;
  onSelectHistory: (item: HistoryItem) => void;
  onClearHistory: () => void;
  currentSidebarTab: SidebarTab;
  onSelectSidebarTab: (tab: SidebarTab) => void;
  onNewRequest: () => void;
}

export const PostmanSidebar: React.FC<PostmanSidebarProps> = ({
  collections,
  history,
  activeRequestId,
  onSelectRequest,
  onSelectHistory,
  onClearHistory,
  currentSidebarTab,
  onSelectSidebarTab,
  onNewRequest,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'fld-core': true,
    'fld-token-bucket': true,
    'fld-sliding-window': true,
    'fld-admin': false,
  });
  const [searchQuery, setSearchQuery] = useState<string>('');

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const getMethodClass = (method: HttpMethod) => {
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
    <aside className="pm-sidebar">
      {/* Workspace Header */}
      <div style={{ padding: '10px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #202024' }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#71717A', textTransform: 'uppercase' }}>
          WORKSPACE
        </span>
        <button
          onClick={onNewRequest}
          title="New Request (+)"
          style={{
            background: 'rgba(249, 115, 22, 0.12)',
            border: '1px solid rgba(249, 115, 22, 0.3)',
            color: '#F97316',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 10.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <Plus size={11} />
          <span>NEW</span>
        </button>
      </div>

      {/* Sidebar Mode Tabs */}
      <div className="pm-sidebar-nav">
        <button
          className={`pm-sidebar-tab ${currentSidebarTab === 'collections' ? 'active' : ''}`}
          onClick={() => onSelectSidebarTab('collections')}
          title="API Collections"
        >
          <Folder size={14} />
          <span>Collections</span>
        </button>

        <button
          className={`pm-sidebar-tab ${currentSidebarTab === 'history' ? 'active' : ''}`}
          onClick={() => onSelectSidebarTab('history')}
          title="Request History"
        >
          <Clock size={14} />
          <span style={{ whiteSpace: 'nowrap' }}>History ({history.length})</span>
        </button>
      </div>

      {/* Search & Actions Bar */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #2A2A30' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#121216',
              border: '1px solid #2A2A30',
              borderRadius: 6,
              padding: '0 8px',
              flex: 1,
            }}
          >
            <Search size={12} color="#71717A" />
            <input
              type="text"
              placeholder={currentSidebarTab === 'history' ? 'Filter history...' : 'Search requests...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '6px 0',
                fontSize: 11.5,
                color: '#F4F4F5',
                outline: 'none',
              }}
            />
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onNewRequest}
            title="Create Custom Request"
            style={{ padding: '6px 8px' }}
          >
            <Plus size={13} color="#F97316" />
          </button>
        </div>
      </div>

      {/* Main Sidebar Content */}
      <div className="pm-sidebar-content">
        {currentSidebarTab === 'collections' && (
          <div>
            {collections.map((col) => (
              <div key={col.id}>
                {col.folders.map((folder) => {
                  const isExpanded = expandedFolders[folder.id] ?? true;
                  const matchingRequests = folder.requests.filter((r) => {
                    if (!searchQuery.trim()) return true;
                    return (
                      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      r.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      r.method.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                  });

                  if (searchQuery.trim() && matchingRequests.length === 0) return null;

                  return (
                    <div key={folder.id} className="pm-tree-folder">
                      {/* Folder Header */}
                      <div className="pm-folder-header" onClick={() => toggleFolder(folder.id)}>
                        {isExpanded ? <ChevronDown size={14} color="#A1A1AA" /> : <ChevronRight size={14} color="#A1A1AA" />}
                        <Folder size={14} color="#A855F7" />
                        <span>{folder.name}</span>
                        <span style={{ fontSize: 10, color: '#71717A', marginLeft: 'auto' }}>
                          {folder.requests.length}
                        </span>
                      </div>

                      {/* Folder Items */}
                      {isExpanded && (
                        <div className="pm-folder-items">
                          {matchingRequests.map((req) => (
                            <div
                              key={req.id}
                              className={`pm-request-item ${activeRequestId === req.id ? 'active' : ''}`}
                              onClick={() => onSelectRequest(req)}
                              title={req.description || req.name}
                            >
                              <span className={`method-pill ${getMethodClass(req.method)}`}>
                                {req.method}
                              </span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {req.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {currentSidebarTab === 'history' && (
          <div>
            {history.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' }}>
                <span style={{ fontSize: 11, color: '#71717A' }}>Recent Executions</span>
                <button
                  onClick={onClearHistory}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#EF4444',
                    fontSize: 11,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Trash2 size={11} /> Clear
                </button>
              </div>
            )}

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#71717A', fontSize: 12 }}>
                No requests sent yet. Click <strong>SEND</strong> on any request to record history!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {history
                  .filter((h) => {
                    if (!searchQuery.trim()) return true;
                    return (
                      h.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      h.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      h.status.toString().includes(searchQuery)
                    );
                  })
                  .map((item) => {
                    const isOk = item.status === 200;
                    return (
                      <div
                        key={item.id}
                        className="pm-request-item"
                        onClick={() => onSelectHistory(item)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          <span className={`method-pill ${getMethodClass(item.method)}`}>
                            {item.method}
                          </span>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontFamily: 'var(--font-mono)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.url.replace('{{BASE_URL}}', '') || '/'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              color: isOk ? '#22C55E' : '#EF4444',
                            }}
                          >
                            {item.status}
                          </span>
                          <span style={{ fontSize: 10, color: '#71717A', fontFamily: 'var(--font-mono)' }}>
                            {item.latencyMs}ms
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
