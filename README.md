# Token Bucket & Sliding Window Distributed Rate Limiter Service

A high-performance, persistent, concurrency-safe, and distributed Rate Limiter Service built with **Node.js**, **TypeScript**, **Fastify**, **PostgreSQL (Prisma)**, **Redis (Atomic Lua Scripts)**, and an interactive **React + Vite Dashboard**.

---

## Repository Structure

The project is cleanly split into two dedicated folders:

```
token_bucket_rate/
├── backend/
│   ├── src/                    # Server, routes, algorithms, repositories, services
│   ├── prisma/                 # Prisma schema & migrations
│   ├── tests/                  # Unit, integration, concurrency & distributed tests
│   ├── load-tests/             # Single-instance & distributed load tests
│   ├── public/                 # Static dashboard assets & bundle
│   ├── .env & .env.example     # Backend environment configurations
│   ├── package.json            # Backend dependencies and scripts
│   ├── tsconfig.json           # Backend TypeScript configuration
│   └── vitest.config.ts        # Backend Vitest configuration
├── frontend/
│   ├── src/                    # React dashboard UI (Vite + Lucide Icons)
│   ├── index.html              # Frontend entry point
│   ├── package.json            # Frontend dependencies and scripts
│   ├── tsconfig.json           # Frontend TypeScript configuration
│   └── vite.config.ts          # Vite build pipeline (outputs to backend/public/dashboard-dist)
├── Dockerfile                  # Multi-stage production container build
├── docker-compose.yml          # Multi-instance cluster deployment
├── nginx.conf                  # Nginx round-robin load balancer config
├── package.json                # Root orchestration & workspace scripts
├── .gitignore                  # Git ignore rules
└── README.md
```

---

## Architecture Overview

```
                              USERS
                                │
                                ▼
                         ┌──────────────┐
                         │ Load Balancer│ (Nginx :3000)
                         └──────┬───────┘
                                │
                 ┌──────────────┼──────────────┐
                 │              │              │
                 ▼              ▼              ▼
           ┌──────────┐   ┌──────────┐   ┌──────────┐
           │ Limiter 1│   │ Limiter 2│   │ Limiter 3│
           └─────┬────┘   └─────┬────┘   └─────┬────┘
                 │              │              │
                 └──────────────┼──────────────┘
                                │
                         ┌──────▼──────┐
                         │    Redis    │ (Shared Atomic State via Lua)
                         │ Shared State│
                         └──────┬──────┘
                                │
                         ┌──────▼──────┐
                         │ PostgreSQL  │ (Client Configurations & Metadata)
                         │ Configuration│
                         └─────────────┘

                         ┌─────────────┐
                         │   React     │ (Vite + Lucide Icons)
                         │  Dashboard  │
                         └──────┬──────┘
                                │
                                ▼
                         Metrics & Real-Time Monitoring
```

---

## Features

- **Multi-Algorithm Support (Selectable Per-Client)**:
  - **Token Bucket**: Continuous mathematical token refill with burst capacity.
  - **Sliding Window Log**: Trailing window quota enforcement via timestamp logs and atomic sorted sets.
- **Sub-Millisecond Atomic Lua Scripts**:
  - `tokenBucket.lua` & `slidingWindow.lua` execute atomically inside Redis to eliminate race conditions and avoid double-spending.
- **Distributed Shared State (`DISTRIBUTED_MODE=true|false`)**:
  - Seamlessly toggle between Redis cluster mode and local PostgreSQL persistence.
- **Multi-Instance Resilience**:
  - Independent `INSTANCE_ID` tagging across structured logs and health status.
  - Fail-safe 503 response policy when Redis is unavailable, preventing unthrottled over-admission.
- **Multi-Dependency Health Checking**:
  - `GET /health` independently reports the status of the API, PostgreSQL, and Redis.
- **Interactive Live Dashboard**:
  - Served directly from `/dashboard` with real-time traffic charts, KPI stat cards, interactive burst simulator, and policy configuration modals.
- **Docker Compose Ready**:
  - 1-command startup launching PostgreSQL, Redis, 3 API instances, and an Nginx load balancer.

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

You can run any workflow directly from the root directory:

| Command | Description |
| :--- | :--- |
| `npm run install:all` | Installs dependencies in both `backend` and `frontend` |
| `npm run dev:backend` | Starts the backend server with hot-reloading (`tsx watch`) |
| `npm run dev:frontend` | Starts the frontend Vite development server |
| `npm run build:frontend` | Builds the React frontend into `backend/public/dashboard-dist` |
| `npm run build:backend` | Compiles backend TypeScript and copies Lua scripts |
| `npm run build` | Builds both frontend and backend |
| `npm start` | Runs the compiled backend production server (`backend/dist/server.js`) |
| `npm test` | Runs the full Vitest suite (unit, integration, concurrency, distributed) |
| `npm run test:unit` | Runs unit tests |
| `npm run test:integration` | Runs integration tests |
| `npm run test:concurrency` | Runs concurrency tests |
| `npm run test:distributed` | Runs distributed multi-instance tests |
| `npm run test:load` | Runs single-instance load tests (Autocannon) |
| `npm run prisma:push` | Pushes Prisma schema to PostgreSQL database |

---

## API Reference

### 1. Evaluate Rate Limit
```http
POST /v1/check
Content-Type: application/json

{
  "clientKey": "mobile-app-client"
}
```

#### Response Headers:
- `X-RateLimit-Limit`: Configured burst capacity or window quota
- `X-RateLimit-Remaining`: Available tokens / remaining requests in window
- `X-RateLimit-Reset`: Unix timestamp in seconds when tokens replenish
- `Retry-After`: Seconds to wait before retrying (on 429 DENY)

#### Response Body:
```json
{
  "decision": "ALLOW",
  "algorithm": "token_bucket",
  "limit": 20,
  "remaining": 19,
  "reset": 1787235500
}
```

---

### 2. Admin Policy Management

```http
# Create or update client policy
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

### 3. Multi-Dependency Health

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
# Run all unit, integration, concurrency, and distributed tests
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
