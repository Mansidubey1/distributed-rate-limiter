import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  FileCode2,
  Terminal,
  Globe,
  Server,
  Layers
} from 'lucide-react';
import { Client } from '../types';

interface ApiIntegrationHubProps {
  clients: Client[];
}

export const ApiIntegrationHub: React.FC<ApiIntegrationHubProps> = ({ clients }) => {
  const [selectedClient, setSelectedClient] = useState<string>(
    clients[0]?.clientKey || 'my-api-service'
  );
  const [selectedLang, setSelectedLang] = useState<
    'curl' | 'node' | 'python' | 'go' | 'express' | 'nginx'
  >('curl');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const activeKey = selectedClient || 'my-api-service';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const snippets: Record<string, string> = {
    curl: `# 1. Perform an atomic rate limit check
curl -X POST "${baseUrl}/v1/check" \\
  -H "Content-Type: application/json" \\
  -d '{"clientKey": "${activeKey}"}'

# Response Example (HTTP 200 OK):
# {
#   "decision": "ALLOW",
#   "algorithm": "token_bucket",
#   "limit": 20,
#   "remaining": 19,
#   "reset": 1741200000,
#   "instanceId": "limiter-01"
# }`,

    node: `import fetch from 'node-fetch';

async function checkRateLimit(clientKey: string): Promise<boolean> {
  const response = await fetch('${baseUrl}/v1/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientKey }),
  });

  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');

  if (response.status === 200) {
    console.log(\`✅ ALLOW: \${remaining} tokens remaining (Reset: \${reset})\`);
    return true;
  } else if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    console.warn(\`⛔ 429 THROTTLED: Retry after \${retryAfter}s\`);
    return false;
  }
  
  throw new Error(\`Rate limiter error: \${response.status}\`);
}

// Example usage
await checkRateLimit('${activeKey}');`,

    python: `import requests

def check_rate_limit(client_key: str) -> bool:
    url = "${baseUrl}/v1/check"
    payload = {"clientKey": client_key}
    
    response = requests.post(url, json=payload)
    
    limit = response.headers.get("X-RateLimit-Limit")
    remaining = response.headers.get("X-RateLimit-Remaining")
    
    if response.status_code == 200:
        print(f"✅ ALLOW: {remaining}/{limit} tokens remaining")
        return True
    elif response.status_code == 429:
        retry_after = response.headers.get("Retry-After", "1")
        print(f"⛔ THROTTLED (429): Backoff for {retry_after}s")
        return False
    else:
        response.raise_for_status()

# Example invocation
is_allowed = check_rate_limit("${activeKey}")`,

    go: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

type RateLimitRequest struct {
	ClientKey string \`json:"clientKey"\`
}

func CheckRateLimit(clientKey string) (bool, error) {
	payload, _ := json.Marshal(RateLimitRequest{ClientKey: clientKey})
	resp, err := http.Post("${baseUrl}/v1/check", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		fmt.Printf("✅ ALLOW: Remaining: %s\\n", resp.Header.Get("X-RateLimit-Remaining"))
		return true, nil
	} else if resp.StatusCode == http.StatusTooManyRequests {
		fmt.Printf("⛔ THROTTLED: Retry-After: %s\\n", resp.Header.Get("Retry-After"))
		return false, nil
	}

	return false, fmt.Errorf("unexpected status: %d", resp.StatusCode)
}

func main() {
	CheckRateLimit("${activeKey}")
}`,

    express: `import express from 'express';
import fetch from 'node-fetch';

const app = express();

// Rate Limiting Interceptor Middleware
const rateLimitMiddleware = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || '${activeKey}';
  
  try {
    const checkRes = await fetch('${baseUrl}/v1/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: apiKey }),
    });

    // Forward standard RateLimit headers to client
    res.setHeader('X-RateLimit-Limit', checkRes.headers.get('X-RateLimit-Limit') || '');
    res.setHeader('X-RateLimit-Remaining', checkRes.headers.get('X-RateLimit-Remaining') || '');
    res.setHeader('X-RateLimit-Reset', checkRes.headers.get('X-RateLimit-Reset') || '');

    if (checkRes.status === 200) {
      return next();
    }

    if (checkRes.status === 429) {
      res.setHeader('Retry-After', checkRes.headers.get('Retry-After') || '1');
      return res.status(429).json({ error: 'Too Many Requests: Rate limit exceeded' });
    }

    return next(); // Fallback on degraded mode
  } catch (err) {
    console.error('Rate limiter unreachable:', err);
    return next();
  }
};

app.use('/api', rateLimitMiddleware);`,

    nginx: `# Nginx subrequest authentication integration
location /api/ {
    auth_request /_rate_limit_check;
    
    # Forward upstream request if allowed (200)
    proxy_pass http://upstream_backend;
}

location = /_rate_limit_check {
    internal;
    proxy_pass ${baseUrl}/v1/check;
    proxy_pass_request_body off;
    proxy_set_header Content-Type "application/json";
    proxy_set_body '{"clientKey": "$http_x_api_key"}';
}`,
  };

  const currentSnippet = snippets[selectedLang] || snippets.curl;

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">
            <Code2 size={18} color="#F97316" />
            <span>Developer API Integration & Code Hub</span>
          </div>
          <div className="panel-subtitle">
            Pre-configured client libraries and proxy snippets for microservice integration
          </div>
        </div>

        {/* Client Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA' }}>Client Target:</label>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            style={{
              padding: '6px 12px',
              background: '#202024',
              border: '1px solid #2A2A30',
              color: '#F4F4F5',
              borderRadius: 6,
              fontWeight: 600,
            }}
          >
            {clients.map((c) => (
              <option key={c.clientKey} value={c.clientKey}>
                {c.clientKey}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Language Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {[
          { id: 'curl', label: 'cURL / Shell', icon: <Terminal size={13} /> },
          { id: 'node', label: 'Node.js / TS', icon: <FileCode2 size={13} /> },
          { id: 'python', label: 'Python', icon: <Code2 size={13} /> },
          { id: 'go', label: 'Go (Golang)', icon: <Globe size={13} /> },
          { id: 'express', label: 'Express / Fastify Middleware', icon: <Server size={13} /> },
          { id: 'nginx', label: 'Nginx Reverse Proxy', icon: <Layers size={13} /> },
        ].map((lang) => (
          <button
            key={lang.id}
            className={`btn btn-sm ${selectedLang === lang.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedLang(lang.id as any)}
          >
            {lang.icon}
            <span>{lang.label}</span>
          </button>
        ))}
      </div>

      {/* Code Snippet Box */}
      <div className="code-box" style={{ minHeight: 280, position: 'relative' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => handleCopy(currentSnippet, selectedLang)}
          style={{ position: 'absolute', top: 10, right: 10, padding: '4px 8px', fontSize: 11 }}
        >
          {copiedKey === selectedLang ? <Check size={12} color="#22C55E" /> : <Copy size={12} />}
          <span>{copiedKey === selectedLang ? 'Copied' : 'Copy Code'}</span>
        </button>
        <pre>{currentSnippet}</pre>
      </div>

      {/* API Endpoints Summary Table */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#F4F4F5' }}>Core Service API Endpoints</div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Description</th>
                <th>Authentication</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <span className="method-pill method-post">POST</span>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#F4F4F5' }}>/v1/check</td>
                <td>Evaluates atomic rate limit check and returns RFC headers</td>
                <td style={{ color: '#A1A1AA' }}>Public / Upstream Gateways</td>
              </tr>
              <tr>
                <td>
                  <span className="method-pill method-get">GET</span>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#F4F4F5' }}>/health</td>
                <td>Cluster and dependency health check (PostgreSQL & Redis status)</td>
                <td style={{ color: '#A1A1AA' }}>Public / Load Balancers</td>
              </tr>
              <tr>
                <td>
                  <span className="method-pill method-get">GET</span>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#F4F4F5' }}>/metrics</td>
                <td>Prometheus / cumulative throughput & quota metrics</td>
                <td style={{ color: '#A1A1AA' }}>Admin Bearer Key (if enabled)</td>
              </tr>
              <tr>
                <td>
                  <span className="method-pill method-put">PUT</span>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#F4F4F5' }}>/v1/admin/clients</td>
                <td>Create, Read, Update, and Delete client rate policies</td>
                <td style={{ color: '#A1A1AA' }}>Admin Bearer Key (if enabled)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
