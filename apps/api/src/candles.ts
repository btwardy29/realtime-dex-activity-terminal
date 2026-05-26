import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

import { supportedCandleIntervals } from "@rdat/shared";

type CandleRow = {
  pair_address: string;
  interval: (typeof supportedCandleIntervals)[number];
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  timestamp: Date;
};

const candleQuerySchema = z.object({
  pairAddress: z.string().min(1),
  interval: z.enum(supportedCandleIntervals).default("1m"),
  limit: z.coerce.number().int().min(1).max(500).default(120)
});

export async function registerCandleRoutes(app: FastifyInstance, { db }: { db: Pool }) {
  app.get("/api/candles", async (request, reply) => {
    const parsed = candleQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_candle_query",
        details: parsed.error.flatten().fieldErrors
      });
    }

    const { pairAddress, interval, limit } = parsed.data;
    const result = await db.query<CandleRow>(
      `
        SELECT pair_address, interval, open, high, low, close, volume, timestamp
        FROM candles
        WHERE pair_address = $1 AND interval = $2
        ORDER BY timestamp DESC
        LIMIT $3
      `,
      [pairAddress, interval, limit]
    );

    return {
      candles: result.rows.reverse().map((row) => ({
        pairAddress: row.pair_address,
        interval: row.interval,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
        timestamp: row.timestamp.toISOString()
      }))
    };
  });
}
