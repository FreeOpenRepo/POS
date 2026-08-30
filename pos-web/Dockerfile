# 1. Base Stage
FROM node:22-alpine AS base
RUN npm install -g bun

# 2. Dependencies & Build Stage
FROM base AS builder
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY . .
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# 3. Production Runner Stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
