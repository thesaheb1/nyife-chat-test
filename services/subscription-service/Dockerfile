FROM node:20-alpine AS build

WORKDIR /app

COPY shared/ /app/shared/
COPY services/subscription-service/package.json services/subscription-service/package-lock.json* ./

RUN npm ci --production --ignore-scripts 2>/dev/null || npm install --production --ignore-scripts

FROM node:20-alpine

RUN addgroup -S nyife && adduser -S nyife -G nyife

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared /app/shared
COPY services/subscription-service/ ./

RUN chown -R nyife:nyife /app

USER nyife

ENV NODE_ENV=production

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3003/health || exit 1

CMD ["node", "src/server.js"]
