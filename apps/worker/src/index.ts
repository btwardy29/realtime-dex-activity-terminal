import { Queue } from "bullmq";
import Redis from "ioredis";
import pg from "pg";
import pino from "pino";

import { queueNames } from "@rdat/shared";

import { config } from "./config";

const { Pool } = pg;

const logger = pino({
  level: config.NODE_ENV === "production" ? "info" : "debug"
});

const db = new Pool({ connectionString: config.DATABASE_URL, max: 3 });
const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null
});

const queues = Object.values(queueNames).map(
  (name) =>
    new Queue(name, {
      connection: redis,
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
);

await db.query("SELECT 1");
await redis.ping();

logger.info(
  {
    queueCount: queues.length,
    workerConcurrency: config.WORKER_CONCURRENCY
  },
  "Worker bootstrap completed"
);

const shutdown = async () => {
  logger.info("Shutting down worker");
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
