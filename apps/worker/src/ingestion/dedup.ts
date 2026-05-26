import type Redis from "ioredis";

import { redisKeyPrefixes } from "@rdat/shared";

type DedupInput = {
  chainId: number;
  txHash: string;
  logIndex: number;
};

export async function acquireEventLock(redis: Redis, input: DedupInput, ttlSeconds: number) {
  const key = [
    redisKeyPrefixes.ingestionDedup,
    input.chainId,
    input.txHash.toLowerCase(),
    input.logIndex
  ].join(":");

  const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");
  return result === "OK";
}
