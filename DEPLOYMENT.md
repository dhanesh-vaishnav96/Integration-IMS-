# Deployment & Operations Guide

## 🚀 1. Production Docker Compose
The system is orchestrated via Docker Compose.
It includes:
- **Backend Node.js API** (Express, MongoDB driver, AWS SDK)
- **Frontend React App** (Served statically via Nginx on port 80)

To deploy:
```bash
docker-compose up -d --build
```

## 🔧 2. Environment Variables
Ensure the following variables are securely set in your production `.env` (or via AWS Parameter Store / Secrets Manager):

```env
# Database
MONGO_URI=mongodb+srv://...

# AWS (IAM User should have S3 Put/Get and SQS Send/Receive permissions)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
S3_BUCKET_NAME=prod-interview-assets
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123/webhook-queue.fifo

# Microsoft Graph
TENANT_ID=xxx
CLIENT_ID=xxx
CLIENT_SECRET=xxx
AUTH_MODE=application
WEBHOOK_NOTIFICATION_URL=https://api.yourdomain.com/api/v1/webhooks/teams
```

## 📊 3. Observability
- **Prometheus Metrics**: Available at `GET /metrics`. Scrape this endpoint via Prometheus to build Grafana dashboards.
- **Structured Logs**: The app uses `winston`. In production, logs are printed as JSON for easy ingestion into Datadog, ELK, or CloudWatch.
- **Worker Health**: Monitor SQS `ApproximateAgeOfOldestMessage` in AWS CloudWatch to ensure the webhook processing workers are keeping up.

## 🧪 4. Testing
Run tests locally via:
```bash
cd backend
npm run test
```

## ⚠️ 5. Known Limitations & Scaling Strategy
- **Graph Webhook Max Delivery**: Graph requires webhook responses in <10s. The current Node.js async architecture with SQS handles this easily, but if Graph sends massive batches, consider increasing the number of ECS/EC2 instances running the backend.
- **Rate Limiting**: Graph API throttles heavily. The `processingService` uses `p-retry` with exponential backoff to handle 429 Too Many Requests safely.
