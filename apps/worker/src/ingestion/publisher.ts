import type Redis from "ioredis";

import { redisChannels, redisKeyPrefixes } from "@rdat/shared";
import type { TradeEvent } from "@rdat/types";

export async function publishTrade(redis: Redis, trade: TradeEvent) {
  const message = JSON.stringify({
    type: "trade",
    payload: trade
  });

  await redis.publish(redisChannels.trades, message);
  await redis.lpush(redisKeyPrefixes.recentTrades, message);
  await redis.ltrim(redisKeyPrefixes.recentTrades, 0, 199);
  await redis.expire(redisKeyPrefixes.recentTrades, 60 * 60);
}
