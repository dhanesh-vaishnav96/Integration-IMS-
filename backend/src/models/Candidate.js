/**
 * models/Candidate.js
 *
 * Mongoose schema for the Candidate domain entity.
 *
 * Design Decisions:
 * - Soft Delete: Records are never hard-deleted. `deletedAt` field marks deletion.
 *   All queries MUST filter `{ deletedAt: null }` (enforced in repository layer).
 * - Audit Fields: `createdBy` and `updatedBy` store the user ID or email of the
 *   actor who made the change — critical for HR audit trails.
 * - Indexes: Compound and single indexes for email (unique), name (text search),
 *   skills (text search), job_role (text search), and status.
 * - Virtual `id`: Mongoose auto-generates a virtual `id` from `_id` for clean API output.
 */
const mongoose = require('mongoose');

const CANDIDATE_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  HIRED: 'HIRED',
  REJECTED: 'REJECTED',
  ON_HOLD: 'ON_HOLD',
});

const candidateSchema = new mongoose.Schema(
  {
    // ─── Core Fields ──────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Candidate name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
      index: true, // For fast name lookups
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, // Enforced at DB level (unique index)
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[\d\s\-()]{7,20}$/, 'Please enter a valid phone number'],
    },
    job_role: {
      type: String,
      required: [true, 'Job role is required'],
      trim: true,
      maxlength: [100, 'Job role cannot exceed 100 characters'],
    },
    years_of_experience: {
      type: Number,
      min: [0, 'Years of experience cannot be negative'],
      max: [50, 'Years of experience cannot exceed 50'],
      default: 0,
    },

    // ─── Resume / Assets ──────────────────────────────────────────
    resume_url: {
      type: String,
      trim: true,
      // Full S3 URL or presigned URL to the candidate's resume PDF
    },

    // ─── Skills Array ─────────────────────────────────────────────
    skills: {
      type: [String],
      default: [],
      // Each skill is normalized to lowercase in pre-save hook (see below)
    },

    // ─── Status ───────────────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: Object.values(CANDIDATE_STATUS),
        message: `Status must be one of: ${Object.values(CANDIDATE_STATUS).join(', ')}`,
      },
      default: CANDIDATE_STATUS.ACTIVE,
    },

    // ─── Audit Fields ─────────────────────────────────────────────
    createdBy: {
      type: String, // Email or user ID of the admin who created this record
      trim: true,
    },
    updatedBy: {
      type: String,
      trim: true,
    },

    // ─── Soft Delete ──────────────────────────────────────────────
    deletedAt: {
      type: Date,
      default: null, // null = not deleted; Date = soft deleted
      index: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Compound Text Index for Full-Text Search ──────────────────────────────
// Enables: db.candidates.find({ $text: { $search: "React Developer" } })
candidateSchema.index(
  { name: 'text', email: 'text', job_role: 'text', skills: 'text' },
  { name: 'candidate_text_search_idx', weights: { name: 10, job_role: 5, skills: 3, email: 1 } }
);

// Additional single-field indexes for filter queries
candidateSchema.index({ status: 1, deletedAt: 1 }); // Status filter + soft delete
candidateSchema.index({ job_role: 1, deletedAt: 1 }); // Role-based filter

// ─── Pre-Save Hook ─────────────────────────────────────────────────────────
// Normalize skills to lowercase and remove duplicates before saving
candidateSchema.pre('save', function (next) {
  if (this.isModified('skills')) {
    this.skills = [...new Set(this.skills.map((s) => s.toLowerCase().trim()))];
  }
  next();
});

// ─── Instance Method: Soft Delete ──────────────────────────────────────────
candidateSchema.methods.softDelete = function (deletedBy) {
  this.deletedAt = new Date();
  this.updatedBy = deletedBy;
  return this.save();
};

// ─── Static Method: Find Active (not soft-deleted) ─────────────────────────
candidateSchema.statics.findActive = function (query = {}) {
  return this.find({ ...query, deletedAt: null });
};

const Candidate = mongoose.model('Candidate', candidateSchema);

module.exports = { Candidate, CANDIDATE_STATUS };
