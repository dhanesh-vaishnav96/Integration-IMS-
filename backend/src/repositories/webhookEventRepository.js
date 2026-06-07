/**
 * repositories/webhookEventRepository.js
 */
const { prisma } = require('../config/prisma');

const webhookEventRepository = {
  /** Check if event already exists (idempotency) */
  async existsByChangeId(changeId) {
    const count = await prisma.webhookEvent.count({ where: { change_id: changeId } });
    return count > 0;
  },

  async create(data) {
    return prisma.webhookEvent.create({ data });
  },

  async updateStatus(changeId, status, extra = {}) {
    const updateData = { status, ...extra };
    // Prisma schema does not have 'processed_at', so we skip that map or add it if the schema had it.
    
    return prisma.webhookEvent.update({
      where: { change_id: changeId },
      data: updateData,
    });
  },

  async findPending(limit = 50) {
    return prisma.webhookEvent.findMany({
      where: { status: 'RECEIVED' },
      orderBy: { created_at: 'asc' },
      take: limit,
    });
  },

  async findFailed(limit = 20) {
    return prisma.webhookEvent.findMany({
      where: { status: 'FAILED' }, // No retry_count in Prisma schema currently
      orderBy: { created_at: 'asc' },
      take: limit,
    });
  },

  async incrementRetry(changeId) {
    // Retry count is not explicitly on the WebhookEvent Prisma schema right now
    // We would need a DB migration to add it if strictly required by logic
    return null; 
  },
};

module.exports = webhookEventRepository;
