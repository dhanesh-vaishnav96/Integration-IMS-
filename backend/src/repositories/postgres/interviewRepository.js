/**
 * src/repositories/postgres/interviewRepository.js
 *
 * Prisma implementation of the interview repository.
 * Preserves the exact interface from the Mongoose version.
 *
 * Key additions vs Mongoose version:
 *   - findByMeetingKey(): indexed exact-match replacing regex findByJoinUrl()
 *   - updateTeamsMeetingData(): now also stores normalized_meeting_key
 *   - Read replica used for all non-mutating queries
 */
const { prisma, prismaRead } = require('../../config/prisma');
const { extractMeetingKey } = require('../../utils/meetingKeyExtractor');

// ─── Include Config (replaces Mongoose .populate()) ──────────────────────────
const WITH_CANDIDATE = {
  candidate: { select: { id: true, name: true, email: true, job_role: true, phone: true } },
};

// ─── Shape Normalizer ─────────────────────────────────────────────────────────
const normalizeInterview = (i) => {
  if (!i) return null;
  return {
    ...i,
    _id: i.id,
    candidate_id: i.candidate
      ? { ...i.candidate, _id: i.candidate.id }
      : i.candidate_id,
  };
};

// ─── Where Builder ────────────────────────────────────────────────────────────
const buildWhere = (filters = {}) => {
  const where = { deleted_at: null };
  if (filters.status)       where.status       = filters.status;
  if (filters.candidate_id) where.candidate_id = filters.candidate_id;
  return where;
};

const interviewRepository = {
  async create(data) {
    const normalizedKey = data.meeting_join_url
      ? extractMeetingKey(data.meeting_join_url)
      : null;

    return normalizeInterview(
      await prisma.interview.create({
        data: {
          candidate_id:           data.candidate_id,
          organizer_email:        data.organizer_email,
          interviewer_email:      data.interviewer_email,
          scheduled_time:         new Date(data.scheduled_time),
          duration_minutes:       data.duration_minutes ?? 60,
          status:                 data.status ?? 'SCHEDULED',
          meeting_provider:       data.meeting_provider ?? 'TEAMS',
          meeting_join_url:       data.meeting_join_url,
          normalized_meeting_key: normalizedKey,
          created_by:             data.createdBy,
          legacy_mongo_id:        data.legacy_mongo_id,
        },
        include: WITH_CANDIDATE,
      })
    );
  },

  async findAll({ page = 1, limit = 10, sortBy = 'scheduled_time', sortOrder = 'desc', ...filters } = {}) {
    const where = buildWhere(filters);
    const skip  = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prismaRead.interview.findMany({
        where,
        skip,
        take:    Number(limit),
        orderBy: { [sortBy]: sortOrder },
        include: WITH_CANDIDATE,
      }),
      prismaRead.interview.count({ where }),
    ]);

    return {
      data: rows.map(normalizeInterview),
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findById(id) {
    const isUUID = /^[0-9a-f-]{36}$/i.test(id);
    return normalizeInterview(
      await prismaRead.interview.findFirst({
        where: isUUID
          ? { id, deleted_at: null }
          : { legacy_mongo_id: id, deleted_at: null },
        include: WITH_CANDIDATE,
      })
    );
  },

  async findByTeamsMeetingId(teamsMeetingId) {
    return normalizeInterview(
      await prismaRead.interview.findFirst({
        where: { teams_meeting_id: teamsMeetingId, deleted_at: null },
        include: WITH_CANDIDATE,
      })
    );
  },

  async findByCandidateId(candidateId) {
    const rows = await prismaRead.interview.findMany({
      where:   { candidate_id: candidateId, deleted_at: null },
      orderBy: { scheduled_time: 'desc' },
    });
    return rows.map(normalizeInterview);
  },

  /**
   * Primary mapping method for the webhook pipeline.
   * Uses the normalized_meeting_key column — fully indexed, no regex needed.
   */
  async findByMeetingKey(meetingKey) {
    if (!meetingKey) return null;
    return normalizeInterview(
      await prismaRead.interview.findFirst({
        where: { normalized_meeting_key: meetingKey, deleted_at: null },
        include: WITH_CANDIDATE,
      })
    );
  },

  /**
   * Preserved for backward compatibility during dual-DB transition.
   * After full migration, use findByMeetingKey instead.
   */
  async findByJoinUrl(joinUrl) {
    if (!joinUrl) return null;
    const key = extractMeetingKey(joinUrl);
    if (key) return this.findByMeetingKey(key);

    // Fallback: startsWith search (no regex, uses index prefix scan)
    const baseUrl = joinUrl.split('?')[0].replace(/\/$/, '');
    return normalizeInterview(
      await prismaRead.interview.findFirst({
        where: { meeting_join_url: { startsWith: baseUrl }, deleted_at: null },
        include: WITH_CANDIDATE,
      })
    );
  },

  async updateById(id, data) {
    const isUUID = /^[0-9a-f-]{36}$/i.test(id);
    const existing = await prisma.interview.findFirst({
      where: isUUID ? { id, deleted_at: null } : { legacy_mongo_id: id, deleted_at: null },
    });
    if (!existing) return null;

    const normalizedKey = data.meeting_join_url
      ? extractMeetingKey(data.meeting_join_url)
      : undefined;

    return normalizeInterview(
      await prisma.interview.update({
        where: { id: existing.id },
        data: {
          ...data,
          updated_by:             data.updatedBy ?? data.updated_by,
          normalized_meeting_key: normalizedKey ?? existing.normalized_meeting_key,
          updated_at:             new Date(),
        },
        include: WITH_CANDIDATE,
      })
    );
  },

  async softDeleteById(id, deletedBy) {
    const isUUID = /^[0-9a-f-]{36}$/i.test(id);
    const existing = await prisma.interview.findFirst({
      where: isUUID ? { id, deleted_at: null } : { legacy_mongo_id: id, deleted_at: null },
    });
    if (!existing) return null;

    return normalizeInterview(
      await prisma.interview.update({
        where: { id: existing.id },
        data: { deleted_at: new Date(), updated_by: deletedBy },
      })
    );
  },

  async teamsMeetingIdExists(teamsMeetingId, excludeId = null) {
    const where = { teams_meeting_id: teamsMeetingId, deleted_at: null };
    if (excludeId) where.id = { not: excludeId };
    return (await prisma.interview.count({ where })) > 0;
  },

  async updateTeamsMeetingData(interviewId, teamsData) {
    const normalizedKey = teamsData.meeting_join_url
      ? extractMeetingKey(teamsData.meeting_join_url)
      : undefined;

    const isUUID = /^[0-9a-f-]{36}$/i.test(interviewId);
    const existing = await prisma.interview.findFirst({
      where: isUUID
        ? { id: interviewId, deleted_at: null }
        : { legacy_mongo_id: interviewId, deleted_at: null },
    });
    if (!existing) return null;

    return normalizeInterview(
      await prisma.interview.update({
        where: { id: existing.id },
        data: {
          teams_meeting_id:       teamsData.teams_meeting_id,
          meeting_join_url:       teamsData.meeting_join_url,
          normalized_meeting_key: normalizedKey,
          ...(teamsData.status && { status: teamsData.status }),
          updated_by:             teamsData.updatedBy ?? 'system',
          updated_at:             new Date(),
        },
        include: WITH_CANDIDATE,
      })
    );
  },
};

module.exports = interviewRepository;
