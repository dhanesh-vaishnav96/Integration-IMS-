/**
 * jobs/README.md
 * 
 * This directory contains scheduled jobs and background workers.
 *
 * Planned job files:
 * 
 * - sqsConsumer.js         : Polls AWS SQS queue for new interview processing tasks
 * - retryFailedAssets.js   : Cron job to retry FAILED recording/transcript uploads
 * - cleanupExpiredTokens.js: Cron job to clean up expired MS Graph OAuth tokens
 *
 * These will be implemented in Phase 3 (Background Processing / SQS Worker).
 */
