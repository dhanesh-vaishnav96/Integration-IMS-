/**
 * src/config/prisma.js
 *
 * Prisma 7 Client Singleton
 *
 * Prisma 7 uses the "query compiler" engine by default.
 * This REQUIRES the PrismaPg adapter to be passed directly to the
 * PrismaClient constructor — unlike Prisma 5/6 which used a binary engine.
 *
 * Write client → DATABASE_URL (primary RDS)
 * Read client  → DATABASE_READ_URL (read replica, falls back to primary)
 */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const logger = require('./logger');

// ─── URL helpers ──────────────────────────────────────────────────────────────
const cleanUrl = (url) => {
  if (!url) return null;
  return url.replace(/^["']|["']$/g, ''); // Strip surrounding quotes
};

const writeUrl = cleanUrl(process.env.DATABASE_URL);
const readUrl  = cleanUrl(process.env.DATABASE_READ_URL) || writeUrl;

if (!writeUrl) {
  throw new Error('[Prisma] DATABASE_URL is not set. Cannot initialize PrismaClient.');
}

const { Pool } = require('pg');

// ─── Client Factory ───────────────────────────────────────────────────────────
const createClient = (connectionString, label) => {
  // PrismaPg requires a pg Pool instance
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // RDS uses self-signed cert in dev
    max: 25,                            // Increase pool size to handle high concurrent RTT latency
  });
  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'query' },
    ],
  });

  client.$on('error', (e) => logger.error(`[Prisma:${label}:ERROR] ${e.message}`));
  client.$on('warn',  (e) => logger.warn(`[Prisma:${label}:WARN] ${e.message}`));
  client.$on('query', (e) => {
    if (e.duration > 500) {
      logger.warn(`[Prisma:${label}:SLOW ${e.duration}ms] ${e.query}`);
    }
  });

  return client;
};

// ─── Singletons (hot-reload safe) ─────────────────────────────────────────────
let prisma;
let prismaRead;

if (process.env.NODE_ENV === 'production') {
  prisma     = createClient(writeUrl, 'WRITE');
  prismaRead = writeUrl !== readUrl ? createClient(readUrl, 'READ') : prisma;
} else {
  if (!global.__prismaWrite) global.__prismaWrite = createClient(writeUrl, 'WRITE');
  if (!global.__prismaRead) {
    global.__prismaRead = writeUrl !== readUrl
      ? createClient(readUrl, 'READ')
      : global.__prismaWrite;
  }
  prisma     = global.__prismaWrite;
  prismaRead = global.__prismaRead;
}

// ─── Graceful Disconnect ──────────────────────────────────────────────────────
const disconnectPrisma = async () => {
  try {
    await prisma.$disconnect();
    if (prismaRead !== prisma) await prismaRead.$disconnect();
    logger.info('[Prisma] Disconnected from PostgreSQL.');
  } catch (err) {
    logger.error(`[Prisma] Disconnect error: ${err.message}`);
  }
};

module.exports = { prisma, prismaRead, disconnectPrisma };
