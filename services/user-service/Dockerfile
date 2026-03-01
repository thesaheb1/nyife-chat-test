# -----------------------------------------------------------
# Stage 1 — Install production dependencies
# -----------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Copy shared packages first (they are local deps)
COPY shared/ /app/shared/

# Copy service package files
COPY services/user-service/package.json services/user-service/package-lock.json* ./

# Install production dependencies only
RUN npm ci --production --ignore-scripts 2>/dev/null || npm install --production --ignore-scripts

# -----------------------------------------------------------
# Stage 2 — Production image
# -----------------------------------------------------------
FROM node:20-alpine

# Security: run as non-root user
RUN addgroup -S nyife && adduser -S nyife -G nyife

WORKDIR /app

# Copy installed node_modules from build stage
COPY --from=build /app/node_modules ./node_modules

# Copy shared packages (needed at runtime for local npm links)
COPY --from=build /app/shared /app/shared

# Copy service source code
COPY services/user-service/ ./

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R nyife:nyife /app

USER nyife

# Environment
ENV NODE_ENV=production

# The user-service listens on port 3002
EXPOSE 3002

# Health check — Docker will restart the container if it fails
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1

CMD ["node", "src/server.js"]
