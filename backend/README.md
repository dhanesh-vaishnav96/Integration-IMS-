# Interview Management System — Backend

A production-ready **MERN Stack** backend for automating Microsoft Teams interview recording and transcript processing.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken) |
| Cloud | AWS S3, AWS SQS (SDK v3) |
| MS Integration | Microsoft Graph API + MSAL Node |
| Logging | Winston |
| Validation | Joi |

---

## Project Structure

```
backend/
├── src/
│   ├── config/              # All config and startup modules
│   │   ├── db.js            # MongoDB connection
│   │   ├── env.js           # Centralized environment config
│   │   ├── logger.js        # Structured Winston logger
│   │   └── configValidator.js # Startup env var validation
│   ├── constants/
│   │   └── index.js         # App-wide constants (status enums, S3 paths)
│   ├── controllers/
│   │   └── healthController.js
│   ├── helpers/
│   │   └── responseHelper.js  # Standardized API response format
│   ├── jobs/                # Background SQS workers (Phase 3)
│   ├── middlewares/
│   │   ├── authMiddleware.js   # JWT verification
│   │   ├── errorMiddleware.js  # Centralized error handler
│   │   ├── rateLimiter.js      # express-rate-limit config
│   │   ├── requestIdMiddleware.js # UUID per request (tracing)
│   │   └── validateRequest.js  # Joi validation factory
│   ├── models/              # Mongoose schemas (Phase 2)
│   ├── routes/
│   │   ├── v1/
│   │   │   └── index.js     # All /api/v1 routes
│   │   ├── healthRoutes.js
│   │   └── index.js         # Mounts versioned routes
│   ├── services/            # Business logic (Phase 2+)
│   ├── utils/
│   │   ├── asyncHandler.js  # Wraps async controllers (no try/catch)
│   │   └── AppError.js      # Custom error class
│   ├── validators/
│   │   └── interviewValidators.js # Joi schemas
│   └── app.js               # Express app setup
├── .env                     # Environment variables (DO NOT COMMIT)
├── .env.example             # Template for .env
├── .gitignore
├── Dockerfile
├── .dockerignore
├── package.json
└── server.js                # Entry point
```

---

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- AWS Account with S3 and SQS configured
- Microsoft Azure AD App Registration

---

## Environment Setup

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

### Required Variables

```env
PORT=5000
NODE_ENV=development

MONGO_URI=mongodb://localhost:27017/interview_management
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=1d

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET_NAME=your-bucket-name
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...

MS_CLIENT_ID=your_azure_client_id
MS_CLIENT_SECRET=your_azure_client_secret
MS_TENANT_ID=your_azure_tenant_id
MS_REDIRECT_URI=http://localhost:5000/api/auth/callback
```

---

## Installation & Running

### Install dependencies
```bash
npm install
```

### Development (with auto-reload)
```bash
npm run dev
```

### Production
```bash
npm start
```

### Docker
```bash
docker build -t interview-backend .
docker run -p 5000:5000 --env-file .env interview-backend
```

---

## API Endpoints (Phase 1)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/health` | System health check | None |

---

## Testing the Health Endpoint

```bash
curl http://localhost:5000/api/v1/health
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "UP",
    "database": { "status": "connected", "name": "interview_management" },
    "uptime": { "seconds": 42, "human": "42s" },
    "environment": "development",
    "version": "1.0.0",
    "timestamp": "2026-06-05T17:00:00.000Z"
  }
}
```

---

## Security Features

- `helmet` — Sets secure HTTP headers
- `hpp` — Prevents HTTP Parameter Pollution attacks
- `compression` — gzip response compression
- `express-rate-limit` — 200 req/10min global; 20 req/15min on auth routes
- JWT authentication on all protected routes
- Config validation at startup (fails immediately if secrets are missing)
- Request ID tracing (`X-Request-Id` header on all responses)
