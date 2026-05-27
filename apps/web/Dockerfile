FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter @rdat/web...

COPY apps/web apps/web
COPY packages/shared packages/shared
COPY packages/types packages/types
COPY packages/ui packages/ui
RUN pnpm --filter @rdat/web build

EXPOSE 3000
CMD ["pnpm", "--filter", "@rdat/web", "start"]
