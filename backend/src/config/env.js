require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/interview_management',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3BucketName: process.env.S3_BUCKET_NAME,
    sqsQueueUrl: process.env.SQS_QUEUE_URL,
  },
  msGraph: {
    clientId:          process.env.AZURE_CLIENT_ID,
    clientSecret:      process.env.AZURE_CLIENT_SECRET,
    tenantId:          process.env.AZURE_TENANT_ID,
    redirectUri:       process.env.AZURE_REDIRECT_URI || 'http://localhost:5000/api/v1/ms/auth/callback',
    scopes:            (process.env.GRAPH_SCOPES || 'User.Read').split(',').map((s) => s.trim()),
    graphApiBaseUrl:   process.env.GRAPH_API_BASE_URL || 'https://graph.microsoft.com/v1.0',
    authMode:          process.env.AUTH_MODE || 'application', // 'delegated' | 'application'
    // Phase 1: Default organizer user ID for application-mode meeting creation.
    // Set to the AAD Object ID (UUID) of the HR organizer account.
    // Used as fallback when organizer_user_id is not passed in the request body.
    organizerUserId:   process.env.GRAPH_ORGANIZER_USER_ID || null,
  },
};

module.exports = config;
