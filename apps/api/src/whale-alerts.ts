import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";

import { redisChannels } from "@rdat/shared";
import type { WhaleAlert } from "@rdat/types";

type WhaleAlertRow = {
  id: string;
  trade_id: string;
  threshold: string;
  usd_value: string;
  pair_address: string;
  wallet_address: string;
  tx_hash: string;
  created_at: Date;
};

const whaleAlertQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

export async function registerWhaleAlertRoutes(app: FastifyInstance, { db, redis }: { db: Pool; redis: Redis }) {
  app.get("/api/whale-alerts", async (request, reply) => {
    const parsed = whaleAlertQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_whale_alert_query",
        details: parsed.error.flatten().fieldErrors
      });
    }

    const result = await db.query<WhaleAlertRow>(
      `
        SELECT
          whale_alerts.id,
          whale_alerts.trade_id,
          whale_alerts.threshold,
          whale_alerts.created_at,
          trades.usd_value,
          trades.pair_address,
          trades.wallet_address,
          trades.tx_hash
        FROM whale_alerts
        JOIN trades ON trades.id = whale_alerts.trade_id
        ORDER BY whale_alerts.created_at DESC
        LIMIT $1
      `,
      [parsed.data.limit]
    );

    return {
      alerts: result.rows.map(mapWhaleAlertRow)
    };
  });

  app.get("/api/whale-alerts/stream", async (request, reply) => {
    const subscriber = redis.duplicate({
      maxRetriesPerRequest: null
    });
    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 25_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      void subscriber.quit();
    };

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    reply.raw.write(": connected\n\n");

    request.raw.on("close", cleanup);
    subscriber.on("message", (_channel, message) => {
      reply.raw.write(`event: whale_alert\ndata: ${message}\n\n`);
    });
    subscriber.on("error", (error) => {
      app.log.warn({ error }, "Whale alert SSE subscriber error");
      reply.raw.write(
        `event: system\ndata: ${JSON.stringify({
          type: "system",
          payload: {
            event: "whale_alert_stream_error"
          }
        })}\n\n`
      );
    });

    try {
      await subscriber.subscribe(redisChannels.whaleAlerts);
    } catch (error) {
      app.log.warn({ error }, "Failed to subscribe whale alert SSE stream");
      cleanup();
      reply.raw.end();
    }
  });
}

function mapWhaleAlertRow(row: WhaleAlertRow): WhaleAlert {
  return {
    id: row.id,
    tradeId: row.trade_id,
    threshold: row.threshold,
    usdValue: row.usd_value,
    pairAddress: row.pair_address,
    walletAddress: row.wallet_address,
    txHash: row.tx_hash,
    createdAt: row.created_at.toISOString()
  };
}
