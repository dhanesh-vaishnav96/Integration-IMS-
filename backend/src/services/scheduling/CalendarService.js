/**
 * services/scheduling/CalendarService.js
 *
 * Calendar view computation and event aggregation.
 */
const schedulingRepository = require('../../repositories/postgres/schedulingRepository');
const RecurrenceService     = require('./RecurrenceService');
const { startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } = require('date-fns');

const CalendarService = {
  /**
   * Get events for a calendar view (week/day/month/agenda/timeline).
   */
  async getCalendarView({ view = 'week', date, filters = {}, timezone = 'UTC' }) {
    const anchor = new Date(date || new Date());
    let startDate, endDate;

    switch (view) {
      case 'day':
        startDate = new Date(anchor.setHours(0, 0, 0, 0));
        endDate   = new Date(new Date(startDate).setHours(23, 59, 59, 999));
        break;
      case 'work_week':
        startDate = startOfWeek(anchor, { weekStartsOn: 1 }); // Mon
        endDate   = addDays(startDate, 4);                     // Fri
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = startOfMonth(anchor);
        endDate   = endOfMonth(anchor);
        break;
      case 'agenda':
        startDate = new Date(anchor.setHours(0, 0, 0, 0));
        endDate   = addDays(startDate, 30);
        break;
      case 'timeline':
        startDate = startOfWeek(anchor, { weekStartsOn: 1 });
        endDate   = addDays(startDate, 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
      default:
        startDate = startOfWeek(anchor, { weekStartsOn: 0 }); // Sun
        endDate   = endOfWeek(anchor, { weekStartsOn: 0 });
        endDate.setHours(23, 59, 59, 999);
        break;
    }

    const events = await schedulingRepository.findInDateRange({
      startDate: startDate.toISOString(),
      endDate:   endDate.toISOString(),
      ...filters,
    });

    return {
      view,
      startDate: startDate.toISOString(),
      endDate:   endDate.toISOString(),
      timezone,
      events,
      total: events.length,
    };
  },
};

module.exports = CalendarService;
