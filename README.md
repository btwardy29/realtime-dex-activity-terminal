# Realtime DEX Activity Terminal

Production-style realtime Web3 analytics dashboard for Base Sepolia DEX activity.

## Phase 1

This repository currently contains the project foundation:

- pnpm monorepo with `web`, `api`, `worker`, `ui`, `shared`, and `types` workspaces
- Docker Compose for local Postgres and Redis
- start-up schema for the core MVP tables
- health endpoints for the API service
- worker bootstrap that verifies Postgres and Redis connectivity
- configurable Base Sepolia DEX swap ingestion worker
- WebSocket realtime gateway backed by Redis Pub/Sub
- realtime frontend dashboard consuming the gateway stream
- BullMQ candle aggregation for server-side OHLC chart updates

## Local Setup

```bash
pnpm install
cp .env.example .env
docker compose up --build
```

Useful commands:

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
```

## Blockchain Ingestion

Phase 2 adds a worker-side swap ingestion pipeline for selected Base Sepolia pools.

Configure it through `.env`:

```bash
INGESTION_ENABLED=true
BASE_SEPOLIA_RPC_HTTP_URL=https://sepolia.base.org
BASE_SEPOLIA_RPC_WS_URL=
MONITORED_POOLS='[{"address":"0x...","protocol":"uniswap-v2","token0":"0x...","token1":"0x...","token0Decimals":18,"token1Decimals":6}]'
```

Supported pool protocols:

- `uniswap-v2`
- `uniswap-v3`

The worker deduplicates events with Redis, persists normalized trades into PostgreSQL, and publishes live trade messages to the `dex:trades` Redis channel.

## Candle Aggregation

Phase 5 adds a BullMQ candle aggregation pipeline. Every persisted swap is queued on `candle-aggregation`, aggregated into `1m`, `5m`, and `15m` OHLC candles, stored in PostgreSQL, and published to the `dex:candles` Redis channel as `candle_update` events.

Historical candles are available through:

```txt
GET /api/candles?pairAddress=0x...&interval=1m&limit=120
```

## Realtime Gateway

Phase 3 adds a WebSocket gateway at:

```txt
ws://localhost:4000/ws
```

Clients can subscribe to realtime channels:

```json
{
  "type": "subscribe",
  "channels": ["trades", "ticker", "candles", "whaleAlerts", "system"]
}
```

The gateway subscribes to Redis Pub/Sub channels and forwards matching messages to connected clients. It also exposes:

```txt
GET /api/realtime/health
```

## Frontend Dashboard

Phase 4 replaces the starter screen with a realtime terminal dashboard:

- live WebSocket connection state
- activity chart surface
- live trades feed
- trending pairs
- whale alerts
- session market statistics
