/**
 * src/repositories/postgres/subscriptionRepository.js
 *
 * Prisma implementation of the Graph Subscription repository.
 * Preserves the exact interface from the Mongoose version.
 */
const { prisma, prismaRead } = require('../../config/prisma');

const subscriptionRepository = {
  async create(data) {
    return prisma.graphSubscription.create({
      data: {
        subscription_id:      data.subscription_id,
        expiration_date_time: new Date(data.expiration_datetime ?? data.expiration_date_time),
        client_state:         data.client_state,
        creator_id:           data.creator_id,
        notification_url:     data.notification_url,
        resource:             data.resource,
        change_type:          data.change_type,
        is_active:            true,
        created_by:           data.created_by,
      },
    });
  },

  async findById(subscriptionId) {
    return prismaRead.graphSubscription.findFirst({
      where: { subscription_id: subscriptionId },
    });
  },

  async findAllActive() {
    return prismaRead.graphSubscription.findMany({
      where: { is_active: true },
    });
  },

  async findExpiringSoon(withinMinutes = 30) {
    const cutoff = new Date(Date.now() + withinMinutes * 60 * 1000);
    return prismaRead.graphSubscription.findMany({
      where: {
        is_active:            true,
        expiration_date_time: { lte: cutoff },
      },
    });
  },

  async updateRenewal(subscriptionId, newExpiration) {
    return prisma.graphSubscription.update({
      where: { subscription_id: subscriptionId },
      data: {
        expiration_date_time: new Date(newExpiration),
        renewed_at:           new Date(),
        updated_at:           new Date(),
      },
    });
  },

  async deactivate(subscriptionId) {
    return prisma.graphSubscription.update({
      where: { subscription_id: subscriptionId },
      data: { is_active: false, updated_at: new Date() },
    });
  },
};

module.exports = subscriptionRepository;
