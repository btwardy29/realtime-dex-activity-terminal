import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import type { Pool } from "pg";

type HealthDependencies = {
  db: Pool;
  redis: Redis;
};

export async function registerHealthRoutes(app: FastifyInstance, deps: HealthDependencies) {
  app.get("/health", async (_request, reply) => {
    const [dbResult, redisResult] = await Promise.allSettled([
      deps.db.query("SELECT 1"),
      deps.redis.ping()
    ]);

    const checks = {
      postgres: dbResult.status === "fulfilled",
      redis: redisResult.status === "fulfilled" && redisResult.value === "PONG"
    };

    const ok = checks.postgres && checks.redis;

    if (!ok) {
      reply.code(503);
    }

    return {
      ok,
      checks,
      timestamp: new Date().toISOString()
    };
  });

  app.get("/ready", async () => ({ ok: true }));
}
