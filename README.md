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
- persisted whale alerts with WebSocket and SSE delivery
- SIWE-style wallet sessions and authenticated watchlists

## Local Setup

```bash
pnpm install
cp .env.example .env
docker compose up --build
```

The public local entrypoint is:

```txt
http://localhost:8080
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

## Whale Alerts

Phase 6 adds persisted whale alert detection for trades with a USD value at or above `WHALE_ALERT_THRESHOLD_USD`:

```bash
WHALE_ALERT_THRESHOLD_USD=25000
```

Detected alerts are stored in PostgreSQL, published to `dex:whale-alerts`, forwarded through the WebSocket `whaleAlerts` channel, and exposed through:

```txt
GET /api/whale-alerts?limit=50
GET /api/whale-alerts/stream
```

## Wallet Auth and Watchlists

Phase 7 adds wallet sessions backed by nonce validation, EVM signature verification, and an HTTP-only session cookie:

```bash
AUTH_JWT_SECRET=development-only-secret-change-before-production
AUTH_SESSION_TTL_SECONDS=604800
AUTH_NONCE_TTL_SECONDS=300
```

Auth and watchlist endpoints:

```txt
POST /api/auth/nonce
POST /api/auth/verify
GET /api/auth/session
POST /api/auth/logout
GET /api/watchlist
POST /api/watchlist
DELETE /api/watchlist/:id
```

## Deployment and Retention

Phase 8 adds an Nginx reverse proxy for a single public entrypoint, bounded Docker log files, Redis memory settings with a BullMQ-safe `noeviction` policy, service healthchecks, and worker-side retention cleanup.

Key deployment settings:

```bash
HTTP_PORT=8080
NEXT_PUBLIC_API_URL=http://localhost:8080
REDIS_MAXMEMORY=256mb
DATA_RETENTION_DAYS=30
CLEANUP_INTERVAL_MS=3600000
```

For a VPS deployment, set `NEXT_PUBLIC_API_URL` to the public origin before building the web image, for example `https://dex.example.com`, then run:

```bash
docker compose up -d --build
```

Nginx routes `/`, `/api/*`, `/ws`, `/health`, and `/ready` to the correct internal services.

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
