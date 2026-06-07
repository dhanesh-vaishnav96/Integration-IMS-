/**
 * repositories/assetRepository.js
 *
 * Data Access Layer for the InterviewAsset model.
 * Asset records are created by the SQS worker (Phase 3).
 * This repository is used by the dashboard APIs to fetch
 * recording/transcript URLs per candidate.
 */
const { InterviewAsset } = require('../models/InterviewAsset');

const assetRepository = {
  /**
   * Upsert: Creates the asset record if it doesn't exist, or updates it.
   * The worker calls this after uploading to S3.
   */
  async upsertByInterviewId(interviewId, data) {
    return InterviewAsset.findOneAndUpdate(
      { interview_id: interviewId },
      { $set: data },
      { new: true, upsert: true, runValidators: true }
    );
  },

  async findByInterviewId(interviewId) {
    return InterviewAsset.findOne({ interview_id: interviewId, deletedAt: null })
      .populate('interview_id', 'scheduled_time status teams_meeting_id')
      .populate('candidate_id', 'name email job_role');
  },

  /**
   * Fetch all assets for a candidate — used by the candidate dashboard.
   * Returns newest first, with interview details populated.
   */
  async findByCandidateId(candidateId, { page = 1, limit = 10 } = {}) {
    const query = { candidate_id: candidateId, deletedAt: null };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      InterviewAsset.find(query)
        .populate('interview_id', 'scheduled_time status organizer_email duration_minutes')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InterviewAsset.countDocuments(query),
    ]);

    return {
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Find all assets with PENDING or FAILED status — used by retry jobs (Phase 3).
   */
  async findPendingAssets() {
    return InterviewAsset.find({
      $or: [
        { recording_status: { $in: ['PENDING', 'FAILED'] } },
        { transcript_status: { $in: ['PENDING', 'FAILED'] } },
      ],
      deletedAt: null,
    }).populate('interview_id', 'teams_meeting_id candidate_id');
  },

  async appendLog(interviewId, logEntry) {
    return InterviewAsset.findOneAndUpdate(
      { interview_id: interviewId },
      { $push: { processing_logs: { ...logEntry, timestamp: new Date() } } },
      { new: true }
    );
  },
};

module.exports = assetRepository;
