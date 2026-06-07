/**
 * repositories/postgres/schedulingRepository.js
 *
 * Calendar-optimized queries for the scheduling module.
 * All queries use the read replica for non-mutating operations.
 */
const { prisma, prismaRead } = require('../../config/prisma');

const WITH_FULL_DETAILS = {
  candidate: {
    select: { id: true, name: true, email: true, job_role: true, phone: true }
  },
  participants: {
    where: { deleted_at: null },
    select: {
      id: true, email: true, name: true, role: true,
      response_status: true, is_required: true,
      timezone_name: true, timezone_offset: true,
    },
  },
  asset: {
    select: {
      recording_s3_key: true, recording_status: true,
      transcript_s3_key: true, transcript_status: true,
    },
  },
};

const normalizeEvent = (i) => {
  if (!i) return null;
  return {
    ...i,
    _id: i.id,
    start_time: i.scheduled_time,
    end_time: i.end_time || new Date(
      new Date(i.scheduled_time).getTime() + (i.duration_minutes || 60) * 60000
    ),
  };
};

const schedulingRepository = {
  /**
   * Find all interviews within a date range (for calendar views).
   * Optimized with partial index on (scheduled_time, deleted_at).
   */
  async findInDateRange({ startDate, endDate, candidateId, status, type, department, limit = 500 }) {
    const where = {
      deleted_at: null,
      scheduled_time: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };
    if (candidateId) where.candidate_id = candidateId;
    if (status)      where.status = status;
    if (type)        where.type = type;
    if (department)  where.department = department;

    const rows = await prismaRead.interview.findMany({
      where,
      orderBy: { scheduled_time: 'asc' },
      take: Number(limit),
      include: WITH_FULL_DETAILS,
    });
    return rows.map(normalizeEvent);
  },

  /**
   * Get analytics counts for the dashboard cards.
   */
  async getAnalytics() {
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd   = new Date(new Date().setHours(23, 59, 59, 999));

    const [todayCount, upcomingCount, completedCount, cancelledCount, totalCount] = await Promise.all([
      prismaRead.interview.count({
        where: { deleted_at: null, scheduled_time: { gte: todayStart, lte: todayEnd } },
      }),
      prismaRead.interview.count({
        where: { deleted_at: null, status: 'SCHEDULED', scheduled_time: { gt: new Date() } },
      }),
      prismaRead.interview.count({
        where: { deleted_at: null, status: 'COMPLETED' },
      }),
      prismaRead.interview.count({
        where: { deleted_at: null, status: 'CANCELLED' },
      }),
      prismaRead.interview.count({ where: { deleted_at: null } }),
    ]);

    return { todayCount, upcomingCount, completedCount, cancelledCount, totalCount };
  },

  /**
   * Conflict check: find overlapping interviews for a candidate.
   */
  async findCandidateConflicts(candidateId, startTime, endTime, excludeId = null) {
    const endOfSlot = new Date(startTime).getTime() + (
      new Date(endTime).getTime() - new Date(startTime).getTime()
    );
    // Assuming max duration is 240 mins (4 hours)
    const maxPastTime = new Date(new Date(startTime).getTime() - 240 * 60000);
    const where = {
      deleted_at: null,
      candidate_id: candidateId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      scheduled_time: { 
        lt: new Date(endTime),
        gt: maxPastTime
      },
    };
    if (excludeId) where.id = { not: excludeId };

    const overlapping = await prismaRead.interview.findMany({
      where,
      select: {
        id: true, scheduled_time: true, duration_minutes: true,
        status: true, candidate: { select: { name: true } },
      },
    });

    // Filter in JS since computed end_time not queryable directly
    const start = new Date(startTime).getTime();
    const end   = new Date(endTime).getTime();
    return overlapping.filter(i => {
      const iStart = new Date(i.scheduled_time).getTime();
      const iEnd   = iStart + (i.duration_minutes || 60) * 60000;
      return iStart < end && iEnd > start;
    });
  },

  /**
   * Conflict check: find overlapping interviews where email is a participant.
   */
  async findParticipantConflicts(emails, startTime, endTime, excludeId = null) {
    if (!emails || !emails.length) return [];

    // Assuming max duration is 240 mins (4 hours)
    const maxPastTime = new Date(new Date(startTime).getTime() - 240 * 60000);
    const where = {
      deleted_at: null,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      scheduled_time: { 
        lt: new Date(endTime),
        gt: maxPastTime
      },
      participants: { some: { email: { in: emails }, deleted_at: null } },
    };
    if (excludeId) where.id = { not: excludeId };

    const overlapping = await prismaRead.interview.findMany({
      where,
      include: { participants: { where: { email: { in: emails }, deleted_at: null } } },
    });

    const start = new Date(startTime).getTime();
    const end   = new Date(endTime).getTime();
    return overlapping.filter(i => {
      const iStart = new Date(i.scheduled_time).getTime();
      const iEnd   = iStart + (i.duration_minutes || 60) * 60000;
      return iStart < end && iEnd > start;
    });
  },

  /**
   * Create interview with participants in a single transaction.
   */
  async createWithParticipants(interviewData, participants = []) {
    return prisma.$transaction(async (tx) => {
      const interview = await tx.interview.create({
        data: {
          candidate_id:         interviewData.candidate_id,
          title:                interviewData.title,
          type:                 interviewData.type || 'TECHNICAL',
          priority:             interviewData.priority || 'MEDIUM',
          round:                interviewData.round || 1,
          department:           interviewData.department,
          instructions:         interviewData.instructions,
          meeting_notes:        interviewData.meeting_notes,
          meeting_category:     interviewData.meeting_category,
          meeting_color:        interviewData.meeting_color,
          is_private:           interviewData.is_private || false,
          free_busy_status:     interviewData.free_busy_status || 'BUSY',
          travel_buffer_minutes: interviewData.travel_buffer_minutes || 0,
          organizer_email:      interviewData.organizer_email,
          interviewer_email:    interviewData.interviewer_email,
          scheduled_time:       new Date(interviewData.scheduled_time),
          duration_minutes:     interviewData.duration_minutes || 60,
          timezone_name:        interviewData.timezone_name || 'UTC',
          timezone_offset:      interviewData.timezone_offset || 0,
          meeting_provider:     interviewData.meeting_provider || 'TEAMS',
          status:               interviewData.status || 'SCHEDULED',
          recurrence_rule:      interviewData.recurrence_rule,
          recurrence_end_date:  interviewData.recurrence_end_date ? new Date(interviewData.recurrence_end_date) : null,
          parent_interview_id:  interviewData.parent_interview_id,
          created_by:           interviewData.created_by,
        },
        include: WITH_FULL_DETAILS,
      });

      if (participants.length) {
        await tx.interviewParticipant.createMany({
          data: participants.map(p => ({
            interview_id:    interview.id,
            email:           p.email,
            name:            p.name || null,
            role:            p.role || 'PANELIST',
            is_required:     p.is_required !== false,
            timezone_name:   p.timezone_name || null,
            timezone_offset: p.timezone_offset || null,
            created_by:      interviewData.created_by,
          })),
        });
      }

      // Re-fetch with participants
      return tx.interview.findUnique({
        where: { id: interview.id },
        include: WITH_FULL_DETAILS,
      });
    }, { timeout: 15000 });
  },

  /**
   * Update interview + optionally replace participants.
   */
  async updateWithParticipants(id, interviewData, participants = null) {
    return prisma.$transaction(async (tx) => {
      const updateData = {};
      const fields = [
        'title','type','priority','round','department','instructions','meeting_notes',
        'meeting_category','meeting_color','is_private','free_busy_status',
        'travel_buffer_minutes','organizer_email','interviewer_email',
        'scheduled_time','duration_minutes','timezone_name','timezone_offset',
        'meeting_provider','status','recurrence_rule','recurrence_end_date',
        'teams_meeting_id','meeting_join_url','graph_event_id','webhook_status',
        'recording_status','transcript_status','updated_by',
      ];
      for (const f of fields) {
        if (interviewData[f] !== undefined) {
          updateData[f] = f === 'scheduled_time' || f === 'recurrence_end_date'
            ? (interviewData[f] ? new Date(interviewData[f]) : null)
            : interviewData[f];
        }
      }
      updateData.updated_at = new Date();

      const interview = await tx.interview.update({
        where: { id },
        data: updateData,
        include: WITH_FULL_DETAILS,
      });

      if (participants !== null) {
        // Soft-delete all existing, then recreate
        await tx.interviewParticipant.updateMany({
          where: { interview_id: id, deleted_at: null },
          data: { deleted_at: new Date() },
        });
        if (participants.length) {
          await tx.interviewParticipant.createMany({
            data: participants.map(p => ({
              interview_id:    id,
              email:           p.email,
              name:            p.name || null,
              role:            p.role || 'PANELIST',
              is_required:     p.is_required !== false,
              timezone_name:   p.timezone_name || null,
              timezone_offset: p.timezone_offset || null,
              created_by:      interviewData.updated_by || 'system',
            })),
          });
        }
      }

      return tx.interview.findUnique({ where: { id }, include: WITH_FULL_DETAILS });
    }, { timeout: 15000 });
  },

  /**
   * Update participant response (accept/tentative/decline).
   */
  async updateParticipantResponse(interviewId, email, response) {
    return prisma.interviewParticipant.updateMany({
      where: { interview_id: interviewId, email, deleted_at: null },
      data: { response_status: response },
    });
  },
};

module.exports = schedulingRepository;
