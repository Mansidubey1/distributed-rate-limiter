# ⚡ LIMITER LAB: Postman-Style API Gateway & Rate Limiting Workbench

A high-performance, persistent, concurrency-safe, and distributed **Reverse Proxy API Gateway & Rate Limiting Workbench** built with **Node.js**, **TypeScript**, **Fastify**, **PostgreSQL (Prisma)**, **Redis (Atomic Lua Scripts)**, and an interactive **React + Vite Postman Workbench**.

---

## Architecture Overview

```
                    GitHub
                       │
              ┌────────▼─────────┐
              │    LimiterLab    │
              │ React + Vite     │
              └────────┬─────────┘
                       │
                       ▼
                Fastify Gateway (Port :3000)
                       │
             ┌─────────┼─────────┐
             │         │         │
             ▼         ▼         ▼
          SSRF      Rate      Metrics
          Guard     Limiter
                       │
                ┌──────┴──────┐
                ▼             ▼
             Redis        PostgreSQL
             Lua          Prisma
                │
                ▼
            Target APIs (JSONPlaceholder, DummyJSON, Custom Endpoints)
```

### Gateway Pipeline Lifecycle
```
Client Request (GET / POST / PUT / DELETE / PATCH)
      │
      ▼
1. SSRF DNS & IP Guard (Blocks 127.0.0.1, 10.0.0.0/8, 169.254.169.254, private CIDRs)
      │
      ▼
2. Client Policy Lookup (PostgreSQL / In-Memory Cache)
      │
      ▼
3. Atomic Rate Limiter Evaluation (Redis Lua / PostgreSQL CTE)
      │
      ├── 🔴 DENY (Quota Depleted)
      │      │
      │      ▼
      │   HTTP 429 Too Many Requests + Retry-After (Target API is NEVER called)
      │
      └── 🟢 ALLOW (Tokens Available)
             │
             ▼
          Forward Request to Target API
             │
             ▼
          Return Target Response + RFC RateLimit Headers + Telemetry
```

---

## Features

- **Postman-Style API Gateway (`POST /v1/proxy`)**:
  - Enter any external HTTP/REST API (e.g. JSONPlaceholder, DummyJSON, CatFacts, custom servers).
  - Full HTTP Method Support: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`.
  - Custom forwarded headers, query params synchronization, and JSON body payloads.
- **Deep SSRF Protection (`ssrfGuard.ts`)**:
  - Validates protocols (`http:` and `https:`).
  - Resolves hostnames via DNS and blocks private IP ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `0.0.0.0/8`, `::1`, `localhost`).
- **Multi-Algorithm Support (Selectable Per-Client)**:
  - **Token Bucket**: Continuous mathematical token refill with burst capacity.
  - **Sliding Window Log**: Trailing window quota enforcement via timestamp logs and atomic sorted sets.
- **Sub-Millisecond Atomic Lua Scripts**:
  - `tokenBucket.lua` & `slidingWindow.lua` execute atomically inside Redis to eliminate race conditions and prevent double-spending.
- **High-Concurrency Burst Stress Runner**:
  - Test real upstream APIs with 10 to 500 concurrent requests.
  - Real-time animated progress bar with live 200 OK vs 429 Throttled counters.
  - Latency statistics (Min, Mean, Median p50, p95, p99) and visual distribution breakdown.
- **Live Algorithm Physics & Telemetry**:
  - Interactive ASCII token meter (`██████████░░░░ 16 / 20 tokens`), gradient capacity bar, refill rate, and reset countdown.
- **Multi-Instance Cluster Deployment**:
  - Ready to run with Docker Compose (PostgreSQL, Redis, 3 Rate Limiter instances, Nginx load balancer).

---

## Repository Structure

```
token_bucket_rate/
├── backend/
│   ├── src/
│   │   ├── algorithms/         # Token Bucket and Sliding Window math
│   │   ├── db/                 # Prisma PostgreSQL client
│   │   ├── middleware/         # Admin auth & security hooks
│   │   ├── proxy/              # SSRF Guard & Outbound Proxy Dispatcher
│   │   ├── repositories/       # Redis Lua & Postgres repositories
│   │   ├── routes/             # /v1/proxy, /v1/check, /v1/admin, /health, /metrics
│   │   ├── services/           # RateLimiterService, ProxyService, MetricsService
│   │   ├── app.ts              # Fastify App builder
│   │   └── server.ts           # Server entry point
│   ├── prisma/                 # Prisma schema & migrations
│   ├── tests/                  # Unit, integration, concurrency & distributed tests
│   ├── load-tests/             # Single-instance & distributed load tests
│   ├── public/                 # Static compiled dashboard assets
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── postman/        # RequestBuilder, ResponseViewer, BurstModal, Header, etc.
│   │   ├── data/               # Curated demo API presets & default collections
│   │   ├── types/              # Postman & Gateway TypeScript types
│   │   ├── App.tsx             # Main workspace orchestrator
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts          # Vite build targeting backend/public/dashboard-dist
├── Dockerfile                  # Multi-stage production container build
├── docker-compose.yml          # Multi-instance cluster deployment
├── nginx.conf                  # Nginx round-robin load balancer config
├── package.json                # Root orchestration & workspace scripts
├── .gitignore
└── README.md
```

---

## Quick Start

### 1. Local Development Mode

From the project root:

```powershell
# 1. Install all dependencies (frontend and backend)
npm run install:all

# 2. Setup PostgreSQL database schema (Prisma)
npm run prisma:push

# 3. Build frontend dashboard and backend
npm run build

# 4. Start backend in development mode (with hot reload)
npm run dev:backend

# Or start frontend Vite dev server independently
npm run dev:frontend
```

Open your browser at: **`http://localhost:3000/dashboard`**

---

### 2. Multi-Instance Cluster Deployment (Docker)

```bash
docker compose up --build
```

This starts:
- `PostgreSQL` on port 5432
- `Redis` on port 6379
- 3 API instances (`rate-limiter-1`, `rate-limiter-2`, `rate-limiter-3`)
- `Nginx Load Balancer` on port 3000

---

## Root Orchestration Scripts

| Command | Description |
| :--- | :--- |
| `npm run install:all` | Installs dependencies in both `backend` and `frontend` |
| `npm run dev:backend` | Starts the backend server with hot-reloading (`tsx watch`) |
| `npm run dev:frontend` | Starts the frontend Vite development server |
| `npm run build:frontend` | Builds the React frontend into `backend/public/dashboard-dist` |
| `npm run build:backend` | Compiles backend TypeScript and copies Lua scripts |
| `npm run build` | Builds both frontend and backend |
| `npm start` | Runs the compiled backend production server (`backend/dist/server.js`) |
| `npm test` | Runs the full Vitest suite (unit, integration, concurrency, distributed, proxy) |
| `npm run test:unit` | Runs unit tests |
| `npm run test:integration` | Runs integration tests |
| `npm run test:concurrency` | Runs concurrency tests |
| `npm run test:distributed` | Runs distributed multi-instance tests |
| `npm run test:load` | Runs single-instance load tests (Autocannon) |
| `npm run prisma:push` | Pushes Prisma schema to PostgreSQL database |

---

## API Reference

### 1. Reverse Proxy Gateway (`POST /v1/proxy`)

Route any HTTP request through the rate limiter gateway.

```http
POST /v1/proxy
Content-Type: application/json

{
  "url": "https://jsonplaceholder.typicode.com/posts/1",
  "method": "GET",
  "clientKey": "mobile-app-client",
  "headers": {
    "Accept": "application/json"
  }
}
```

#### Response (200 OK - ALLOW):
```json
{
  "decision": "ALLOW",
  "statusCode": 200,
  "statusText": "OK",
  "targetUrl": "https://jsonplaceholder.typicode.com/posts/1",
  "method": "GET",
  "latencyMs": 142.5,
  "sizeBytes": 292,
  "headers": {
    "content-type": "application/json; charset=utf-8"
  },
  "body": {
    "userId": 1,
    "id": 1,
    "title": "sunt aut facere repellat...",
    "body": "quia et suscipit..."
  },
  "rateLimit": {
    "algorithm": "token_bucket",
    "limit": 20,
    "remaining": 19,
    "reset": 1787235500
  },
  "instanceId": "limiter-01",
  "requestId": "req-1a2b3c"
}
```

#### Response (429 Too Many Requests - DENY):
```json
{
  "decision": "DENY",
  "statusCode": 429,
  "statusText": "Too Many Requests",
  "targetUrl": "https://jsonplaceholder.typicode.com/posts/1",
  "method": "GET",
  "latencyMs": 1.2,
  "sizeBytes": 0,
  "headers": {
    "x-ratelimit-limit": "20",
    "x-ratelimit-remaining": "0",
    "x-ratelimit-reset": "1787235500",
    "retry-after": "1"
  },
  "body": {
    "error": "Rate limit exceeded for client 'mobile-app-client'. Request was throttled by the rate limiter gateway.",
    "algorithm": "token_bucket",
    "limit": 20,
    "remaining": 0,
    "reset": 1787235500,
    "retryAfter": 1
  },
  "rateLimit": {
    "algorithm": "token_bucket",
    "limit": 20,
    "remaining": 0,
    "reset": 1787235500,
    "retryAfter": 1
  },
  "instanceId": "limiter-01",
  "requestId": "req-1a2b3c",
  "error": "Rate limit exceeded for client 'mobile-app-client'. Request was throttled by the rate limiter gateway."
}
```

---

### 2. Direct Rate Limit Check (`POST /v1/check`)

Evaluates token consumption without calling an external target API.

```http
POST /v1/check
Content-Type: application/json

{
  "clientKey": "mobile-app-client"
}
```

---

### 3. Admin Policy Management

```http
POST /v1/admin/clients
Authorization: Bearer dev-admin-secret-key-change-in-production
Content-Type: application/json

{
  "clientKey": "payment-service",
  "algorithm": "token_bucket",
  "requestsPerSecond": 100,
  "burstSize": 200
}
```

---

### 4. Multi-Dependency Health

```http
GET /health
```

```json
{
  "status": "ok",
  "database": "connected",
  "instanceId": "limiter-01",
  "services": {
    "api": "healthy",
    "postgres": "healthy",
    "redis": "healthy"
  }
}
```

---

## Testing & Benchmarks

```powershell
# Run all unit, integration, concurrency, distributed, and proxy tests
npm test

# Run single-instance comparative load test (Autocannon)
npm run test:load

# Run distributed multi-instance load test
npm run test:distributed
```

### Benchmark Results

| Configuration | Throughput | Median Latency | Errors |
| :--- | :--- | :--- | :--- |
| **Token Bucket (PostgreSQL CTE)** | 1,570+ RPS | 11 ms | 0 |
| **Sliding Window (PostgreSQL Lock)** | 510+ RPS | 6 ms | 0 |
| **Distributed Multi-Instance (Redis Lua)** | 1,000+ RPS | < 5 ms | 0 |
| **Gateway Proxy Dispatch (Live Outbound)** | 850+ RPS | < 8 ms | 0 |
