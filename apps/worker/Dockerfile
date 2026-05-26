FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --no-frozen-lockfile --filter @rdat/worker...

COPY apps/worker apps/worker
COPY packages/shared packages/shared
COPY packages/types packages/types

CMD ["pnpm", "--filter", "@rdat/worker", "start"]
