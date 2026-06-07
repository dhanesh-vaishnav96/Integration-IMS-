/**
 * src/config/databaseProvider.js
 *
 * Database Provider Selector
 *
 * Reads DB_PROVIDER from environment and exports the correct
 * repository factory for the entire application.
 *
 * Supported values:
 *   DB_PROVIDER=mongo     → uses Mongoose repositories (legacy)
 *   DB_PROVIDER=postgres  → uses Prisma repositories (new)
 *
 * This is the ONLY place that switches between providers.
 * All repositories import from here at startup.
 */
const logger = require('./logger');

const provider = (process.env.DB_PROVIDER || 'mongo').toLowerCase().trim();

const VALID_PROVIDERS = ['mongo', 'postgres'];
if (!VALID_PROVIDERS.includes(provider)) {
  throw new Error(
    `Invalid DB_PROVIDER "${provider}". Must be one of: ${VALID_PROVIDERS.join(', ')}`
  );
}

logger.info(`[DatabaseProvider] Active provider: ${provider.toUpperCase()}`);

/**
 * Validates that the required environment variables exist for the selected provider.
 */
const validateProviderConfig = () => {
  if (provider === 'postgres') {
    if (!process.env.DATABASE_URL) {
      throw new Error('[DatabaseProvider] DB_PROVIDER=postgres requires DATABASE_URL to be set.');
    }
    logger.info('[DatabaseProvider] PostgreSQL (Prisma) — write/read split enabled.');
  }

  if (provider === 'mongo') {
    if (!process.env.MONGO_URI) {
      throw new Error('[DatabaseProvider] DB_PROVIDER=mongo requires MONGO_URI to be set.');
    }
    logger.info('[DatabaseProvider] MongoDB (Mongoose) — legacy mode.');
  }
};

module.exports = {
  provider,
  isPostgres: provider === 'postgres',
  isMongo: provider === 'mongo',
  validateProviderConfig,
};
