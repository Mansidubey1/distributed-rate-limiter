import dns from 'dns/promises';
import { URL } from 'url';

export interface SsrfValidationResult {
  allowed: boolean;
  reason?: string;
  resolvedIp?: string;
}

export interface DemoApiPreset {
  id: string;
  name: string;
  category: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  description: string;
  headers?: Record<string, string>;
  body?: any;
}

// Curated safe demo APIs for LimiterLab
export const DEMO_API_PRESETS: DemoApiPreset[] = [
  {
    id: 'preset-jp-post-1',
    name: 'Get Post #1 (JSONPlaceholder)',
    category: 'Public REST APIs',
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/posts/1',
    description: 'Fetch a single JSON post by ID from JSONPlaceholder.',
  },
  {
    id: 'preset-jp-create-post',
    name: 'Create Post (JSONPlaceholder)',
    category: 'Public REST APIs',
    method: 'POST',
    url: 'https://jsonplaceholder.typicode.com/posts',
    description: 'Submit a new post payload with JSON body.',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      title: 'Distributed Rate Limiter Gateway',
      body: 'Testing Token Bucket & Sliding Window via LimiterLab Postman Gateway.',
      userId: 1,
    },
  },
  {
    id: 'preset-dummy-product',
    name: 'Get Product #1 (DummyJSON)',
    category: 'E-Commerce APIs',
    method: 'GET',
    url: 'https://dummyjson.com/products/1',
    description: 'Fetch e-commerce product details with pricing and reviews.',
  },
  {
    id: 'preset-cat-fact',
    name: 'Random Cat Fact',
    category: 'Fun & Utilities',
    method: 'GET',
    url: 'https://catfact.ninja/fact',
    description: 'Fetch a random cat fact in JSON format.',
  },
  {
    id: 'preset-httpbin-get',
    name: 'Echo Headers & IP (HTTPBin)',
    category: 'Testing & Diagnostics',
    method: 'GET',
    url: 'https://httpbin.org/get',
    description: 'Echo back request headers, origin IP, and query params.',
  },
  {
    id: 'preset-httpbin-post',
    name: 'Echo POST Payload (HTTPBin)',
    category: 'Testing & Diagnostics',
    method: 'POST',
    url: 'https://httpbin.org/post',
    description: 'Echo back transmitted JSON payload and client headers.',
    headers: {
      'Content-Type': 'application/json',
      'X-Limiter-Client': 'limiterlab-gateway',
    },
    body: {
      service: 'limiterlab',
      mode: 'distributed_gateway',
      timestamp: new Date().toISOString(),
    },
  },
  {
    id: 'preset-jp-delete-post',
    name: 'Delete Post #1 (JSONPlaceholder)',
    category: 'Public REST APIs',
    method: 'DELETE',
    url: 'https://jsonplaceholder.typicode.com/posts/1',
    description: 'Simulate deleting a resource.',
  },
];

/**
 * Checks whether an IPv4 or IPv6 address is private, loopback, link-local, or otherwise reserved.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv4 checks
  if (ip.includes('.')) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true; // invalid IP is unsafe
    }

    const [a, b] = parts;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;

    // 10.0.0.0/8 (Private)
    if (a === 10) return true;

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;

    // 100.64.0.0/10 (Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 169.254.0.0/16 (Link-local, AWS/GCP metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;

    // 172.16.0.0/12 (Private)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16 (Private)
    if (a === 192 && b === 168) return true;

    // 198.18.0.0/15 (Benchmark testing)
    if (a === 198 && (b === 18 || b === 19)) return true;

    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (a >= 224) return true;

    return false;
  }

  // IPv6 checks
  const lower = ip.toLowerCase();
  if (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fe80:') || // Link-local
    lower.startsWith('fc00:') || // Unique local
    lower.startsWith('fd00:') || // Unique local
    lower.startsWith('::ffff:127.') || // IPv4-mapped loopback
    lower.startsWith('::ffff:10.') ||
    lower.startsWith('::ffff:192.168.') ||
    lower.startsWith('::ffff:172.') ||
    lower.startsWith('::ffff:169.254.')
  ) {
    return true;
  }

  return false;
}

/**
 * Validates a target URL against SSRF attacks by checking scheme, hostname, and resolved IP addresses.
 */
export async function validateTargetUrl(rawUrl: string): Promise<SsrfValidationResult> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { allowed: false, reason: 'URL must be a non-empty string' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (_) {
    return { allowed: false, reason: 'Invalid URL format' };
  }

  // Only allow http: and https: schemes
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      allowed: false,
      reason: `Unsupported URL protocol '${parsed.protocol}'. Only http: and https: are allowed.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and common internal hostnames
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan')
  ) {
    return {
      allowed: false,
      reason: `Access to local/internal hostname '${hostname}' is blocked for SSRF security.`,
    };
  }

  // If hostname is directly an IP address
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':')) {
    if (isPrivateIp(hostname)) {
      return {
        allowed: false,
        reason: `Target IP '${hostname}' is a private/reserved network address and is blocked.`,
        resolvedIp: hostname,
      };
    }
    return { allowed: true, resolvedIp: hostname };
  }

  // Resolve hostname via DNS to prevent DNS rebinding attacks
  try {
    const lookupResult = await dns.lookup(hostname);
    if (isPrivateIp(lookupResult.address)) {
      return {
        allowed: false,
        reason: `Target domain '${hostname}' resolves to private IP '${lookupResult.address}' and is blocked.`,
        resolvedIp: lookupResult.address,
      };
    }
    return { allowed: true, resolvedIp: lookupResult.address };
  } catch (err: any) {
    return {
      allowed: false,
      reason: `Failed to resolve DNS for domain '${hostname}': ${err.message}`,
    };
  }
}
