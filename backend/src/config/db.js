/**
 * src/config/db.js
 *
 * Unified Database Connection Manager
 *
 * Replaces the previous Mongoose-only db.js.
 * Connects to the correct database based on DB_PROVIDER env flag.
 * Called once from server.js at startup.
 */
const logger = require('./logger');
const { provider, validateProviderConfig } = require('./databaseProvider');

const connectDB = async () => {
  // Validate environment variables for selected provider first
  validateProviderConfig();

  if (provider === 'postgres') {
    return connectPostgres();
  }

  return connectMongo();
};

// ─── PostgreSQL Connection (Prisma) ───────────────────────────────────────────
const connectPostgres = async () => {
  const { prisma, prismaRead } = require('./prisma');
  try {
    // Run a lightweight query to verify the connection is live
    await prisma.$queryRaw`SELECT 1`;
    logger.info('[DB] ✅ PostgreSQL connected (write client).');

    if (prismaRead !== prisma) {
      await prismaRead.$queryRaw`SELECT 1`;
      logger.info('[DB] ✅ PostgreSQL read replica connected.');
    }
  } catch (err) {
    logger.error(`[DB] ❌ PostgreSQL connection failed: ${err.message}`);
    logger.error('[DB] Check: RDS security group allows your IP on port 5432');
    logger.error('[DB] Check: DATABASE_URL has correct credentials');
    process.exit(1);
  }
};

// ─── MongoDB Connection (Mongoose) ────────────────────────────────────────────
const connectMongo = async () => {
  const mongoose = require('mongoose');
  const config = require('./env');

  try {
    const conn = await mongoose.connect(config.db.uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info(`[DB] ✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    logger.error(`[DB] ❌ MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
