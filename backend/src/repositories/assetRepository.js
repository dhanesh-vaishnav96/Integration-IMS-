/**
 * repositories/assetRepository.js
 *
 * Data Access Layer for the InterviewAsset model using Prisma.
 * Asset records are created by the Queue worker (Phase 3).
 * This repository is used by the dashboard APIs to fetch
 * recording/transcript URLs per candidate.
 */
const { prisma } = require('../config/prisma');

const assetRepository = {
  /**
   * Upsert: Creates the asset record if it doesn't exist, or updates it.
   */
  async upsertByInterviewId(interviewId, data) {
    // Convert Mongoose $set syntax if inadvertently passed
    const cleanData = data.$set || data;

    return prisma.interviewAsset.upsert({
      where: { interview_id: interviewId },
      update: cleanData,
      create: {
        interview_id: interviewId,
        candidate_id: cleanData.candidate_id, // ensure required fields are passed when creating
        ...cleanData
      }
    });
  },

  async findByInterviewId(interviewId) {
    return prisma.interviewAsset.findUnique({
      where: { interview_id: interviewId },
      include: {
        interview: {
          select: {
            scheduled_time: true,
            status: true,
            teams_meeting_id: true,
          }
        }
      }
    });
  },

  /**
   * Fetch all assets for a candidate — used by the candidate dashboard.
   * Returns newest first, with interview details populated.
   */
  async findByCandidateId(candidateId, { page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.interviewAsset.findMany({
        where: { candidate_id: candidateId, deleted_at: null },
        include: {
          interview: {
            select: {
              scheduled_time: true,
              status: true,
              organizer_email: true,
              duration_minutes: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.interviewAsset.count({
        where: { candidate_id: candidateId, deleted_at: null }
      }),
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
    return prisma.interviewAsset.findMany({
      where: {
        OR: [
          { recording_status: { in: ['PENDING', 'FAILED'] } },
          { transcript_status: { in: ['PENDING', 'FAILED'] } },
        ],
        deleted_at: null,
      },
      include: {
        interview: {
          select: {
            teams_meeting_id: true,
            candidate_id: true
          }
        }
      }
    });
  },

  async appendLog(interviewId, logEntry) {
    // Prisma doesn't have a simple $push for JSON arrays, so we must fetch and update
    const asset = await prisma.interviewAsset.findUnique({
      where: { interview_id: interviewId },
      select: { logs: true }
    });

    if (!asset) return null;

    const logsArray = Array.isArray(asset.logs) ? asset.logs : [];
    logsArray.push({ ...logEntry, timestamp: new Date().toISOString() });

    return prisma.interviewAsset.update({
      where: { interview_id: interviewId },
      data: { logs: logsArray }
    });
  },
};

module.exports = assetRepository;
