# Build Stage
FROM oven/bun:1.2-alpine AS build
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY . .
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# Runtime Stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["npm", "start"]
