import "dotenv/config";
import { getAddress, isAddress } from "viem";
import { z } from "zod";

import type { MonitoredPool } from "@rdat/types";

const boolFromEnv = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}, z.boolean());

const addressSchema = z
  .string()
  .refine(isAddress, "Expected an EVM address")
  .transform((address) => getAddress(address));

const monitoredPoolSchema = z.object({
  address: addressSchema,
  protocol: z.enum(["uniswap-v2", "uniswap-v3"]),
  token0: addressSchema,
  token1: addressSchema,
  token0Symbol: z.string().min(1).optional(),
  token1Symbol: z.string().min(1).optional(),
  token0Decimals: z.number().int().min(0).max(255).optional(),
  token1Decimals: z.number().int().min(0).max(255).optional()
});

const monitoredPoolsSchema = z
  .string()
  .default("[]")
  .transform((value, ctx): MonitoredPool[] => {
    let parsed: unknown;

    try {
      parsed = JSON.parse(value);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "MONITORED_POOLS must be valid JSON"
      });
      return z.NEVER;
    }

    const result = z.array(monitoredPoolSchema).safeParse(parsed);
    if (!result.success) {
      ctx.addIssue({
        code: "custom",
        message: result.error.message
      });
      return z.NEVER;
    }

    return result.data;
  });

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(10).default(2),
  INGESTION_ENABLED: boolFromEnv.default(false),
  BASE_SEPOLIA_RPC_HTTP_URL: z.string().url().default("https://sepolia.base.org"),
  BASE_SEPOLIA_RPC_WS_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
  INGESTION_POLLING_INTERVAL_MS: z.coerce.number().int().min(500).max(60_000).default(2000),
  INGESTION_DEDUP_TTL_SECONDS: z.coerce.number().int().min(60).max(604_800).default(86_400),
  WHALE_ALERT_THRESHOLD_USD: z.coerce.number().positive().default(25_000),
  DATA_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  CLEANUP_INTERVAL_MS: z.coerce.number().int().min(60_000).max(86_400_000).default(3_600_000),
  MONITORED_POOLS: monitoredPoolsSchema
});

export const config = configSchema.parse(process.env);
