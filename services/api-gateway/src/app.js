'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

const config = require('./config');
const routeConfig = require('./config/routeConfig');
const proxyAuth = require('./middlewares/proxyAuth');
const { setupSwagger } = require('./swagger');

// ---------------------------------------------------------------------------
// Logger setup — use Winston for structured JSON logging in production,
// console for development
// ---------------------------------------------------------------------------
const winston = require('winston');

const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    config.nodeEnv === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [new winston.transports.Console()],
});

const LOCALHOST_ORIGINS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
]);

const PRIVATE_IP_PATTERNS = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/,
];

const isDevLocalOrigin = (origin) => {
  if (config.nodeEnv !== 'development' || !origin) {
    return false;
  }

  try {
    const { hostname } = new URL(origin);
    return (
      LOCALHOST_ORIGINS.has(hostname) ||
      PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname))
    );
  } catch {
    return false;
  }
};

const allowedOrigins = new Set((config.cors.origins || []).filter(Boolean));

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

// ---------------------------------------------------------------------------
// Trust proxy — required when behind a reverse proxy / load balancer so that
// express-rate-limit and req.ip work correctly.
// ---------------------------------------------------------------------------
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Security headers — Helmet applies a sensible set of HTTP security headers.
// ---------------------------------------------------------------------------
app.use(helmet());

// ---------------------------------------------------------------------------
// CORS — allow requests from the configured frontend origins.
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin) || isDevLocalOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin "${origin}" is not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'X-Organization-Id'],
  })
);

// ---------------------------------------------------------------------------
// Preserve the exact raw body for signed webhook routes before any JSON/body
// parser mutates the payload. Meta signs the original bytes, so the gateway
// must forward them unchanged to downstream services.
// ---------------------------------------------------------------------------
app.use(
  '/api/v1/whatsapp/webhook',
  express.raw({
    type: '*/*',
    limit: '5mb',
  }),
  (req, _res, next) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
    }
    next();
  }
);

// ---------------------------------------------------------------------------
// Body parsers — 50 MB limit to accommodate media uploads proxied through
// the gateway.
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ---------------------------------------------------------------------------
// HTTP request logging via Morgan, piped into Winston.
// ---------------------------------------------------------------------------
const morganFormat = config.nodeEnv === 'production' ? 'combined' : 'dev';
app.use(
  morgan(morganFormat, {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.global.windowMs,
  max: config.rateLimit.global.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

const authLimiter = rateLimit({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
  },
});

/**
 * Returns the appropriate rate-limit middleware for a given tier name.
 * @param {string} tier - 'auth' | 'global'
 * @returns {Function} Express middleware
 */
const getRateLimiter = (tier) => {
  if (tier === 'auth') return authLimiter;
  return globalLimiter;
};

// ---------------------------------------------------------------------------
// Health check — used by Docker, load balancers, and monitoring systems.
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ---------------------------------------------------------------------------
// Swagger API documentation — available at /api-docs
// ---------------------------------------------------------------------------
setupSwagger(app);

// ---------------------------------------------------------------------------
// Proxy route setup
//
// For each route in routeConfig we create an Express middleware chain that:
//   1. Applies the appropriate rate limiter
//   2. Optionally verifies the JWT (proxyAuth) when route.auth = true
//   3. Proxies the request to the internal microservice
// ---------------------------------------------------------------------------

/**
 * Checks whether a request path matches any of the public (no-auth) paths
 * listed for a route.
 *
 * @param {string} requestPath - req.originalUrl (may include query string)
 * @param {string[]} publicPaths - Array of path prefixes that bypass auth
 * @returns {boolean}
 */
const isPublicPath = (requestPath, publicPaths) => {
  if (!publicPaths || publicPaths.length === 0) return false;
  // Strip query string for matching
  const pathOnly = requestPath.split('?')[0];
  return publicPaths.some((pp) => pathOnly === pp || pathOnly.startsWith(pp + '/'));
};

routeConfig.forEach((route) => {
  const target = config.services[route.service];

  if (!target) {
    logger.warn(`No service URL configured for "${route.service}" — skipping route ${route.prefix}`);
    return;
  }

  // Build the middleware chain for this prefix
  const middlewares = [];

  // 1. Rate limiting
  middlewares.push(getRateLimiter(route.rateLimit || 'global'));

  // 2. Authentication — conditionally applied
  if (route.auth) {
    middlewares.push((req, res, next) => {
      // Allow explicitly listed public sub-paths to bypass auth
      if (isPublicPath(req.originalUrl, route.publicPaths)) {
        return next();
      }
      return proxyAuth(req, res, next);
    });
  }

  // 3. Proxy to downstream service
  middlewares.push(
    createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: route.ws || false,
      pathRewrite: (path) => {
        // Rewrite the public prefix to the service's internal route structure.
        // e.g., /api/v1/contacts/123 → /api/v1/contacts/123 (keep as-is so the
        // downstream service sees the same path it expects).  If a service
        // expects a stripped prefix you can adjust here.
        return path;
      },
      // Forward the raw body for webhook signature verification (WhatsApp etc.)
      onProxyReq: (proxyReq, req) => {
        // If the request body was already parsed by express.json(), we need to
        // re-serialize it so the downstream service receives the body correctly.
        const method = String(req.method || 'GET').toUpperCase();
        const rawBody = Buffer.isBuffer(req.rawBody)
          ? req.rawBody
          : (Buffer.isBuffer(req.body) ? req.body : null);
        const hasParsedBody = req.body !== undefined && req.body !== null;
        const shouldForwardBody = hasParsedBody && !['GET', 'HEAD'].includes(method);
        const contentType = String(req.headers['content-type'] || '');
        const isMultipart = contentType.includes('multipart/form-data');
        const isJsonLike = contentType.includes('application/json');
        const isUrlEncoded = contentType.includes('application/x-www-form-urlencoded');

        if (!shouldForwardBody || isMultipart) {
          return;
        }

        if (rawBody) {
          if (contentType) {
            proxyReq.setHeader('Content-Type', contentType);
          }
          proxyReq.setHeader('Content-Length', rawBody.length);
          proxyReq.write(rawBody);
          return;
        }

        let bodyData;

        if (isJsonLike) {
          bodyData = JSON.stringify(req.body);
        } else if (isUrlEncoded) {
          bodyData = new URLSearchParams(req.body).toString();
        } else {
          return;
        }

        proxyReq.setHeader('Content-Type', contentType);
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      },
      onError: (err, req, res) => {
        logger.error(`Proxy error for ${route.prefix} → ${target}: ${err.message}`);
        if (typeof res?.status === 'function' && !res.headersSent) {
          res.status(502).json({
            success: false,
            message: `Service "${route.service}" is unavailable. Please try again later.`,
          });
          return;
        }

        if (typeof res?.end === 'function') {
          try {
            res.end();
          } catch {
            // Ignore socket close errors on websocket proxy failures.
          }
        }
      },
      logLevel: config.nodeEnv === 'production' ? 'warn' : 'debug',
      logProvider: () => logger,
    })
  );

  app.use(route.prefix, ...middlewares);
  logger.info(`Route registered: ${route.prefix} → ${target} (auth: ${route.auth})`);
});

// ---------------------------------------------------------------------------
// 404 handler — any request that did not match a proxy route
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'The requested resource was not found on this gateway.',
  });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational !== undefined ? err.isOperational : false;

  // Log the full error in development; only the message in production for
  // operational errors.
  if (!isOperational || config.nodeEnv !== 'production') {
    logger.error({
      message: err.message,
      statusCode,
      stack: err.stack,
      isOperational,
    });
  }

  res.status(statusCode).json({
    success: false,
    message: isOperational ? err.message : 'Internal server error',
    ...(err.errors && err.errors.length > 0 ? { errors: err.errors } : {}),
  });
});

module.exports = app;
