import type Redis from "ioredis";

import { redisChannels } from "@rdat/shared";
import type { WhaleAlert } from "@rdat/types";

export async function publishWhaleAlert(redis: Redis, alert: WhaleAlert) {
  await redis.publish(
    redisChannels.whaleAlerts,
    JSON.stringify({
      type: "whale_alert",
      payload: alert
    })
  );
}
