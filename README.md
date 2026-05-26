# Realtime DEX Activity Terminal

Production-style realtime Web3 analytics dashboard for Base Sepolia DEX activity.

## Phase 1

This repository currently contains the project foundation:

- pnpm monorepo with `web`, `api`, `worker`, `ui`, `shared`, and `types` workspaces
- Docker Compose for local Postgres and Redis
- start-up schema for the core MVP tables
- health endpoints for the API service
- worker bootstrap that verifies Postgres and Redis connectivity

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
