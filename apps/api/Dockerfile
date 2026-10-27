# Imagen de la API. Se construye desde la raíz del monorepo:
#   docker compose --profile completo up -d --build
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/motor-calculo/package.json packages/motor-calculo/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY packages/motor-calculo packages/motor-calculo
COPY apps/api apps/api
RUN pnpm --filter @kromatica/motor-calculo build \
 && cd apps/api && DATABASE_URL=postgresql://x:x@localhost/x pnpm prisma generate && pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
# Aplica migraciones pendientes y arranca
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main.js"]
