import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import Redis from "ioredis";
import pg from "pg";

import { config } from "./config";
import { registerAuthRoutes } from "./auth/routes";
import { registerCandleRoutes } from "./candles";
import { registerHealthRoutes } from "./health";
import { registerRealtimeGateway } from "./realtime/gateway";
import { registerWhaleAlertRoutes } from "./whale-alerts";

const { Pool } = pg;

const logger = {
  level: config.NODE_ENV === "production" ? "info" : "debug"
};

const app = Fastify({ logger });
const db = new Pool({ connectionString: config.DATABASE_URL, max: 5 });
const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
});
const redisSubscriber = redis.duplicate({
  maxRetriesPerRequest: null
});

await app.register(cors, {
  origin: true,
  credentials: true
});

await app.register(rateLimit, {
  max: 120,
  timeWindow: "1 minute"
});

await registerHealthRoutes(app, { db, redis });
await registerAuthRoutes(app, { db, redis });
await registerCandleRoutes(app, { db });
await registerWhaleAlertRoutes(app, { db, redis });
await registerRealtimeGateway(app, {
  redisSubscriber,
  heartbeatIntervalMs: config.WS_HEARTBEAT_INTERVAL_MS,
  maxClients: config.WS_MAX_CLIENTS
});

const shutdown = async () => {
  app.log.info("Shutting down API");
  await app.close();
  await redisSubscriber.quit();
  await redis.quit();
  await db.end();
};

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

await app.listen({
  host: config.API_HOST,
  port: config.API_PORT
});
