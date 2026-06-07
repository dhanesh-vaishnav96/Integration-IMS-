/**
 * models/InterviewAsset.js
 *
 * Mongoose schema for recording and transcript assets tied to an interview.
 *
 * Design Decisions:
 * - `candidate_id` is DENORMALIZED here intentionally. This is the critical
 *   mapping rule from the spec: meeting_id → interview_id → candidate_id.
 *   Denormalizing means we can directly query assets by candidate without a join.
 * - `processing_logs[]`: An append-only log array for tracing every state
 *   transition (e.g., PENDING → PROCESSING → UPLOADED or FAILED). Critical
 *   for debugging failed SQS jobs.
 * - S3 keys are stored separately from URLs. Keys are stable; URLs can be
 *   regenerated as presigned URLs anytime. Never hardcode presigned URLs in DB.
 */
const mongoose = require('mongoose');
const { ASSET_STATUS } = require('../constants');

const processingLogSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false } // No auto-generated _id for sub-documents
);

const interviewAssetSchema = new mongoose.Schema(
  {
    // ─── Core Relationships ───────────────────────────────────────
    interview_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: [true, 'Interview ID is required'],
      unique: true, // One asset record per interview
    },
    // Denormalized — avoids join queries on the hot asset lookup path
    candidate_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: [true, 'Candidate ID is required'],
      index: true,
    },

    // ─── Recording (stored in S3) ─────────────────────────────────
    // Key: candidateId/interviewId/recording.mp4
    recording_s3_key: {
      type: String,
      trim: true,
    },
    // Full S3 URL (not presigned - only for internal reference)
    recording_s3_url: {
      type: String,
      trim: true,
    },
    recording_status: {
      type: String,
      enum: {
        values: Object.values(ASSET_STATUS),
        message: `Status must be one of: ${Object.values(ASSET_STATUS).join(', ')}`,
      },
      default: ASSET_STATUS.PENDING,
      index: true,
    },

    // ─── Transcript (stored in S3) ────────────────────────────────
    // Key: candidateId/interviewId/transcript.txt
    transcript_s3_key: {
      type: String,
      trim: true,
    },
    transcript_s3_url: {
      type: String,
      trim: true,
    },
    transcript_status: {
      type: String,
      enum: {
        values: Object.values(ASSET_STATUS),
        message: `Status must be one of: ${Object.values(ASSET_STATUS).join(', ')}`,
      },
      default: ASSET_STATUS.PENDING,
      index: true,
    },

    // ─── Processing Logs (append-only audit trail) ────────────────
    processing_logs: {
      type: [processingLogSchema],
      default: [],
    },

    // ─── Soft Delete ──────────────────────────────────────────────
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Compound Indexes ──────────────────────────────────────────────────────
// Candidate assets dashboard: "show all recordings for candidate X"
interviewAssetSchema.index(
  { candidate_id: 1, createdAt: -1 },
  { name: 'candidate_assets_idx' }
);

// Processing queue: "find all assets stuck in PROCESSING state"
interviewAssetSchema.index(
  { recording_status: 1, transcript_status: 1 },
  { name: 'asset_status_idx' }
);

// ─── Instance Methods ──────────────────────────────────────────────────────
// Append a log entry without overwriting history
interviewAssetSchema.methods.addLog = function (status, message) {
  this.processing_logs.push({ status, message, timestamp: new Date() });
  return this.save();
};

interviewAssetSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

const InterviewAsset = mongoose.model('InterviewAsset', interviewAssetSchema);

module.exports = { InterviewAsset };
