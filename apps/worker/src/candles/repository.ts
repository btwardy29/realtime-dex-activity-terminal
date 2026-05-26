import type { Pool } from "pg";

import type { Candle, CandleAggregationJob, SupportedCandleInterval } from "@rdat/types";

type CandleRow = {
  pair_address: string;
  interval: SupportedCandleInterval;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  timestamp: Date;
};

export async function upsertCandleFromTrade(
  db: Pool,
  job: CandleAggregationJob,
  interval: SupportedCandleInterval,
  bucketTimestamp: string
) {
  const result = await db.query<CandleRow>(
    `
      INSERT INTO candles (
        pair_address,
        interval,
        open,
        high,
        low,
        close,
        volume,
        timestamp
      )
      VALUES ($1, $2, $3, $3, $3, $3, $4, $5)
      ON CONFLICT (pair_address, interval, timestamp)
      DO UPDATE SET
        high = GREATEST(candles.high, EXCLUDED.high),
        low = LEAST(candles.low, EXCLUDED.low),
        close = EXCLUDED.close,
        volume = candles.volume + EXCLUDED.volume
      RETURNING pair_address, interval, open, high, low, close, volume, timestamp
    `,
    [job.pairAddress, interval, job.price, job.volume, bucketTimestamp]
  );

  const candle = result.rows[0];
  if (!candle) {
    throw new Error("Candle upsert did not return a row");
  }

  return mapCandleRow(candle);
}

function mapCandleRow(row: CandleRow): Candle {
  return {
    pairAddress: row.pair_address,
    interval: row.interval,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    timestamp: row.timestamp.toISOString()
  };
}
