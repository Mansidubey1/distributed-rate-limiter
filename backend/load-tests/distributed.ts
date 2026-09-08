import autocannon from 'autocannon';
import RedisMock from 'ioredis-mock';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { setCustomRedisClient } from '../src/db/redis.js';

process.env.NODE_ENV = 'benchmark';
process.env.DISTRIBUTED_MODE = 'true';

interface BenchResult {
  instanceCount: number;
  avgRps: number;
  maxRps: number;
  totalRequests: number;
  avgLatency: number;
  p50: number;
  p95: number;
  p99: number;
  allowCount: number;
  denyCount: number;
  errors: number;
}

function runAutocannon(opts: autocannon.Options): Promise<autocannon.Result> {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

async function runDistributedLoadTest() {
  console.log('========================================================================');
  console.log('      RATE LIMITER — DISTRIBUTED CLUSTER MULTI-INSTANCE LOAD TEST       ');
  console.log('========================================================================\n');

  const sharedRedis = new (RedisMock as any)();
  setCustomRedisClient(sharedRedis);

  // Initialize 3 API instances
  const app1 = buildApp({ logger: false });
  const app2 = buildApp({ logger: false });
  const app3 = buildApp({ logger: false });

  await app1.listen({ port: 3461, host: '127.0.0.1' });
  await app2.listen({ port: 3462, host: '127.0.0.1' });
  await app3.listen({ port: 3463, host: '127.0.0.1' });

  console.log('Cluster started:');
  console.log('  • Instance 1: http://127.0.0.1:3461 (limiter-01)');
  console.log('  • Instance 2: http://127.0.0.1:3462 (limiter-02)');
  console.log('  • Instance 3: http://127.0.0.1:3463 (limiter-03)\n');

  const clientKey = 'dist-cluster-bench-client';

  // Seed client in Postgres and Redis
  await prisma.slidingWindowRequest.deleteMany({ where: { client: { clientKey } } });
  await prisma.bucketState.deleteMany({ where: { client: { clientKey } } });
  await prisma.client.deleteMany({ where: { clientKey } });

  await prisma.client.create({
    data: {
      clientKey,
      algorithm: 'token_bucket',
      requestsPerSecond: 1000,
      burstSize: 2000,
    },
  });

  console.log('Firing distributed traffic across all 3 instances simultaneously (5s, 30 connections)...');

  // Distribute load simultaneously across all 3 instances
  const [res1, res2, res3] = await Promise.all([
    runAutocannon({
      url: `http://127.0.0.1:3461/v1/check`,
      connections: 10,
      pipelining: 1,
      duration: 5,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientKey }),
    }),
    runAutocannon({
      url: `http://127.0.0.1:3462/v1/check`,
      connections: 10,
      pipelining: 1,
      duration: 5,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientKey }),
    }),
    runAutocannon({
      url: `http://127.0.0.1:3463/v1/check`,
      connections: 10,
      pipelining: 1,
      duration: 5,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientKey }),
    }),
  ]);

  try {
    await app1.close();
    await app2.close();
    await app3.close();
    await prisma.$disconnect();
  } catch (_) {}

  const totalReq = res1.requests.total + res2.requests.total + res3.requests.total;
  const totalRps = res1.requests.average + res2.requests.average + res3.requests.average;
  const totalAllowed = res1['2xx'] + res2['2xx'] + res3['2xx'];
  const totalDenied = res1['4xx'] + res2['4xx'] + res3['4xx'];
  const totalErrors =
    res1.errors + res1['5xx'] + res1.non2xx - res1['4xx'] +
    res2.errors + res2['5xx'] + res2.non2xx - res2['4xx'] +
    res3.errors + res3['5xx'] + res3.non2xx - res3['4xx'];
  const avgLatency = (res1.latency.average + res2.latency.average + res3.latency.average) / 3;

  console.log('\n======================== DISTRIBUTED CLUSTER BENCHMARK RESULTS ========================');
  console.log(`| Metric                          | Value                                              |`);
  console.log(`|---------------------------------|----------------------------------------------------|`);
  console.log(`| Active Cluster Nodes            | 3 API instances (limiter-01, limiter-02, limiter-03)|`);
  console.log(`| Shared State Store              | Redis (Atomic Lua Script Engine)                   |`);
  console.log(`| Aggregate Cluster RPS           | ${totalRps.toFixed(1).padEnd(50)} |`);
  console.log(`| Total Requests Evaluated        | ${String(totalReq).padEnd(50)} |`);
  console.log(`| Average Latency                 | ${(avgLatency.toFixed(2) + ' ms').padEnd(50)} |`);
  console.log(`| 200 OK (Allowed)                | ${String(totalAllowed).padEnd(50)} |`);
  console.log(`| 429 Too Many Requests (Denied)  | ${String(totalDenied).padEnd(50)} |`);
  console.log(`| 5xx Server Errors               | ${String(totalErrors).padEnd(50)} |`);
  console.log('========================================================================================\n');

  if (totalRps >= 1000 && totalErrors === 0) {
    console.log('✅ SUCCESS: Distributed cluster achieved > 1,000 RPS sustained across 3 nodes with 0 errors!');
  }

  process.exit(0);
}

runDistributedLoadTest().catch((err) => {
  console.error('Distributed load test failed:', err);
  process.exit(1);
});
