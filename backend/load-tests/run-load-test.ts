import autocannon from 'autocannon';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

process.env.NODE_ENV = 'benchmark';

interface BenchResult {
  algorithm: string;
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

async function runBenchmarkForAlgorithm(
  algorithm: 'token_bucket' | 'sliding_window',
  clientKey: string,
  port: number,
  host: string,
  durationSec: number = 5,
  connections: number = 20
): Promise<BenchResult> {
  // Clean up existing client & states
  await prisma.slidingWindowRequest.deleteMany({ where: { client: { clientKey } } });
  await prisma.bucketState.deleteMany({ where: { client: { clientKey } } });
  await prisma.client.deleteMany({ where: { clientKey } });

  if (algorithm === 'token_bucket') {
    await prisma.client.create({
      data: {
        clientKey,
        algorithm: 'token_bucket',
        requestsPerSecond: 300,
        burstSize: 600,
        bucketState: {
          create: {
            tokens: 600,
            lastRefillAt: new Date(),
          },
        },
      },
    });
  } else {
    await prisma.client.create({
      data: {
        clientKey,
        algorithm: 'sliding_window',
        requestsPerSecond: 300,
        windowSize: 10,
        burstSize: 300,
      },
    });
  }

  const result = await runAutocannon({
    url: `http://${host}:${port}/v1/check`,
    connections,
    pipelining: 1,
    duration: durationSec,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ clientKey }),
  });

  return {
    algorithm,
    avgRps: result.requests.average,
    maxRps: result.requests.max,
    totalRequests: result.requests.total,
    avgLatency: result.latency.average,
    p50: result.latency.p50,
    p95: result.latency.p97_5 || result.latency.p90 || result.latency.average,
    p99: result.latency.p99,
    allowCount: result['2xx'],
    denyCount: result['4xx'],
    errors: result.errors + result['5xx'] + result.non2xx - result['4xx'],
  };
}

async function runLoadTests() {
  console.log('========================================================================');
  console.log('   PHASE 2 RATE LIMITER — COMPARATIVE MULTI-ALGORITHM LOAD TEST RUNNER   ');
  console.log('========================================================================\n');

  const PORT = 3456;
  const HOST = '127.0.0.1';

  const app = buildApp({ logger: false });
  await app.listen({ port: PORT, host: HOST });
  console.log(`Rate Limiter server listening on http://${HOST}:${PORT}\n`);

  console.log('1. Running Token Bucket benchmark (5s, 20 connections)...');
  const tbResult = await runBenchmarkForAlgorithm('token_bucket', 'tb-load-client', PORT, HOST, 5, 20);

  console.log('\n2. Running Sliding Window benchmark (5s, 20 connections)...');
  const swResult = await runBenchmarkForAlgorithm('sliding_window', 'sw-load-client', PORT, HOST, 5, 20);

  try {
    await app.close();
    await prisma.$disconnect();
  } catch (_) {}

  console.log('\n======================== COMPARATIVE LOAD TEST RESULTS ========================');
  console.log(`| Metric                   | Token Bucket (CTE Lock) | Sliding Window (Row Lock) |`);
  console.log(`|--------------------------|-------------------------|---------------------------|`);
  console.log(`| Average RPS              | ${tbResult.avgRps.toFixed(1).padEnd(23)} | ${swResult.avgRps.toFixed(1).padEnd(25)} |`);
  console.log(`| Max RPS                  | ${String(tbResult.maxRps).padEnd(23)} | ${String(swResult.maxRps).padEnd(25)} |`);
  console.log(`| Total Requests           | ${String(tbResult.totalRequests).padEnd(23)} | ${String(swResult.totalRequests).padEnd(25)} |`);
  console.log(`| Avg Latency              | ${(tbResult.avgLatency.toFixed(2) + ' ms').padEnd(23)} | ${(swResult.avgLatency.toFixed(2) + ' ms').padEnd(25)} |`);
  console.log(`| p50 (Median) Latency     | ${(tbResult.p50 + ' ms').padEnd(23)} | ${(swResult.p50 + ' ms').padEnd(23)} |`);
  console.log(`| p95 Latency              | ${(tbResult.p95 + ' ms').padEnd(23)} | ${(swResult.p95 + ' ms').padEnd(25)} |`);
  console.log(`| p99 Latency              | ${(tbResult.p99 + ' ms').padEnd(23)} | ${(swResult.p99 + ' ms').padEnd(25)} |`);
  console.log(`| 200 OK (ALLOW)           | ${String(tbResult.allowCount).padEnd(23)} | ${String(swResult.allowCount).padEnd(25)} |`);
  console.log(`| 429 Too Many Requests    | ${String(tbResult.denyCount).padEnd(23)} | ${String(swResult.denyCount).padEnd(25)} |`);
  console.log(`| Errors / 5xx             | ${String(tbResult.errors).padEnd(23)} | ${String(swResult.errors).padEnd(25)} |`);
  console.log('===============================================================================\n');

  if (tbResult.avgRps >= 500 && swResult.avgRps >= 500 && tbResult.errors === 0 && swResult.errors === 0) {
    console.log('✅ SUCCESS: Both algorithms met acceptance criteria (≥ 500 RPS sustained, 0 errors)!');
  } else {
    console.log(`Summary: Token Bucket: ${tbResult.avgRps.toFixed(1)} RPS, Sliding Window: ${swResult.avgRps.toFixed(1)} RPS, Errors: ${tbResult.errors + swResult.errors}`);
  }

  process.exit(0);
}

runLoadTests().catch((err) => {
  console.error('Load test runner failed:', err);
  process.exit(1);
});
