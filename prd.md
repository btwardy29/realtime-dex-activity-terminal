# Realtime DEX Activity Terminal

## Product Requirements Document

---

# 1. Overview

## Product Name

Realtime DEX Activity Terminal

## Product Type

Web3 realtime analytics dashboard

## Goal

Build a production-style realtime web3 dashboard that monitors decentralized exchange activity on Base Sepolia and streams live updates to connected users.

The application is designed as a portfolio-grade project demonstrating:

* realtime architecture
* blockchain event ingestion
* websocket/SSE systems
* distributed backend workflows
* Redis pub/sub
* BullMQ workers
* event aggregation
* scalable frontend architecture
* fullstack engineering skills

The system is intentionally optimized to run on a single Hetzner CX23 VPS.

---

# 2. Core Product Vision

The application should feel like a lightweight mix of:

* DexScreener
* Birdeye
* TradingView terminal
* whale activity monitor

The UX should communicate:

* high-frequency data updates
* low latency
* realtime responsiveness
* live market activity

---

# 3. Technical Constraints

## Infrastructure Target

Hetzner CX23

### Resources

* 2 vCPU
* 4 GB RAM
* 40 GB SSD/NVMe

## Architecture Constraints

The system must:

* run on a single VPS
* avoid microservices
* avoid Kafka
* avoid Kubernetes
* minimize memory pressure
* support moderate realtime load

---

# 4. Supported Network

## MVP Chain

Base Sepolia

## Why

* cheap
* active ecosystem
* fast finality
* low RPC costs
* good developer experience

---

# 5. User Types

## Guest User

Can:

* view live market data
* observe swaps
* see whale alerts
* see trending pairs

## Wallet User

Authenticated using SIWE.

Can additionally:

* save watchlists
* save alert preferences
* customize dashboard

---

# 6. Core Features

## 6.1 Live Trades Feed

Realtime stream of DEX swaps.

Each event contains:

* token pair
* amount
* tx hash
* timestamp
* wallet address
* USD estimation

Update frequency:

* near realtime

Transport:

* WebSocket

---

## 6.2 Live Price Ticker

Displays:

* token price
* price delta
* 24h volume
* liquidity estimate

Updated continuously using aggregated swap data.

---

## 6.3 Live Candlestick Charts

Supports:

* 1m
* 5m
* 15m

Candles generated server-side.

Aggregation worker updates:

* open
* high
* low
* close
* volume

---

## 6.4 Whale Alerts

Detects large swaps above configurable thresholds.

Example:

```txt
$25,000 USDC → TOKENX
```

Alerts displayed:

* in dedicated panel
* via SSE stream

---

## 6.5 Trending Pairs

Ranking generated using:

* recent volume
* swap frequency
* unique wallets
* velocity score

Updated periodically.

---

## 6.6 Wallet Authentication

Authentication:

* SIWE

Session:

* JWT session
* secure nonce validation

---

# 7. Realtime Architecture

## Overview

```txt
Blockchain
   ↓
Ingestion Worker
   ↓
Redis Pub/Sub
   ↓
Realtime Gateway
   ↓
Frontend
```

---

# 8. Blockchain Ingestion

## Worker Responsibilities

Worker continuously:

* listens for swap events
* validates event structure
* normalizes data
* deduplicates transactions
* stores aggregated records
* publishes updates to Redis

---

## Event Sources

Primary source:

* DEX swap events

Monitored entities:

* selected pools only

Important:
MVP intentionally limits monitored pools to reduce CPU and RPC load.

---

# 9. Redis Usage

Redis responsibilities:

## Pub/Sub

Realtime message distribution.

## BullMQ

Background jobs:

* candle aggregation
* retry processing
* trending calculation

## Cache

Temporary:

* prices
* recent trades
* leaderboard data

---

# 10. WebSocket Strategy

## WebSocket Responsibilities

Used for:

* live trades
* charts
* price ticker
* dashboard updates

Reason:
High-frequency bidirectional realtime stream.

---

# 11. SSE Strategy

## SSE Responsibilities

Used for:

* whale alerts
* system notifications
* ingestion health events

Reason:
Simple unidirectional event delivery.

---

# 12. Database Design

## Database

PostgreSQL

---

## Core Tables

### users

```sql
id
wallet_address
created_at
```

### watchlists

```sql
id
user_id
pair_address
```

### trades

```sql
id
tx_hash
pair_address
token_in
token_out
amount_in
amount_out
usd_value
wallet_address
block_number
timestamp
```

### candles

```sql
id
pair_address
interval
open
high
low
close
volume
timestamp
```

### whale_alerts

```sql
id
trade_id
threshold
created_at
```

---

# 13. Deduplication Strategy

The ingestion worker must ensure:

* tx hashes are unique
* events are not processed twice

Mechanisms:

* Redis locks
* database unique constraints

---

# 14. BullMQ Jobs

## Jobs

### Candle Aggregation

Generates OHLC candles.

### Trending Calculation

Computes trending pairs.

### Retry Queue

Retries failed ingestion tasks.

### Cleanup Jobs

Removes expired cache data.

---

# 15. API Design

## REST API

### Public

```txt
GET /api/pairs
GET /api/trades
GET /api/trending
GET /api/candles
```

### Authenticated

```txt
POST /api/watchlist
DELETE /api/watchlist/:id
```

---

# 16. WebSocket Events

## Incoming Events

```json
{
  "type": "trade",
  "payload": {}
}
```

```json
{
  "type": "ticker_update",
  "payload": {}
}
```

```json
{
  "type": "candle_update",
  "payload": {}
}
```

---

# 17. Frontend Requirements

## Stack

* Next.js
* TypeScript
* Tailwind
* shadcn/ui
* Zustand or Redux Toolkit
* wagmi
* viem

---

## UI Layout

```txt
┌ Chart ───────────────┐
├ Live Trades ─────────┤
├ Trending Pairs ──────┤
├ Whale Alerts ────────┤
└ Market Statistics ───┘
```

---

# 18. Performance Requirements

## VPS Constraints

The application must:

* avoid monitoring too many pairs
* aggregate aggressively
* avoid storing excessive raw data
* avoid memory-heavy subscriptions

---

## Optimization Strategy

### Store Aggregated Data

Prefer candles over raw tick history.

### Limit Active Pools

Monitor selected pools only.

### Redis TTL

Use TTL for ephemeral realtime data.

### Batch Database Writes

Reduce database pressure.

---

# 19. Security Requirements

## Authentication

* SIWE nonce validation
* JWT expiration
* secure cookies

## Rate Limiting

Protect:

* auth endpoints
* websocket connections
* public APIs

## Validation

Validate:

* websocket payloads
* query params
* event schema

---

# 20. Observability

## Logging

Structured logging:

* ingestion
* websocket
* worker failures
* RPC failures

## Error Tracking

Basic:

* console + file logging

Optional future:

* Sentry

---

# 21. Deployment

## Infrastructure

Single VPS using Docker Compose.

---

## Containers

```txt
frontend
backend
worker
postgres
redis
nginx
```

---

# 22. Suggested Folder Structure

```txt
apps/
  web/
  api/
  worker/

packages/
  ui/
  shared/
  types/
```

---

# 23. Non-Goals

MVP intentionally excludes:

* real trading
* real funds
* custody
* advanced chart engine
* microservices
* Kafka
* multi-region scaling

---

# 24. Stretch Goals

Future upgrades:

* multi-chain support
* mempool monitoring
* portfolio tracking
* mobile responsive dashboard
* push notifications
* AI anomaly detection
* advanced liquidity analytics

---

# 25. Recruiter Talking Points

This project demonstrates:

## Frontend

* realtime rendering
* websocket state management
* performance optimization
* dashboard architecture

## Backend

* event-driven architecture
* workers
* Redis pub/sub
* queue systems
* aggregation pipelines

## Web3

* blockchain indexing
* wallet auth
* RPC integration
* event ingestion

## Infrastructure

* Docker
* PostgreSQL
* Redis
* VPS deployment
* scaling awareness

---

# 26. MVP Success Criteria

The MVP is considered successful if:

* realtime swaps stream correctly
* charts update live
* whale alerts work
* users can authenticate
* dashboard remains responsive on CX23
* websocket latency remains low
* ingestion system handles reconnects/retries

---

# 27. Recommended Development Order

## Phase 1

* project setup
* Docker
* PostgreSQL
* Redis

## Phase 2

* blockchain ingestion worker

## Phase 3

* websocket realtime gateway

## Phase 4

* frontend dashboard

## Phase 5

* chart aggregation

## Phase 6

* whale alerts

## Phase 7

* auth + watchlists

## Phase 8

* optimization + deployment

---
