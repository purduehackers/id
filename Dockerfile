FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules node_modules
COPY . .
RUN bun run build

FROM base AS runtime
COPY --from=build /app/build build
COPY --from=build /app/package.json .
COPY --from=deps /app/node_modules node_modules

ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "build/index.js"]
