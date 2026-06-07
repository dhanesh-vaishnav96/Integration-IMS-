/**
 * src/repositories/postgres/webhookEventRepository.js
 *
 * Prisma implementation of the webhook event repository.
 * Preserves the exact interface from the Mongoose version.
 */
const { prisma, prismaRead } = require('../../config/prisma');

const webhookEventRepository = {
  async existsByChangeId(changeId) {
    return (await prisma.webhookEvent.count({ where: { change_id: changeId } })) > 0;
  },

  async create(data) {
    return prisma.webhookEvent.create({
      data: {
        change_id:       data.change_id,
        subscription_id: data.subscription_id,
        resource:        data.resource,
        change_type:     data.change_type,
        resource_data:   data.resource_data ?? undefined,
        raw_payload:     data.raw_payload ?? undefined,
        status:          data.status ?? 'RECEIVED',
        created_by:      data.created_by,
      },
    });
  },

  async updateStatus(changeId, status, extra = {}) {
    return prisma.webhookEvent.update({
      where: { change_id: changeId },
      data: {
        status,
        error_message: extra.error_message ?? undefined,
        updated_at:    new Date(),
      },
    });
  },

  async findPending(limit = 50) {
    return prismaRead.webhookEvent.findMany({
      where:   { status: 'RECEIVED' },
      orderBy: { created_at: 'asc' },
      take:    limit,
    });
  },

  async findFailed(limit = 20) {
    // Note: retry_count is tracked on the WebhookEvent model in the outbox pattern.
    // For now we return FAILED events — retry logic is in the outbox poller.
    return prismaRead.webhookEvent.findMany({
      where:   { status: 'FAILED' },
      orderBy: { created_at: 'asc' },
      take:    limit,
    });
  },

  async incrementRetry(changeId) {
    // Retry tracking is now done via OutboxEvent. This is a no-op stub
    // for interface compatibility during the dual-DB migration window.
    return prismaRead.webhookEvent.findFirst({ where: { change_id: changeId } });
  },
};

module.exports = webhookEventRepository;
