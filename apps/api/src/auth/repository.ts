import type { Pool } from "pg";

import type { WatchlistItem } from "@rdat/types";

type UserRow = {
  id: string;
  wallet_address: string;
};

type WatchlistRow = {
  id: string;
  user_id: string;
  pair_address: string;
  created_at: Date;
};

export async function upsertUserByWallet(db: Pool, walletAddress: string) {
  const result = await db.query<UserRow>(
    `
      INSERT INTO users (wallet_address)
      VALUES ($1)
      ON CONFLICT (wallet_address)
      DO UPDATE SET wallet_address = EXCLUDED.wallet_address
      RETURNING id, wallet_address
    `,
    [walletAddress]
  );

  return result.rows[0] ?? null;
}

export async function getWatchlist(db: Pool, userId: string) {
  const result = await db.query<WatchlistRow>(
    `
      SELECT id, user_id, pair_address, created_at
      FROM watchlists
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  return result.rows.map(mapWatchlistRow);
}

export async function addWatchlistItem(db: Pool, userId: string, pairAddress: string) {
  const result = await db.query<WatchlistRow>(
    `
      INSERT INTO watchlists (user_id, pair_address)
      VALUES ($1, $2)
      ON CONFLICT (user_id, pair_address)
      DO UPDATE SET pair_address = EXCLUDED.pair_address
      RETURNING id, user_id, pair_address, created_at
    `,
    [userId, pairAddress]
  );

  return mapWatchlistRow(result.rows[0]);
}

export async function deleteWatchlistItem(db: Pool, userId: string, id: string) {
  const result = await db.query<{ id: string }>(
    `
      DELETE FROM watchlists
      WHERE user_id = $1 AND id = $2
      RETURNING id
    `,
    [userId, id]
  );

  return (result.rowCount ?? 0) > 0;
}

function mapWatchlistRow(row: WatchlistRow | undefined): WatchlistItem {
  if (!row) {
    throw new Error("Watchlist query did not return a row");
  }

  return {
    id: row.id,
    userId: row.user_id,
    pairAddress: row.pair_address,
    createdAt: row.created_at.toISOString()
  };
}
