/**
 * repositories/interviewRepository.js
 *
 * Data Access Layer for the Interview model.
 * All queries enforce { deletedAt: null } for soft-delete support.
 * Supports pagination, filtering by status and candidate_id.
 */
const { Interview } = require('../models/Interview');

const buildQuery = (filters = {}) => {
  const query = { deletedAt: null };
  if (filters.status) query.status = filters.status;
  if (filters.candidate_id) query.candidate_id = filters.candidate_id;
  return query;
};

const interviewRepository = {
  async create(data) {
    return Interview.create(data);
  },

  async findAll({ page = 1, limit = 10, sortBy = 'scheduled_time', sortOrder = 'desc', ...filters } = {}) {
    const query = buildQuery(filters);
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [data, total] = await Promise.all([
      Interview.find(query)
        .populate('candidate_id', 'name email job_role') // Auto-join candidate details
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Interview.countDocuments(query),
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

  async findById(id) {
    return Interview.findOne({ _id: id, deletedAt: null })
      .populate('candidate_id', 'name email job_role phone');
  },

  /**
   * Find by MS Teams meeting_id — used by webhook handler in Phase 3.
   * Critical mapping: meeting_id → interview → candidate
   */
  async findByTeamsMeetingId(teamsMeetingId) {
    return Interview.findOne({ teams_meeting_id: teamsMeetingId, deletedAt: null })
      .populate('candidate_id', 'name email job_role');
  },

  async findByCandidateId(candidateId) {
    return Interview.find({ candidate_id: candidateId, deletedAt: null })
      .sort({ scheduled_time: -1 })
      .lean();
  },

  async updateById(id, data) {
    return Interview.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: data },
      { new: true, runValidators: true }
    ).populate('candidate_id', 'name email job_role');
  },

  async softDeleteById(id, deletedBy) {
    return Interview.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date(), updatedBy: deletedBy } },
      { new: true }
    );
  },

  async teamsMeetingIdExists(teamsMeetingId, excludeId = null) {
    const query = { teams_meeting_id: teamsMeetingId, deletedAt: null };
    if (excludeId) query._id = { $ne: excludeId };
    return (await Interview.countDocuments(query)) > 0;
  },

  /**
   * Save Teams meeting data back to the Interview after Graph API creates the meeting.
   * Called by teamsSchedulingService after successful meeting creation.
   * Sets teams_meeting_id, meeting_join_url, and status.
   *
   * @param {string} interviewId - MongoDB _id of the interview
   * @param {Object} teamsData - { teams_meeting_id, meeting_join_url, status?, updatedBy? }
   * @returns {Object} Updated Interview document
   */
  async updateTeamsMeetingData(interviewId, teamsData) {
    return Interview.findOneAndUpdate(
      { _id: interviewId, deletedAt: null },
      {
        $set: {
          teams_meeting_id: teamsData.teams_meeting_id,
          meeting_join_url: teamsData.meeting_join_url,
          ...(teamsData.status && { status: teamsData.status }),
          updatedBy: teamsData.updatedBy || 'system',
        },
      },
      { new: true, runValidators: true }
    ).populate('candidate_id', 'name email job_role phone');
  },

  /**
   * Find an interview by its Teams meeting join URL.
   * Strips query parameters from the Graph webhook URL to match the DB cleanly.
   */
  async findByJoinUrl(joinUrl) {
    if (!joinUrl) return null;
    
    // Strip query params and trailing slashes to ensure robust matching
    const baseUrl = joinUrl.split('?')[0].replace(/\/$/, '');
    
    // Perform regex match to find any interview whose meeting_join_url starts with the baseUrl
    return Interview.findOne({
      meeting_join_url: { $regex: new RegExp(`^${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) },
      deletedAt: null
    });
  },
};

module.exports = interviewRepository;
