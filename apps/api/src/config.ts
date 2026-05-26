import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WS_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(5000).max(120_000).default(30_000),
  WS_MAX_CLIENTS: z.coerce.number().int().positive().max(10_000).default(200),
  AUTH_JWT_SECRET: z.string().min(32).default("development-only-secret-change-before-production"),
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(2_592_000).default(604_800),
  AUTH_NONCE_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url()
});

export const config = configSchema.parse(process.env);
