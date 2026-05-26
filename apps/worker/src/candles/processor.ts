import { Worker, type ConnectionOptions } from "bullmq";
import type Redis from "ioredis";
import type { Logger } from "pino";
import type { Pool } from "pg";

import { queueNames } from "@rdat/shared";
import type { CandleAggregationJob } from "@rdat/types";

import { candleIntervals, floorToCandleTimestamp } from "./intervals";
import { publishCandle } from "./publisher";
import { upsertCandleFromTrade } from "./repository";

export function createCandleAggregationWorker({
  db,
  redis,
  connection,
  concurrency,
  logger
}: {
  db: Pool;
  redis: Redis;
  connection: ConnectionOptions;
  concurrency: number;
  logger: Logger;
}) {
  const worker = new Worker<CandleAggregationJob>(
    queueNames.candleAggregation,
    async (job) => {
      for (const interval of candleIntervals) {
        const bucketTimestamp = floorToCandleTimestamp(job.data.timestamp, interval);
        const candle = await upsertCandleFromTrade(db, job.data, interval, bucketTimestamp);
        await publishCandle(redis, candle);
      }

      logger.debug(
        {
          jobId: job.id,
          tradeId: job.data.tradeId,
          pairAddress: job.data.pairAddress
        },
        "Aggregated trade candles"
      );
    },
    {
      connection,
      concurrency
    }
  );

  worker.on("failed", (job, error) => {
    logger.error(
      {
        jobId: job?.id,
        tradeId: job?.data.tradeId,
        error
      },
      "Candle aggregation job failed"
    );
  });

  return worker;
}
