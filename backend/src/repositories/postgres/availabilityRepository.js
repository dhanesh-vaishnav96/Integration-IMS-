/**
 * repositories/postgres/availabilityRepository.js
 */
const { prisma, prismaRead } = require('../../config/prisma');

const availabilityRepository = {
  async findByEmailsAndRange(emails, startDate, endDate) {
    return prismaRead.userAvailability.findMany({
      where: {
        email: { in: emails },
        deleted_at: null,
        start_time: { lt: new Date(endDate) },
        end_time:   { gt: new Date(startDate) },
      },
      orderBy: { start_time: 'asc' },
    });
  },

  async upsert(email, data) {
    return prisma.userAvailability.create({
      data: {
        email,
        date:              new Date(data.date),
        start_time:        new Date(data.start_time),
        end_time:          new Date(data.end_time),
        availability_type: data.availability_type || 'BUSY',
        source:            data.source || 'MANUAL',
        timezone_name:     data.timezone_name || 'UTC',
        is_recurring:      data.is_recurring || false,
        recurrence_rule:   data.recurrence_rule || null,
        created_by:        data.created_by || 'system',
      },
    });
  },

  async deleteById(id) {
    return prisma.userAvailability.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  },
};

module.exports = availabilityRepository;
