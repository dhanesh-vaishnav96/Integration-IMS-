/**
 * configValidator.js
 *
 * Validates required environment variables at startup.
 * Provider-aware: validates DB vars based on DB_PROVIDER flag.
 * If any critical variable is missing, the application WILL NOT start.
 */
const logger = require('./logger');

// Always required regardless of DB provider
const ALWAYS_REQUIRED = [
  { key: 'JWT_SECRET',            description: 'JWT signing secret' },
  { key: 'AWS_REGION',            description: 'AWS region' },
  { key: 'AWS_ACCESS_KEY_ID',     description: 'AWS access key ID' },
  { key: 'AWS_SECRET_ACCESS_KEY', description: 'AWS secret access key' },
  { key: 'S3_BUCKET_NAME',        description: 'AWS S3 bucket name' },
  { key: 'SQS_QUEUE_URL',         description: 'AWS SQS queue URL' },
  { key: 'AZURE_CLIENT_ID',       description: 'Microsoft Azure App Client ID' },
  { key: 'AZURE_CLIENT_SECRET',   description: 'Microsoft Azure App Client Secret' },
  { key: 'AZURE_TENANT_ID',       description: 'Microsoft Azure Tenant ID' },
];

// Required when DB_PROVIDER=postgres (or not set, defaults to postgres now)
const POSTGRES_REQUIRED = [
  { key: 'DATABASE_URL', description: 'PostgreSQL primary connection string' },
];

// Required when DB_PROVIDER=mongo (legacy)
const MONGO_REQUIRED = [
  { key: 'MONGO_URI', description: 'MongoDB connection string' },
];

const validateConfig = () => {
  const provider = (process.env.DB_PROVIDER || 'postgres').toLowerCase();
  const missing = [];

  const checkVars = (vars) => {
    vars.forEach(({ key, description }) => {
      if (!process.env[key]) {
        missing.push(`  ✗ ${key} — ${description}`);
      }
    });
  };

  checkVars(ALWAYS_REQUIRED);

  if (provider === 'postgres') {
    checkVars(POSTGRES_REQUIRED);
  } else {
    checkVars(MONGO_REQUIRED);
  }

  if (missing.length > 0) {
    logger.error('=== STARTUP FAILED: Missing required environment variables ===');
    missing.forEach((msg) => logger.error(msg));
    logger.error('Please set these variables in your .env file before starting the server.');
    process.exit(1);
  }

  logger.info(`✓ Config validation passed. Provider: ${provider.toUpperCase()}. All required variables are set.`);
};

module.exports = validateConfig;
