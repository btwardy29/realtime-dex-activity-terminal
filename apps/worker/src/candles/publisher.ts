import type Redis from "ioredis";

import { redisChannels } from "@rdat/shared";
import type { Candle } from "@rdat/types";

export async function publishCandle(redis: Redis, candle: Candle) {
  await redis.publish(
    redisChannels.candles,
    JSON.stringify({
      type: "candle_update",
      payload: candle
    })
  );
}
