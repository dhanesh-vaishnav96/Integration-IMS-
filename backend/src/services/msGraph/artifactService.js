/**
 * services/msGraph/artifactService.js
 *
 * Fetches meeting recordings and transcripts from Microsoft Graph API.
 *
 * Graph endpoints used:
 *   Recordings:   GET /me/onlineMeetings/{meetingId}/recordings  (delegated)
 *                 GET /users/{userId}/onlineMeetings/{meetingId}/recordings  (application)
 *   Transcripts:  GET /me/onlineMeetings/{meetingId}/transcripts  (delegated)
 *
 * Important Graph Quirks:
 * - Recordings are NOT available immediately after a meeting ends.
 *   Graph typically makes them available within 5-60 minutes.
 * - The recording content URL is retrieved via a two-step process:
 *   1. GET the recordings list → get recording ID
 *   2. GET /recordings/{id}/content → download stream
 * - Transcripts follow the same pattern.
 *
 * Call Records vs Online Meetings:
 * - callRecords webhook fires with a callRecordId (different from onlineMeetingId)
 * - We must look up the callRecord to find the meeting join URL → extract meetingId
 */
const axios = require('axios');
const { getGraphClient } = require('./graphClientFactory');
const tokenManager = require('../token/tokenManager');
const AppError = require('../../utils/AppError');
const logger = require('../../config/logger');
const config = require('../../config/env');
const { HTTP_STATUS } = require('../../constants');

const artifactService = {
  /**
   * getCallRecord()
   *
   * Fetches a call record to get the meeting details (joinUrl, participants).
   * The joinUrl can be used to find the teams_meeting_id in our DB.
   *
   * @param {string} callRecordId - From the webhook notification resource_data.id
   * @param {string|null} userCacheKey
   * @returns {Object} Graph callRecord with sessions and organizer info
   */
  async getCallRecord(callRecordId) {
    logger.info(`[ArtifactService] Fetching call record: ${callRecordId} (Application Auth)`);
    try {
      // Background jobs MUST use application auth
      const client = getGraphClient('application-auth-only'); 
      return await client
        .api(`/communications/callRecords/${callRecordId}`)
        .expand('sessions($expand=segments)')
        .get();
    } catch (err) {
      logger.error(`[ArtifactService] getCallRecord failed: ${err.message}`);
      throw new AppError(`Failed to fetch call record: ${err.message}`, err.statusCode || 500);
    }
  },

  /**
   * getRecordingsList()
   *
   * Lists all recordings for a Teams online meeting.
   *
   * @param {string} meetingId - Graph online meeting ID (teams_meeting_id from Interview)
   * @param {string|null} organizerUserId - Required for application mode
   * @param {string|null} userCacheKey
   * @returns {Array} List of recording objects
   */
  async getRecordingsList(meetingId, organizerUserId) {
    if (!organizerUserId) {
      throw new AppError('organizerUserId is required for Application Auth recording retrieval', HTTP_STATUS.BAD_REQUEST);
    }

    const basePath = `/users/${organizerUserId}/onlineMeetings/${meetingId}/recordings`;
    logger.info(`[ArtifactService] Fetching recordings list for meeting: ${meetingId} via ${basePath}`);

    try {
      const client = getGraphClient('application-auth-only');
      const response = await client.api(basePath).get();
      const recordings = response.value || [];
      logger.info(`[ArtifactService] Found ${recordings.length} recording(s) for meeting: ${meetingId}`);
      return recordings;
    } catch (err) {
      if (err.statusCode === 404) {
        logger.warn(`[ArtifactService] No recordings found for meeting ${meetingId} (may still be processing)`);
        return [];
      }
      throw new AppError(`Failed to fetch recordings: ${err.message}`, err.statusCode || 500);
    }
  },

  /**
   * downloadRecordingStream()
   *
   * Downloads the actual recording video as a readable stream.
   * Uses axios for streaming (Graph SDK buffers full response).
   *
   * @param {string} recordingId - Recording ID from getRecordingsList()
   * @param {string} meetingId
   * @param {string|null} organizerUserId
   * @param {string|null} userCacheKey
   * @returns {Stream} Readable stream of the video content
   */
  async downloadRecordingStream(recordingId, meetingId, organizerUserId) {
    if (!organizerUserId) {
      throw new AppError('organizerUserId is required for Application Auth recording streaming', HTTP_STATUS.BAD_REQUEST);
    }
    
    const contentPath = `/users/${organizerUserId}/onlineMeetings/${meetingId}/recordings/${recordingId}/content`;

    const graphUrl = `${config.msGraph.graphApiBaseUrl}${contentPath}`;
    logger.info(`[ArtifactService] Streaming recording content from Graph: ${contentPath}`);

    const accessToken = await tokenManager.getAccessToken('application-auth-only', true); // Force app token

    const response = await axios.get(graphUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'stream',
      timeout: 120000, // 2-minute timeout for large files
    });

    return response.data; // Readable stream
  },

  /**
   * getTranscriptsList()
   *
   * Lists all transcripts for a Teams online meeting.
   *
   * @param {string} meetingId
   * @param {string|null} organizerUserId
   * @param {string|null} userCacheKey
   * @returns {Array} List of transcript objects
   */
  async getTranscriptsList(meetingId, organizerUserId) {
    if (!organizerUserId) {
      throw new AppError('organizerUserId is required for Application Auth transcript retrieval', HTTP_STATUS.BAD_REQUEST);
    }

    const basePath = `/users/${organizerUserId}/onlineMeetings/${meetingId}/transcripts`;
    logger.info(`[ArtifactService] Fetching transcripts list for meeting: ${meetingId} via ${basePath}`);

    try {
      const client = getGraphClient('application-auth-only');
      const response = await client.api(basePath).get();
      const transcripts = response.value || [];
      logger.info(`[ArtifactService] Found ${transcripts.length} transcript(s)`);
      return transcripts;
    } catch (err) {
      if (err.statusCode === 404) {
        logger.warn(`[ArtifactService] No transcripts found for meeting ${meetingId}`);
        return [];
      }
      throw new AppError(`Failed to fetch transcripts: ${err.message}`, err.statusCode || 500);
    }
  },

  /**
   * downloadTranscriptContent()
   *
   * Downloads transcript as VTT or plain text.
   * Returns the content as a Buffer.
   *
   * @param {string} transcriptId
   * @param {string} meetingId
   * @param {string|null} organizerUserId
   * @param {string|null} userCacheKey
   * @returns {string} Transcript text content
   */
  async downloadTranscriptContent(transcriptId, meetingId, organizerUserId) {
    if (!organizerUserId) {
      throw new AppError('organizerUserId is required for Application Auth transcript download', HTTP_STATUS.BAD_REQUEST);
    }

    const contentPath = `/users/${organizerUserId}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content?$format=text/vtt`;
    
    const graphUrl = `${config.msGraph.graphApiBaseUrl}${contentPath}`;
    logger.info(`[ArtifactService] Downloading transcript content: ${transcriptId}`);

    const accessToken = await tokenManager.getAccessToken('application-auth-only', true); // Force app token

    const response = await axios.get(graphUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'text',
      timeout: 30000,
    });

    return response.data;
  },
};

module.exports = artifactService;
