/**
 * constants/index.js — UPDATE to add S3_PATHS and ASSET_STATUS.
 * Adds canonical S3 path generators to the existing constants file.
 */

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER: 500,
};

const INTERVIEW_STATUS = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
};

const ASSET_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  UPLOADED: 'UPLOADED',
  FAILED: 'FAILED',
  UNAVAILABLE: 'UNAVAILABLE', // For graceful degradation (e.g., transcript not generated)
};

/**
 * Canonical S3 key generators.
 * Enforces the folder structure: {candidateId}/{interviewId}/artifact
 */
const sanitize = (str) => str.replace(/[^a-zA-Z0-9]/g, '_');

const S3_PATHS = {
  RECORDING: (candidateId, interviewId, candidateName = null, title = null) => {
    const safeName = candidateName ? sanitize(candidateName) : candidateId;
    const safeTitle = title ? sanitize(title) : interviewId;
    return `${safeName}/${safeTitle}/recording.mp4`;
  },
  TRANSCRIPT: (candidateId, interviewId, candidateName = null, title = null) => {
    const safeName = candidateName ? sanitize(candidateName) : candidateId;
    const safeTitle = title ? sanitize(title) : interviewId;
    return `${safeName}/${safeTitle}/transcript.vtt`;
  },
  FOLDER: (candidateId, interviewId, candidateName = null, title = null) => {
    const safeName = candidateName ? sanitize(candidateName) : candidateId;
    const safeTitle = title ? sanitize(title) : interviewId;
    return `${safeName}/${safeTitle}/`;
  },
};

module.exports = {
  HTTP_STATUS,
  INTERVIEW_STATUS,
  ASSET_STATUS,
  S3_PATHS,
};
