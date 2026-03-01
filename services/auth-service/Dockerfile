FROM node:20-alpine AS build

WORKDIR /app

COPY shared/ /app/shared/
COPY services/auth-service/package.json services/auth-service/package-lock.json* ./

RUN npm ci --production --ignore-scripts 2>/dev/null || npm install --production --ignore-scripts

FROM node:20-alpine

RUN addgroup -S nyife && adduser -S nyife -G nyife

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared /app/shared
COPY services/auth-service/ ./

RUN chown -R nyife:nyife /app

USER nyife

ENV NODE_ENV=production

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "src/server.js"]
