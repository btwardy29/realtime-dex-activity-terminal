CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pair_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pair_address)
);

CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL DEFAULT 0,
  chain_id INTEGER NOT NULL DEFAULT 84532,
  protocol TEXT NOT NULL DEFAULT 'unknown',
  pair_address TEXT NOT NULL,
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  amount_in NUMERIC(78, 18) NOT NULL,
  amount_out NUMERIC(78, 18) NOT NULL,
  usd_value NUMERIC(20, 6),
  wallet_address TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS candles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pair_address TEXT NOT NULL,
  interval TEXT NOT NULL CHECK (interval IN ('1m', '5m', '15m')),
  open NUMERIC(38, 18) NOT NULL,
  high NUMERIC(38, 18) NOT NULL,
  low NUMERIC(38, 18) NOT NULL,
  close NUMERIC(38, 18) NOT NULL,
  volume NUMERIC(38, 18) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pair_address, interval, timestamp)
);

CREATE TABLE IF NOT EXISTS whale_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  threshold NUMERIC(20, 6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trades_pair_timestamp_idx ON trades (pair_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS trades_wallet_timestamp_idx ON trades (wallet_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS trades_block_number_idx ON trades (block_number DESC);
CREATE INDEX IF NOT EXISTS candles_pair_interval_timestamp_idx ON candles (pair_address, interval, timestamp DESC);
CREATE INDEX IF NOT EXISTS whale_alerts_created_at_idx ON whale_alerts (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS whale_alerts_trade_id_idx ON whale_alerts (trade_id);
