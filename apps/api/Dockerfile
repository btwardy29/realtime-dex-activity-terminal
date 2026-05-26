FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter @rdat/api...

COPY apps/api apps/api
COPY packages/shared packages/shared
COPY packages/types packages/types

EXPOSE 4000
CMD ["pnpm", "--filter", "@rdat/api", "start"]
