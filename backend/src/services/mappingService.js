/**
 * services/mappingService.js
 *
 * The core mapping engine for Phase 7.
 * Resolves the critical mapping chain:
 *   callRecordId → joinWebUrl → teams_meeting_id → interview_id → candidate_id
 *
 * Why is this complex?
 * Microsoft Graph fires "callRecords" webhooks. These contain a callRecordId.
 * A callRecordId is NOT the same as the onlineMeetingId (teams_meeting_id).
 * To bridge the gap, we must:
 *   1. Fetch the call record from Graph.
 *   2. Find the joinWebUrl in the call record.
 *   3. Search our MongoDB Interviews for that joinWebUrl or matching teams_meeting_id.
 *
 * If a mapping is found, we return the candidateId and interviewId so the artifacts
 * can be stored in the correct S3 folder.
 */
const artifactService = require('./msGraph/artifactService');
const { interviewRepository } = require('../repositories');

const logger = require('../config/logger');

const mappingService = {
  /**
   * resolveCallRecord()
   *
   * @param {string} callRecordId - From webhook
   * @param {string|null} userCacheKey
   * @returns {Object|null} { interviewId, candidateId, meetingId } or null if not found
   */
  async resolveCallRecord(callRecordId, userCacheKey = null) {
    logger.info(`[MappingService] Resolving call record: ${callRecordId}`);

    try {
      // 1. Fetch the call record from Graph API
      const callRecord = await artifactService.getCallRecord(callRecordId, userCacheKey);

      if (!callRecord) {
        logger.warn(`[MappingService] Call record ${callRecordId} not found on Graph.`);
        return null;
      }

      // 2. Extract joinWebUrl
      // The joinWebUrl is typically in the call record's joinWebUrl property
      const joinWebUrl = callRecord.joinWebUrl;

      if (!joinWebUrl) {
        logger.warn(`[MappingService] No joinWebUrl found in call record ${callRecordId}. This might be a 1:1 call, not a meeting.`);
        return null;
      }

      logger.debug(`[MappingService] Extracted joinWebUrl: ${joinWebUrl}`);

      // 3. Find the Interview in MongoDB
      // We search by meeting_join_url. In some cases, Teams adds extra query params,
      // so we might need a more robust matching logic in the future, but exact match is a good start.
      // Alternatively, we can extract the meeting ID from the joinUrl.
      
      // We will use a regex to match the core part of the URL if needed, but let's try exact first.
      const interview = await interviewRepository.findByJoinUrl(joinWebUrl);

      if (!interview) {
        logger.warn(`[MappingService] No Interview found matching joinWebUrl: ${joinWebUrl}`);
        return null;
      }

      const candidateId = interview.candidate_id._id || interview.candidate_id;

      logger.info(`[MappingService] ✅ Mapped callRecord ${callRecordId} → Interview ${interview._id} (Candidate: ${candidateId})`);

      return {
        interviewId: interview._id.toString(),
        candidateId: candidateId.toString(),
        meetingId: interview.teams_meeting_id,
        organizerUserId: interview.organizer_email, // Using email as UPN for Graph API
      };

    } catch (err) {
      logger.error(`[MappingService] Resolution failed for ${callRecordId}: ${err.message}`);
      throw err;
    }
  },
};

module.exports = mappingService;