/**
 * config/metrics.js
 *
 * Prometheus metrics setup for Observability (Phase 10).
 * Exposes a /metrics endpoint for Prometheus to scrape.
 * Tracks HTTP requests, queue processing times, and Graph API latency.
 */
const promClient = require('prom-client');
const express = require('express');

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5],
});
register.registerMetric(httpRequestDurationMicroseconds);

const queueJobsProcessed = new promClient.Counter({
  name: 'sqs_jobs_processed_total',
  help: 'Total number of SQS jobs processed',
  labelNames: ['status', 'job_type'], // status: 'success' | 'failed'
});
register.registerMetric(queueJobsProcessed);

const graphApiLatency = new promClient.Histogram({
  name: 'graph_api_latency_seconds',
  help: 'Latency of MS Graph API calls',
  labelNames: ['endpoint', 'status_code'],
});
register.registerMetric(graphApiLatency);

// Middleware to track HTTP requests
const metricsMiddleware = (req, res, next) => {
  if (req.path === '/metrics') return next();
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
  });
  next();
};

const metricsRoute = express.Router();
metricsRoute.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

module.exports = {
  metricsMiddleware,
  metricsRoute,
  queueJobsProcessed,
  graphApiLatency,
};
