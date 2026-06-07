/**
 * services/candidateService.js
 *
 * Business logic for Candidate operations.
 * Controllers call services; services call repositories.
 * This layer is responsible for:
 *  - Business rule enforcement (e.g., duplicate email check)
 *  - Orchestrating multiple repository calls if needed
 *  - Throwing AppError for business violations
 *  - Logging significant operations
 */

const AppError = require('../utils/AppError');
const { candidateRepository } = require('../repositories');
const logger = require('../config/logger');
const { HTTP_STATUS } = require('../constants');

const candidateService = {
  /**
   * Create a new candidate.
   * Business Rule: Email must be globally unique (across non-deleted records).
   */
  async createCandidate(data, requestId) {
    const log = logger.child ? logger.child({ request_id: requestId }) : logger;

    // Duplicate email check
    const emailTaken = await candidateRepository.emailExists(data.email);
    if (emailTaken) {
      throw new AppError(
        `A candidate with email '${data.email}' already exists.`,
        HTTP_STATUS.CONFLICT
      );
    }

    const candidate = await candidateRepository.create(data);
    log.info(`Candidate created: ${candidate._id} (${candidate.email})`);
    return candidate;
  },

  /**
   * List candidates with pagination, filtering, and search.
   */
  async getCandidates(queryParams, requestId) {
    const result = await candidateRepository.findAll(queryParams);
    logger.debug(`Fetched ${result.data.length} candidates (page ${queryParams.page})`);
    return result;
  },

  /**
   * Get single candidate by ID.
   * Throws 404 if not found or soft-deleted.
   */
  async getCandidateById(id, requestId) {
    const candidate = await candidateRepository.findById(id);
    if (!candidate) {
      throw new AppError('Candidate not found.', HTTP_STATUS.NOT_FOUND);
    }
    return candidate;
  },

  /**
   * Update candidate fields.
   * Business Rule: If email is being changed, ensure new email is not taken.
   */
  async updateCandidate(id, data, requestId) {
    const log = logger.child ? logger.child({ request_id: requestId }) : logger;

    // Ensure candidate exists
    const existing = await candidateRepository.findById(id);
    if (!existing) {
      throw new AppError('Candidate not found.', HTTP_STATUS.NOT_FOUND);
    }

    // Email uniqueness check (only if email is being updated)
    if (data.email && data.email !== existing.email) {
      const emailTaken = await candidateRepository.emailExists(data.email, id);
      if (emailTaken) {
        throw new AppError(
          `A candidate with email '${data.email}' already exists.`,
          HTTP_STATUS.CONFLICT
        );
      }
    }

    const updated = await candidateRepository.updateById(id, data);
    log.info(`Candidate updated: ${id}`);
    return updated;
  },

  /**
   * Soft delete a candidate.
   * Throws 404 if not found.
   */
  async deleteCandidate(id, deletedBy, requestId) {
    const log = logger.child ? logger.child({ request_id: requestId }) : logger;

    const existing = await candidateRepository.findById(id);
    if (!existing) {
      throw new AppError('Candidate not found.', HTTP_STATUS.NOT_FOUND);
    }

    await candidateRepository.softDeleteById(id, deletedBy);
    log.info(`Candidate soft-deleted: ${id} by ${deletedBy || 'system'}`);
  },
};

module.exports = candidateService;