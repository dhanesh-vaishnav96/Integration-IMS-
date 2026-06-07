/**
 * app.js (UPDATED - Security, Rate Limiting, Request ID, Compression)
 *
 * Express application configuration.
 *
 * Middleware stack (in order):
 * 1. helmet        - HTTP security headers
 * 2. compression   - gzip compression for responses
 * 3. cors          - Cross-origin resource sharing
 * 4. cookie-parser - Parse cookies
 * 5. hpp           - HTTP Parameter Pollution protection
 * 6. requestId     - Assign UUID to every request
 * 7. morgan        - HTTP access logging (writes to winston)
 * 8. express.json  - Parse JSON request bodies
 * 9. globalLimiter - Rate limiting (200 req/10 min per IP)
 * 10. /api routes  - Versioned API routes
 * 11. notFound     - 404 catcher
 * 12. errorHandler - Centralized error handler
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');

const config = require('./config/env');
const logger = require('./config/logger');
const { errorHandler, notFound } = require('./middlewares/errorMiddleware');
const requestIdMiddleware = require('./middlewares/requestIdMiddleware');
const { globalLimiter } = require('./middlewares/rateLimiter');
const routes = require('./routes/v1');
const { metricsMiddleware, metricsRoute } = require('./config/metrics');

// Initialize express app
const app = express();

// ─── Phase 1: Security & Setup Middlewares ─────────────────────────────────
app.use(metricsMiddleware); // Observability metrics
app.use(helmet());

// ─── Response Compression ──────────────────────────────────────────────────
// Compresses all responses with gzip (skips tiny payloads < 1kb automatically)
app.use(compression());

// ─── CORS ──────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.env === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') || []
      : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    credentials: true,
  })
);

// ─── Cookie Parser ─────────────────────────────────────────────────────────
app.use(cookieParser());

// ─── HTTP Parameter Pollution Protection ───────────────────────────────────
// Prevents attacks like: GET /api?id=1&id=2 (duplicated params)
app.use(hpp());

// ─── HTTP Request Logger ───────────────────────────────────────────────────
app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms :req[x-request-id]', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
    skip: (req) => req.url === '/api/v1/health', // Don't log health checks
  })
);

// ─── Body Parsers ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Global Rate Limiter ───────────────────────────────────────────────────
app.use(requestIdMiddleware);

// ─── Phase 2 & 3: API Routes ───────────────────────────────────────────────
app.use('/', metricsRoute); // Expose /metrics for Prometheus
app.use('/api/v1', routes);

// ─── Root Endpoint for sanity check ────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
