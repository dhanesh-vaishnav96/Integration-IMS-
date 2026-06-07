/**
 * src/repositories/index.js
 *
 * Repository Factory — Dual Provider Router
 *
 * This is the single import point for ALL repositories in the application.
 * Services and controllers import from here, not from specific files.
 *
 * Based on DB_PROVIDER:
 *   mongo    → returns Mongoose repositories (from /mongo/ subfolder implied by original files)
 *   postgres → returns Prisma repositories (from /postgres/ subfolder)
 *
 * Usage in services:
 *   const { candidateRepository } = require('../repositories');
 */
const { isPostgres } = require('../config/databaseProvider');

let candidateRepository;
let interviewRepository;
let assetRepository;
let webhookEventRepository;
let subscriptionRepository;

if (isPostgres) {
  candidateRepository    = require('./postgres/candidateRepository');
  interviewRepository    = require('./postgres/interviewRepository');
  assetRepository        = require('./postgres/assetRepository');
  webhookEventRepository = require('./postgres/webhookEventRepository');
  subscriptionRepository = require('./postgres/subscriptionRepository');
} else {
  // Legacy Mongoose repositories (unchanged files)
  candidateRepository    = require('./candidateRepository');
  interviewRepository    = require('./interviewRepository');
  assetRepository        = require('./assetRepository');
  webhookEventRepository = require('./webhookEventRepository');
  subscriptionRepository = require('./subscriptionRepository');
}

module.exports = {
  candidateRepository,
  interviewRepository,
  assetRepository,
  webhookEventRepository,
  subscriptionRepository,
};
