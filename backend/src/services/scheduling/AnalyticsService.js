/**
 * services/scheduling/AnalyticsService.js
 */
const schedulingRepository = require('../../repositories/postgres/schedulingRepository');

const AnalyticsService = {
  async getAnalytics() {
    return schedulingRepository.getAnalytics();
  },
};

module.exports = AnalyticsService;
