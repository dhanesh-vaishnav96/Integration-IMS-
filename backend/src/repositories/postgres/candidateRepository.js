/**
 * src/repositories/postgres/candidateRepository.js
 *
 * Prisma implementation of the candidate repository.
 * Preserves the exact same interface as the Mongoose version.
 * The service layer is completely unaware of which implementation is active.
 *
 * Key differences from Mongoose version:
 *   - `_id` → `id` (Prisma uses `id` by default)
 *   - `$text` search → pg_trgm ILIKE similarity search
 *   - Skills are a relation (candidate_skills join table)
 *   - `.lean()` is replaced by Prisma's default plain object returns
 */
const { prisma, prismaRead } = require('../../config/prisma');

// ─── Query Builder ────────────────────────────────────────────────────────────
const buildWhere = (filters = {}) => {
  const where = { deleted_at: null };
  if (filters.status) where.status = filters.status;
  if (filters.job_role) where.job_role = { contains: filters.job_role, mode: 'insensitive' };
  // Full-text search using ILIKE on name, email, and job_role
  // pg_trgm GIN indexes make this fast
  if (filters.search) {
    where.OR = [
      { name:     { contains: filters.search, mode: 'insensitive' } },
      { email:    { contains: filters.search, mode: 'insensitive' } },
      { job_role: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  return where;
};

// ─── Shape Normalizer ─────────────────────────────────────────────────────────
// Transforms Prisma output to match Mongoose-shaped objects expected by
// the existing service layer (id instead of _id, skills as string array).
const normalizeCandidate = (c) => {
  if (!c) return null;
  return {
    ...c,
    _id: c.id,
    skills: c.skills?.map((cs) => cs.skill?.name) ?? [],
  };
};

// ─── Skills Upsert Helper ─────────────────────────────────────────────────────
// Finds or creates skill records and links them to a candidate.
const upsertSkills = async (candidateId, skillNames = []) => {
  if (!skillNames.length) return;

  const normalized = [...new Set(skillNames.map((s) => s.toLowerCase().trim()))];

  // Find or create each skill, then link via junction table
  await prisma.$transaction(async (tx) => {
    for (const name of normalized) {
      const skill = await tx.skill.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      await tx.candidateSkill.upsert({
        where: { unique_candidate_skill: { candidate_id: candidateId, skill_id: skill.id } },
        update: {},
        create: { candidate_id: candidateId, skill_id: skill.id },
      });
    }
  }, {
    timeout: 15000 // 15 seconds to allow for slow remote RDS connections
  });
};

// ─── Repository ───────────────────────────────────────────────────────────────
const candidateRepository = {
  async create(data) {
    const { skills = [], ...candidateData } = data;

    const candidate = await prisma.candidate.create({
      data: {
        name:                 candidateData.name,
        email:                candidateData.email?.toLowerCase(),
        phone:                candidateData.phone,
        job_role:             candidateData.job_role,
        years_of_experience:  candidateData.years_of_experience ?? 0,
        resume_url:           candidateData.resume_url,
        status:               candidateData.status ?? 'ACTIVE',
        created_by:           candidateData.createdBy,
        legacy_mongo_id:      candidateData.legacy_mongo_id,
      },
      include: { skills: { include: { skill: true } } },
    });

    if (skills.length) await upsertSkills(candidate.id, skills);

    return normalizeCandidate(
      await prismaRead.candidate.findUnique({
        where: { id: candidate.id },
        include: { skills: { include: { skill: true } } },
      })
    );
  },

  async findAll({ page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'desc', ...filters } = {}) {
    const where = buildWhere(filters);
    const skip  = (page - 1) * limit;

    const orderBy = { [sortBy]: sortOrder };

    const [rows, total] = await Promise.all([
      prismaRead.candidate.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy,
        include: { skills: { include: { skill: true } } },
      }),
      prismaRead.candidate.count({ where }),
    ]);

    return {
      data: rows.map(normalizeCandidate),
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findById(id) {
    // Support both UUID and legacy_mongo_id lookups
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const where = isUUID
      ? { id, deleted_at: null }
      : { legacy_mongo_id: id, deleted_at: null };

    return normalizeCandidate(
      await prismaRead.candidate.findFirst({
        where,
        include: { skills: { include: { skill: true } } },
      })
    );
  },

  async findByEmail(email) {
    return normalizeCandidate(
      await prismaRead.candidate.findFirst({
        where: { email: email.toLowerCase(), deleted_at: null },
        include: { skills: { include: { skill: true } } },
      })
    );
  },

  async updateById(id, data) {
    const { skills, ...rest } = data;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const existing = await prisma.candidate.findFirst({
      where: isUUID ? { id, deleted_at: null } : { legacy_mongo_id: id, deleted_at: null },
    });
    if (!existing) return null;

    const updated = await prisma.candidate.update({
      where: { id: existing.id },
      data: {
        ...rest,
        email:      rest.email?.toLowerCase(),
        updated_by: rest.updatedBy ?? rest.updated_by,
        updated_at: new Date(),
      },
      include: { skills: { include: { skill: true } } },
    });

    if (skills?.length) {
      // Replace skills: delete all existing links then re-insert
      await prisma.candidateSkill.deleteMany({ where: { candidate_id: existing.id } });
      await upsertSkills(existing.id, skills);
    }

    return normalizeCandidate(
      await prisma.candidate.findUnique({
        where: { id: existing.id },
        include: { skills: { include: { skill: true } } },
      })
    );
  },

  async softDeleteById(id, deletedBy) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const existing = await prisma.candidate.findFirst({
      where: isUUID ? { id, deleted_at: null } : { legacy_mongo_id: id, deleted_at: null },
    });
    if (!existing) return null;

    return normalizeCandidate(
      await prisma.candidate.update({
        where: { id: existing.id },
        data: { deleted_at: new Date(), updated_by: deletedBy },
      })
    );
  },

  async emailExists(email, excludeId = null) {
    const where = { email: email.toLowerCase(), deleted_at: null };
    if (excludeId) where.id = { not: excludeId };
    return (await prisma.candidate.count({ where })) > 0;
  },
};

module.exports = candidateRepository;
