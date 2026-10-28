FROM node:24.22.1-alpine3.24 AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
ENV DATABASE_URL=postgresql://tdt:tdt@localhost:5432/tdt?schema=public
RUN npm ci

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated/prisma ./src/generated/prisma
COPY . .
ENV DATABASE_URL=postgresql://tdt:tdt@localhost:5432/tdt?schema=public
RUN npm run build

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
