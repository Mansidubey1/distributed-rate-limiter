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
  await prisma.slidingWindowRequest.deleteMany({ where: { client: { clientKey } } });
  await prisma.bucketState.deleteMany({ where: { client: { clientKey } } });
  await prisma.client.deleteMany({ where: { clientKey } });

  if (algorithm === 'token_bucket') {
    await prisma.client.create({
      data: {
        clientKey,
        algorithm: 'token_bucket',
        requestsPerSecond: 500,
        burstSize: 1000,
        bucketState: {
          create: {
            tokens: 1000,
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
        requestsPerSecond: 500,
        windowSize: 10,
        burstSize: 500,
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

async function runSingleInstanceLoadTest() {
  console.log('========================================================================');
  console.log('       RATE LIMITER — SINGLE-INSTANCE HIGH-THROUGHPUT LOAD TEST        ');
  console.log('========================================================================\n');

  const PORT = 3457;
  const HOST = '127.0.0.1';

  const app = buildApp({ logger: false });
  await app.listen({ port: PORT, host: HOST });
  console.log(`Rate Limiter server listening on http://${HOST}:${PORT}\n`);

  console.log('1. Benchmarking Token Bucket algorithm (5s, 20 concurrent connections)...');
  const tbResult = await runBenchmarkForAlgorithm('token_bucket', 'tb-single-client', PORT, HOST, 5, 20);

  console.log('\n2. Benchmarking Sliding Window algorithm (5s, 20 concurrent connections)...');
  const swResult = await runBenchmarkForAlgorithm('sliding_window', 'sw-single-client', PORT, HOST, 5, 20);

  try {
    await app.close();
    await prisma.$disconnect();
  } catch (_) {}

  console.log('\n======================== SINGLE INSTANCE BENCHMARK RESULTS ========================');
  console.log(`| Metric                   | Token Bucket            | Sliding Window            |`);
  console.log(`|--------------------------|-------------------------|---------------------------|`);
  console.log(`| Average RPS              | ${tbResult.avgRps.toFixed(1).padEnd(23)} | ${swResult.avgRps.toFixed(1).padEnd(25)} |`);
  console.log(`| Max RPS                  | ${String(tbResult.maxRps).padEnd(23)} | ${String(swResult.maxRps).padEnd(25)} |`);
  console.log(`| Total Requests           | ${String(tbResult.totalRequests).padEnd(23)} | ${String(swResult.totalRequests).padEnd(25)} |`);
  console.log(`| Avg Latency              | ${(tbResult.avgLatency.toFixed(2) + ' ms').padEnd(23)} | ${(swResult.avgLatency.toFixed(2) + ' ms').padEnd(25)} |`);
  console.log(`| p50 Latency              | ${(tbResult.p50 + ' ms').padEnd(23)} | ${(swResult.p50 + ' ms').padEnd(23)} |`);
  console.log(`| p95 Latency              | ${(tbResult.p95 + ' ms').padEnd(23)} | ${(swResult.p95 + ' ms').padEnd(25)} |`);
  console.log(`| 200 OK (ALLOW)           | ${String(tbResult.allowCount).padEnd(23)} | ${String(swResult.allowCount).padEnd(25)} |`);
  console.log(`| 429 Too Many Requests    | ${String(tbResult.denyCount).padEnd(23)} | ${String(swResult.denyCount).padEnd(25)} |`);
  console.log(`| Errors / 5xx             | ${String(tbResult.errors).padEnd(23)} | ${String(swResult.errors).padEnd(25)} |`);
  console.log('===================================================================================\n');

  process.exit(0);
}

runSingleInstanceLoadTest().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
