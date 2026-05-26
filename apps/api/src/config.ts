import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WS_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(5000).max(120_000).default(30_000),
  WS_MAX_CLIENTS: z.coerce.number().int().positive().max(10_000).default(200),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url()
});

export const config = configSchema.parse(process.env);
