import type { Pool } from "pg";

import type { TradeEvent } from "@rdat/types";

export async function ensureIngestionSchema(db: Pool) {
  await db.query(`
    ALTER TABLE trades
      ADD COLUMN IF NOT EXISTS log_index INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS chain_id INTEGER NOT NULL DEFAULT 84532,
      ADD COLUMN IF NOT EXISTS protocol TEXT NOT NULL DEFAULT 'unknown'
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS trades_tx_hash_log_index_idx
    ON trades (tx_hash, log_index)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS trades_block_number_idx
    ON trades (block_number DESC)
  `);
}

export async function insertTrade(db: Pool, trade: Omit<TradeEvent, "id">) {
  const result = await db.query<{ id: string }>(
    `
      INSERT INTO trades (
        tx_hash,
        log_index,
        chain_id,
        protocol,
        pair_address,
        token_in,
        token_out,
        amount_in,
        amount_out,
        usd_value,
        wallet_address,
        block_number,
        timestamp
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (tx_hash, log_index) DO NOTHING
      RETURNING id
    `,
    [
      trade.txHash,
      trade.logIndex,
      trade.chainId,
      trade.protocol,
      trade.pairAddress,
      trade.tokenIn,
      trade.tokenOut,
      trade.amountIn,
      trade.amountOut,
      trade.usdValue,
      trade.walletAddress,
      trade.blockNumber,
      trade.timestamp
    ]
  );

  const inserted = result.rows[0];
  return inserted ? { ...trade, id: inserted.id } satisfies TradeEvent : null;
}
