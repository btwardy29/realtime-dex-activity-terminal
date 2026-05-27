import type Redis from "ioredis";
import type { Logger } from "pino";
import type { Pool } from "pg";

import { redisKeyPrefixes } from "@rdat/shared";

export async function runDataRetention({
  db,
  redis,
  retentionDays,
  logger
}: {
  db: Pool;
  redis: Redis;
  retentionDays: number;
  logger: Logger;
}) {
  const [candleResult, tradeResult] = await Promise.all([
    db.query<{ deleted: string }>(
      `
        WITH deleted AS (
          DELETE FROM candles
          WHERE timestamp < now() - ($1::int * interval '1 day')
          RETURNING id
        )
        SELECT count(*)::text AS deleted FROM deleted
      `,
      [retentionDays]
    ),
    db.query<{ deleted: string }>(
      `
        WITH deleted AS (
          DELETE FROM trades
          WHERE timestamp < now() - ($1::int * interval '1 day')
          RETURNING id
        )
        SELECT count(*)::text AS deleted FROM deleted
      `,
      [retentionDays]
    )
  ]);

  await redis.ltrim(redisKeyPrefixes.recentTrades, 0, 199);
  await redis.expire(redisKeyPrefixes.recentTrades, 60 * 60);

  logger.info(
    {
      retentionDays,
      deletedCandles: Number(candleResult.rows[0]?.deleted ?? 0),
      deletedTrades: Number(tradeResult.rows[0]?.deleted ?? 0)
    },
    "Completed data retention cleanup"
  );
}
