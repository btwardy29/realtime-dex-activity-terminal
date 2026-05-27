import { Queue, type ConnectionOptions } from "bullmq";
import Redis from "ioredis";
import pg from "pg";
import pino from "pino";

import { queueNames } from "@rdat/shared";
import type { CandleAggregationJob } from "@rdat/types";

import { config } from "./config";
import { createCandleAggregationWorker } from "./candles/processor";
import { runDataRetention } from "./cleanup/retention";
import { IngestionWorker } from "./ingestion/worker";

const { Pool } = pg;

const logger = pino({
  level: config.NODE_ENV === "production" ? "info" : "debug"
});

const db = new Pool({ connectionString: config.DATABASE_URL, max: 3 });
const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null
});
const queueConnection = buildQueueConnection(config.REDIS_URL);

const candleAggregationQueue = new Queue<CandleAggregationJob>(queueNames.candleAggregation, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000
    },
    removeOnComplete: 1000,
    removeOnFail: 5000
  }
});
const queues = [
  candleAggregationQueue,
  ...[queueNames.trendingCalculation, queueNames.ingestionRetry, queueNames.cleanup].map(
    (name) =>
      new Queue(name, {
        connection: queueConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000
          },
          removeOnComplete: 100,
          removeOnFail: 500
        }
      })
  )
];
const ingestionWorker = new IngestionWorker(db, redis, logger, candleAggregationQueue);
const candleWorker = createCandleAggregationWorker({
  db,
  redis,
  connection: queueConnection,
  concurrency: config.WORKER_CONCURRENCY,
  logger
});
const cleanupTimer = setInterval(() => {
  void runDataRetention({
    db,
    redis,
    retentionDays: config.DATA_RETENTION_DAYS,
    logger
  }).catch((error: unknown) => {
    logger.error({ error }, "Data retention cleanup failed");
  });
}, config.CLEANUP_INTERVAL_MS);

cleanupTimer.unref();

await db.query("SELECT 1");
await redis.ping();
await ingestionWorker.start();
await runDataRetention({
  db,
  redis,
  retentionDays: config.DATA_RETENTION_DAYS,
  logger
});

logger.info(
  {
    queueCount: queues.length,
    workerConcurrency: config.WORKER_CONCURRENCY,
    ingestionEnabled: config.INGESTION_ENABLED,
    monitoredPools: config.MONITORED_POOLS.length,
    dataRetentionDays: config.DATA_RETENTION_DAYS,
    cleanupIntervalMs: config.CLEANUP_INTERVAL_MS
  },
  "Worker bootstrap completed"
);

const shutdown = async () => {
  logger.info("Shutting down worker");
  clearInterval(cleanupTimer);
  await ingestionWorker.stop();
  await candleWorker.close();
  await Promise.all(queues.map((queue) => queue.close()));
  await redis.quit();
  await db.end();
};

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

function buildQueueConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  const connection: ConnectionOptions & {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
  } = {
    host: url.hostname,
    port: Number(url.port || 6379),
    maxRetriesPerRequest: null
  };

  if (url.username) {
    connection.username = decodeURIComponent(url.username);
  }

  if (url.password) {
    connection.password = decodeURIComponent(url.password);
  }

  const db = url.pathname.replace("/", "");
  if (db) {
    connection.db = Number(db);
  }

  return connection;
}
