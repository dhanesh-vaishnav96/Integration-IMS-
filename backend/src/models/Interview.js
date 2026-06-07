/**
 * models/Interview.js
 *
 * Mongoose schema for the Interview domain entity.
 *
 * Design Decisions:
 * - `teams_meeting_id`: Unique sparse index (sparse = only indexed when present,
 *   since early-stage interviews may not have a Teams meeting yet).
 * - `candidate_id`: Foreign key reference to Candidate. Indexed for fast lookups
 *   like "get all interviews for candidate X".
 * - `meeting_provider`: Enum field defaults to 'TEAMS'. Ready for future Zoom/GMeet.
 * - Soft delete + audit fields follow the same pattern as Candidate.
 */
const mongoose = require('mongoose');
const { INTERVIEW_STATUS } = require('../constants');

const MEETING_PROVIDER = Object.freeze({
  TEAMS: 'TEAMS',
  ZOOM: 'ZOOM',
  GOOGLE_MEET: 'GOOGLE_MEET',
  IN_PERSON: 'IN_PERSON',
});

const interviewSchema = new mongoose.Schema(
  {
    // ─── Candidate Relationship ───────────────────────────────────
    candidate_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: [true, 'Candidate ID is required'],
      index: true, // Most queries start with "get interviews for candidate X"
    },

    // ─── Microsoft Teams Fields ───────────────────────────────────
    // Populated in Phase 3 after Teams meeting creation
    teams_meeting_id: {
      type: String,
      trim: true,
      sparse: true, // Only indexed when not null (allows multiple null values)
    },
    meeting_join_url: {
      type: String,
      trim: true,
    },
    meeting_provider: {
      type: String,
      enum: {
        values: Object.values(MEETING_PROVIDER),
        message: `Provider must be one of: ${Object.values(MEETING_PROVIDER).join(', ')}`,
      },
      default: MEETING_PROVIDER.TEAMS,
    },

    // ─── Participants ─────────────────────────────────────────────
    organizer_email: {
      type: String,
      required: [true, 'Organizer email is required'],
      lowercase: true,
      trim: true,
    },
    interviewer_email: {
      type: String,
      lowercase: true,
      trim: true,
    },

    // ─── Schedule ─────────────────────────────────────────────────
    scheduled_time: {
      type: Date,
      required: [true, 'Scheduled time is required'],
      index: true,
    },
    duration_minutes: {
      type: Number,
      default: 60,
      min: [15, 'Minimum duration is 15 minutes'],
      max: [480, 'Maximum duration is 8 hours (480 minutes)'],
    },

    // ─── Status ───────────────────────────────────────────────────
    // SCHEDULED → IN_PROGRESS → COMPLETED / CANCELLED
    status: {
      type: String,
      enum: {
        values: Object.values(INTERVIEW_STATUS),
        message: `Status must be one of: ${Object.values(INTERVIEW_STATUS).join(', ')}`,
      },
      default: INTERVIEW_STATUS.SCHEDULED,
      index: true,
    },

    // ─── Audit Fields ─────────────────────────────────────────────
    createdBy: { type: String, trim: true },
    updatedBy: { type: String, trim: true },

    // ─── Soft Delete ──────────────────────────────────────────────
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Compound Indexes ──────────────────────────────────────────────────────
// Unique meeting ID per provider (sparse allows multiple null teams_meeting_id)
interviewSchema.index(
  { teams_meeting_id: 1 },
  { unique: true, sparse: true, name: 'unique_teams_meeting_id' }
);

// Most common query: "all interviews for a candidate, newest first"
interviewSchema.index(
  { candidate_id: 1, scheduled_time: -1, deletedAt: 1 },
  { name: 'candidate_schedule_idx' }
);

// Webhook mapping lookup index
interviewSchema.index(
  { meeting_join_url: 1 },
  { name: 'meeting_join_url_idx', sparse: true }
);

// Status-based dashboard queries
interviewSchema.index(
  { status: 1, scheduled_time: -1, deletedAt: 1 },
  { name: 'status_schedule_idx' }
);

// ─── Virtuals ──────────────────────────────────────────────────────────────
// Computed field: Is the interview in the past?
interviewSchema.virtual('isPast').get(function () {
  return this.scheduled_time < new Date();
});

// ─── Instance Methods ──────────────────────────────────────────────────────
interviewSchema.methods.softDelete = function (deletedBy) {
  this.deletedAt = new Date();
  this.updatedBy = deletedBy;
  return this.save();
};

interviewSchema.statics.findActive = function (query = {}) {
  return this.find({ ...query, deletedAt: null });
};

const Interview = mongoose.model('Interview', interviewSchema);

module.exports = { Interview, MEETING_PROVIDER };
