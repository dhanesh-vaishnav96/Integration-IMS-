/**
 * repositories/candidateRepository.js
 *
 * Data Access Layer (DAL) for the Candidate model.
 *
 * Why a Repository Pattern?
 * Controllers → Services → Repositories → Model
 * If we ever switch from MongoDB to PostgreSQL, only this file changes.
 * Services remain untouched.
 *
 * Key Rules:
 * - ALL queries here filter { deletedAt: null } unless explicitly querying deleted records.
 * - Pagination is handled here, not in the service layer.
 * - Search uses MongoDB $text index (set up in the model).
 */
const { Candidate } = require('../models/Candidate');

/**
 * Build a MongoDB query object for candidate listing/search.
 * @param {Object} filters - { status, job_role, search }
 */
const buildQuery = (filters = {}) => {
  const query = { deletedAt: null };

  if (filters.status) query.status = filters.status;
  if (filters.job_role) query.job_role = new RegExp(filters.job_role, 'i');

  // Full-text search uses the text index for name, email, job_role, skills
  if (filters.search) {
    query.$text = { $search: filters.search };
  }

  return query;
};

/**
 * Build sort options. When $text search is active, sort by relevance score.
 */
const buildSort = (filters = {}, sortBy = 'createdAt', sortOrder = 'desc') => {
  if (filters.search) {
    return { score: { $meta: 'textScore' } };
  }
  return { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
};

const candidateRepository = {
  /**
   * Create a new candidate record.
   */
  async create(data) {
    return Candidate.create(data);
  },

  /**
   * Find paginated list of candidates.
   * Returns: { data, total, page, limit, totalPages }
   */
  async findAll({ page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', ...filters } = {}) {
    const query = buildQuery(filters);
    const sort = buildSort(filters, sortBy, sortOrder);
    const skip = (page - 1) * limit;

    const selectFields = filters.search
      ? { score: { $meta: 'textScore' } } // Include relevance score in search results
      : {};

    const [data, total] = await Promise.all([
      Candidate.find(query, selectFields)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(), // `.lean()` returns plain JS objects (faster, no Mongoose overhead)
      Candidate.countDocuments(query),
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
   * Find a single active candidate by MongoDB _id.
   */
  async findById(id) {
    return Candidate.findOne({ _id: id, deletedAt: null });
  },

  /**
   * Find a single active candidate by email.
   */
  async findByEmail(email) {
    return Candidate.findOne({ email: email.toLowerCase(), deletedAt: null });
  },

  /**
   * Update a candidate by ID. Returns the updated document.
   */
  async updateById(id, data) {
    return Candidate.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: data },
      { new: true, runValidators: true } // `new: true` returns updated doc; validators run on update
    );
  },

  /**
   * Soft delete: sets deletedAt to current timestamp instead of destroying the record.
   */
  async softDeleteById(id, deletedBy) {
    return Candidate.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date(), updatedBy: deletedBy } },
      { new: true }
    );
  },

  /**
   * Check if a candidate with given email already exists (for duplicate detection).
   */
  async emailExists(email, excludeId = null) {
    const query = { email: email.toLowerCase(), deletedAt: null };
    if (excludeId) query._id = { $ne: excludeId };
    const count = await Candidate.countDocuments(query);
    return count > 0;
  },
};

module.exports = candidateRepository;
