/**
 * services/s3UploadService.js
 *
 * AWS S3 upload service (Phase 6).
 *
 * Folder structure enforced:
 *   {bucketName}/{candidateId}/{interviewId}/recording.mp4
 *   {bucketName}/{candidateId}/{interviewId}/transcript.txt
 *
 * Upload strategy: stream-to-S3 using @aws-sdk/lib-storage Upload class.
 * This avoids buffering large video files in memory.
 *
 * Presigned URLs:
 *   - Generated on-demand with 1-hour TTL for secure dashboard access.
 *   - Never stored in DB (S3 keys are stored instead).
 */
const { Upload } = require('@aws-sdk/lib-storage');
const { GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getS3Client } = require('../config/awsConfig');
const config = require('../config/env');
const logger = require('../config/logger');
const { S3_PATHS } = require('../constants');
const AppError = require('../utils/AppError');
const { HTTP_STATUS } = require('../constants');

const PRESIGNED_URL_EXPIRES = parseInt(process.env.S3_PRESIGNED_TTL_SECONDS || '3600', 10);

const s3UploadService = {
  /**
   * uploadStream()
   *
   * Streams data directly to S3 without buffering in memory.
   * Used for large video files (recordings).
   *
   * @param {Stream|Buffer|string} body - Data to upload
   * @param {string} s3Key - Full S3 key (path within bucket)
   * @param {string} contentType - MIME type (e.g., 'video/mp4', 'text/plain')
   * @param {Object} [metadata] - Custom metadata key-value pairs
   * @returns {Object} { s3Key, s3Url, etag }
   */
  async uploadStream(body, s3Key, contentType, metadata = {}) {
    const bucket = config.aws.s3BucketName;
    logger.info(`[S3UploadService] Uploading → s3://${bucket}/${s3Key}`);

    try {
      const upload = new Upload({
        client: getS3Client(),
        params: {
          Bucket: bucket,
          Key: s3Key,
          Body: body,
          ContentType: contentType,
          Metadata: {
            'uploaded-by': 'interview-management-system',
            ...metadata,
          },
          // Server-side encryption
          ServerSideEncryption: 'AES256',
        },
        // Multi-part threshold: 5MB parts for large files
        partSize: 5 * 1024 * 1024,
        leavePartsOnError: false,
      });

      upload.on('httpUploadProgress', (progress) => {
        logger.debug(`[S3UploadService] Upload progress: ${JSON.stringify(progress)}`);
      });

      const result = await upload.done();
      const s3Url = `https://${bucket}.s3.${config.aws.region}.amazonaws.com/${s3Key}`;
      logger.info(`[S3UploadService] ✅ Upload complete: ${s3Key}`);

      return { s3Key, s3Url, etag: result.ETag };
    } catch (err) {
      logger.error(`[S3UploadService] Upload failed for ${s3Key}: ${err.message}`);
      throw new AppError(`S3 upload failed: ${err.message}`, HTTP_STATUS.INTERNAL_SERVER);
    }
  },

  /**
   * uploadRecording()
   *
   * Uploads a meeting recording using the standard folder convention.
   *
   * @param {Stream|Buffer} recordingStream - Video data stream
   * @param {string} candidateId
   * @param {string} interviewId
   * @returns {Object} { s3Key, s3Url }
   */
  async uploadRecording(recordingStream, candidateId, interviewId) {
    const s3Key = S3_PATHS.RECORDING(candidateId, interviewId);
    return s3UploadService.uploadStream(recordingStream, s3Key, 'video/mp4', {
      'candidate-id': candidateId,
      'interview-id': interviewId,
      'asset-type': 'recording',
    });
  },

  /**
   * uploadTranscript()
   *
   * Uploads transcript text content.
   *
   * @param {string|Buffer} transcriptContent - Transcript text
   * @param {string} candidateId
   * @param {string} interviewId
   * @returns {Object} { s3Key, s3Url }
   */
  async uploadTranscript(transcriptContent, candidateId, interviewId) {
    const s3Key = S3_PATHS.TRANSCRIPT(candidateId, interviewId);
    return s3UploadService.uploadStream(
      Buffer.from(typeof transcriptContent === 'string' ? transcriptContent : JSON.stringify(transcriptContent, null, 2)),
      s3Key,
      'text/plain; charset=utf-8',
      {
        'candidate-id': candidateId,
        'interview-id': interviewId,
        'asset-type': 'transcript',
      }
    );
  },

  /**
   * generatePresignedUrl()
   *
   * Generates a time-limited presigned GET URL for a private S3 object.
   * Used by dashboard APIs so the browser can stream video/transcript
   * without exposing the S3 bucket directly.
   *
   * @param {string} s3Key - The object key in S3
   * @param {number} [expiresIn] - TTL in seconds (default: 3600)
   * @returns {string} Presigned URL
   */
  async generatePresignedUrl(s3Key, expiresIn = PRESIGNED_URL_EXPIRES) {
    const command = new GetObjectCommand({
      Bucket: config.aws.s3BucketName,
      Key: s3Key,
    });

    const url = await getSignedUrl(getS3Client(), command, { expiresIn });
    logger.debug(`[S3UploadService] Presigned URL generated for: ${s3Key} (TTL: ${expiresIn}s)`);
    return url;
  },

  /**
   * objectExists()
   *
   * Checks if an object exists in S3 without downloading it.
   * Used to verify uploads and prevent re-uploads.
   *
   * @param {string} s3Key
   * @returns {boolean}
   */
  async objectExists(s3Key) {
    try {
      await getS3Client().send(new HeadObjectCommand({
        Bucket: config.aws.s3BucketName,
        Key: s3Key,
      }));
      return true;
    } catch (err) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return false;
      throw err;
    }
  },
};

module.exports = s3UploadService;
