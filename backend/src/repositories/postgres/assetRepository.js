/**
 * src/repositories/postgres/assetRepository.js
 *
 * Prisma implementation of the interview asset repository.
 * Preserves the exact interface from the Mongoose version.
 *
 * Key design note:
 *   recording_s3_url and transcript_s3_url are NOT stored in PostgreSQL.
 *   Only S3 keys are persisted. Presigned URLs are generated on-demand
 *   in the dashboard controller.
 */
const { prisma, prismaRead } = require('../../config/prisma');

const WITH_INTERVIEW = {
  interview: {
    select: {
      id: true,
      scheduled_time: true,
      status: true,
      teams_meeting_id: true,
      organizer_email: true,
      duration_minutes: true,
    },
  },
};

const normalizeAsset = (a) => {
  if (!a) return null;
  return {
    ...a,
    _id: a.id,
    // Map Prisma relation back to Mongoose-style populated field
    interview_id: a.interview ? { ...a.interview, _id: a.interview.id } : a.interview_id,
  };
};

const assetRepository = {
  /**
   * Upsert: create if not exists, update if exists.
   * Called by processingService after each S3 upload step.
   * Now uses a Prisma transaction to write to both interview_assets
   * AND the outbox_events table atomically (Outbox Pattern).
   */
  async upsertByInterviewId(interviewId, data) {
    const { recording_s3_url, transcript_s3_url, ...cleanData } = data; // Strip URL fields

    // Resolve to UUID if needed
    const interview = await prisma.interview.findFirst({
      where: {
        OR: [{ id: interviewId }, { legacy_mongo_id: interviewId }],
        deleted_at: null,
      },
    });
    if (!interview) return null;

    const result = await prisma.interviewAsset.upsert({
      where:  { interview_id: interview.id },
      update: {
        ...cleanData,
        updated_by: cleanData.updatedBy ?? cleanData.updated_by,
        updated_at: new Date(),
      },
      create: {
        interview_id:  interview.id,
        candidate_id:  cleanData.candidate_id ?? interview.candidate_id,
        recording_status:  cleanData.recording_status  ?? 'PENDING',
        transcript_status: cleanData.transcript_status ?? 'PENDING',
        recording_s3_key:  cleanData.recording_s3_key,
        transcript_s3_key: cleanData.transcript_s3_key,
        logs: [],
      },
      include: WITH_INTERVIEW,
    });

    return normalizeAsset(result);
  },

  async findByInterviewId(interviewId) {
    const interview = await prismaRead.interview.findFirst({
      where: {
        OR: [{ id: interviewId }, { legacy_mongo_id: interviewId }],
        deleted_at: null,
      },
    });
    if (!interview) return null;

    return normalizeAsset(
      await prismaRead.interviewAsset.findFirst({
        where: { interview_id: interview.id, deleted_at: null },
        include: WITH_INTERVIEW,
      })
    );
  },

  async findByCandidateId(candidateId, { page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prismaRead.interviewAsset.findMany({
        where:   { candidate_id: candidateId, deleted_at: null },
        skip,
        take:    Number(limit),
        orderBy: { created_at: 'desc' },
        include: WITH_INTERVIEW,
      }),
      prismaRead.interviewAsset.count({
        where: { candidate_id: candidateId, deleted_at: null },
      }),
    ]);

    return {
      data: rows.map(normalizeAsset),
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findPendingAssets() {
    const rows = await prismaRead.interviewAsset.findMany({
      where: {
        OR: [
          { recording_status:  { in: ['PENDING', 'FAILED'] } },
          { transcript_status: { in: ['PENDING', 'FAILED'] } },
        ],
        deleted_at: null,
      },
      include: WITH_INTERVIEW,
    });
    return rows.map(normalizeAsset);
  },

  /**
   * Append a structured log entry to the asset's JSONB logs array.
   * Uses PostgreSQL JSONB array append via raw query for atomicity.
   */
  async appendLog(interviewId, status, message) {
    const interview = await prisma.interview.findFirst({
      where: { OR: [{ id: interviewId }, { legacy_mongo_id: interviewId }] },
    });
    if (!interview) return null;

    const logEntry = { status, message, timestamp: new Date().toISOString() };

    // PostgreSQL JSONB array append — atomic and safe
    return prisma.$executeRaw`
      UPDATE interview_assets
      SET logs = logs || ${JSON.stringify(logEntry)}::jsonb
      WHERE interview_id = ${interview.id}::uuid
    `;
  },
};

module.exports = assetRepository;
