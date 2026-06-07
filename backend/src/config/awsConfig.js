/**
 * config/awsConfig.js
 *
 * Centralized AWS SDK v3 client configuration.
 * Both S3 and SQS clients are initialized here as singletons.
 */
const { S3Client } = require('@aws-sdk/client-s3');
const { SQSClient } = require('@aws-sdk/client-sqs');
const config = require('./env');
const logger = require('./logger');

const awsClientConfig = {
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
};

let _s3Client = null;
let _sqsClient = null;

const getS3Client = () => {
  if (!_s3Client) {
    _s3Client = new S3Client(awsClientConfig);
    logger.debug('[AWSConfig] S3 client initialized');
  }
  return _s3Client;
};

const getSQSClient = () => {
  if (!_sqsClient) {
    _sqsClient = new SQSClient(awsClientConfig);
    logger.debug('[AWSConfig] SQS client initialized');
  }
  return _sqsClient;
};

module.exports = { getS3Client, getSQSClient };
