/**
 * services/interviewService.js
 *
 * Business logic for Interview operations.
 * Enforces:
 *  - Candidate must exist before scheduling an interview
 *  - Teams meeting ID uniqueness (if provided)
 *  - Status transition validation (future: SCHEDULED → IN_PROGRESS → COMPLETED)
 */


const AppError = require('../utils/AppError');
const { interviewRepository, candidateRepository } = require('../repositories');
const logger = require('../config/logger');
const { HTTP_STATUS } = require('../constants');

const interviewService = {
  /**
   * Create a new interview record.
   * Business Rule: The referenced candidate must exist and be active.
   */
  async createInterview(data, requestId) {
    const log = logger.child ? logger.child({ request_id: requestId }) : logger;

    // Validate candidate exists
    const candidate = await candidateRepository.findById(data.candidate_id);
    if (!candidate) {
      throw new AppError(
        `Candidate with ID '${data.candidate_id}' not found.`,
        HTTP_STATUS.NOT_FOUND
      );
    }

    // If Teams meeting ID is provided, ensure it's unique
    if (data.teams_meeting_id) {
      const exists = await interviewRepository.teamsMeetingIdExists(data.teams_meeting_id);
      if (exists) {
        throw new AppError(
          `An interview with Teams meeting ID '${data.teams_meeting_id}' already exists.`,
          HTTP_STATUS.CONFLICT
        );
      }
    }

    const interview = await interviewRepository.create(data);
    log.info(`Interview created: ${interview._id} for candidate ${data.candidate_id}`);
    return interview;
  },

  /**
   * List all interviews with pagination and filters.
   */
  async getInterviews(queryParams) {
    return interviewRepository.findAll(queryParams);
  },

  /**
   * Get single interview by ID with candidate details.
   */
  async getInterviewById(id) {
    const interview = await interviewRepository.findById(id);
    if (!interview) {
      throw new AppError('Interview not found.', HTTP_STATUS.NOT_FOUND);
    }
    return interview;
  },

  /**
   * Update interview fields.
   * Prevents updating a cancelled interview.
   */
  async updateInterview(id, data, requestId) {
    const log = logger.child ? logger.child({ request_id: requestId }) : logger;

    const existing = await interviewRepository.findById(id);
    if (!existing) {
      throw new AppError('Interview not found.', HTTP_STATUS.NOT_FOUND);
    }

    if (existing.status === 'CANCELLED') {
      throw new AppError(
        'Cannot update a cancelled interview. Create a new interview instead.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Teams meeting ID uniqueness check on update
    if (data.teams_meeting_id) {
      const exists = await interviewRepository.teamsMeetingIdExists(data.teams_meeting_id, id);
      if (exists) {
        throw new AppError(
          `Teams meeting ID '${data.teams_meeting_id}' is already in use.`,
          HTTP_STATUS.CONFLICT
        );
      }
    }

    const updated = await interviewRepository.updateById(id, data);
    log.info(`Interview updated: ${id}`);
    return updated;
  },

  /**
   * Soft delete an interview.
   */
  async deleteInterview(id, deletedBy, requestId) {
    const log = logger.child ? logger.child({ request_id: requestId }) : logger;

    const existing = await interviewRepository.findById(id);
    if (!existing) {
      throw new AppError('Interview not found.', HTTP_STATUS.NOT_FOUND);
    }

    await interviewRepository.softDeleteById(id, deletedBy);
    log.info(`Interview soft-deleted: ${id} by ${deletedBy || 'system'}`);
  },

  /**
   * Get all interviews for a specific candidate.
   */
  async getInterviewsByCandidate(candidateId) {
    // First verify candidate exists
    const candidate = await candidateRepository.findById(candidateId);
    if (!candidate) {
      throw new AppError('Candidate not found.', HTTP_STATUS.NOT_FOUND);
    }
    return interviewRepository.findByCandidateId(candidateId);
  },
};

module.exports = interviewService;