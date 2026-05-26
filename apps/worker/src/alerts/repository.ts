import type { Pool } from "pg";

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

export async function ensureWhaleAlertSchema(db: Pool) {
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS whale_alerts_trade_id_idx
    ON whale_alerts (trade_id)
  `);
}

export async function insertWhaleAlert(db: Pool, tradeId: string, threshold: string) {
  const result = await db.query<WhaleAlertRow>(
    `
      WITH inserted AS (
        INSERT INTO whale_alerts (trade_id, threshold)
        VALUES ($1, $2)
        ON CONFLICT (trade_id) DO NOTHING
        RETURNING id, trade_id, threshold, created_at
      )
      SELECT
        inserted.id,
        inserted.trade_id,
        inserted.threshold,
        inserted.created_at,
        trades.usd_value,
        trades.pair_address,
        trades.wallet_address,
        trades.tx_hash
      FROM inserted
      JOIN trades ON trades.id = inserted.trade_id
    `,
    [tradeId, threshold]
  );

  const alert = result.rows[0];
  return alert ? mapWhaleAlertRow(alert) : null;
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
