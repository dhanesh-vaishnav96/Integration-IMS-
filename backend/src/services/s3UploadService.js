/**
 * services/s3UploadService.js
 *
 * AWS S3 upload service.
 * Enforces structured folder convention and validates assets.
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

// Configurable limits and TTLs
const PRESIGNED_URL_EXPIRES = parseInt(process.env.S3_PRESIGNED_TTL_SECONDS || '3600', 10);
const MAX_RECORDING_SIZE = parseInt(process.env.MAX_RECORDING_SIZE_BYTES || '1073741824', 10); // 1GB
const MAX_TRANSCRIPT_SIZE = parseInt(process.env.MAX_TRANSCRIPT_SIZE_BYTES || '10485760', 10); // 10MB

const VALID_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/x-matroska'];
const VALID_TEXT_MIMES = ['text/plain', 'text/vtt', 'application/json'];

const s3UploadService = {
  /**
   * uploadStream()
   *
   * Streams data directly to S3 without buffering in memory.
   */
  async uploadStream(body, s3Key, contentType, metadata = {}) {
    const bucket = config.aws.s3BucketName;
    logger.info(`[S3UploadService] Uploading → s3://${bucket}/${s3Key} (${contentType})`);

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
          ServerSideEncryption: 'AES256',
        },
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
   * Validates and uploads a meeting recording.
   */
  async uploadRecording(recordingStream, candidateId, interviewId, mimeType = 'video/mp4', sizeBytes = null) {
    if (!VALID_VIDEO_MIMES.includes(mimeType)) {
      throw new AppError(`Invalid recording mime type: ${mimeType}`, HTTP_STATUS.BAD_REQUEST);
    }
    
    if (sizeBytes && sizeBytes > MAX_RECORDING_SIZE) {
      throw new AppError(`Recording exceeds max size of ${MAX_RECORDING_SIZE} bytes`, HTTP_STATUS.BAD_REQUEST);
    }

    const s3Key = S3_PATHS.RECORDING(candidateId, interviewId);
    return s3UploadService.uploadStream(recordingStream, s3Key, mimeType, {
      'candidate-id': candidateId,
      'interview-id': interviewId,
      'asset-type': 'recording',
    });
  },

  /**
   * uploadTranscript()
   *
   * Validates and uploads transcript text content.
   */
  async uploadTranscript(transcriptContent, candidateId, interviewId, mimeType = 'text/plain; charset=utf-8', sizeBytes = null) {
    const rawMime = mimeType.split(';')[0].trim();
    if (!VALID_TEXT_MIMES.includes(rawMime)) {
      throw new AppError(`Invalid transcript mime type: ${mimeType}`, HTTP_STATUS.BAD_REQUEST);
    }

    const buffer = Buffer.from(typeof transcriptContent === 'string' ? transcriptContent : JSON.stringify(transcriptContent, null, 2));
    const actualSize = sizeBytes || buffer.length;

    if (actualSize > MAX_TRANSCRIPT_SIZE) {
      throw new AppError(`Transcript exceeds max size of ${MAX_TRANSCRIPT_SIZE} bytes`, HTTP_STATUS.BAD_REQUEST);
    }

    const s3Key = S3_PATHS.TRANSCRIPT(candidateId, interviewId);
    return s3UploadService.uploadStream(buffer, s3Key, mimeType, {
      'candidate-id': candidateId,
      'interview-id': interviewId,
      'asset-type': 'transcript',
    });
  },

  /**
   * generatePresignedUrl()
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
