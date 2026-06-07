/**
 * services/scheduling/AvailabilityService.js
 *
 * Availability aggregation + slot scoring engine.
 */
const availabilityRepository = require('../../repositories/postgres/availabilityRepository');
const logger = require('../../config/logger');

const SLOT_MINUTES = [30, 60, 90, 120];
const WORK_START = 8; // 8am
const WORK_END   = 18; // 6pm

const AvailabilityService = {
  /**
   * Get free/busy slots for a list of emails in a date range.
   */
  async getAvailability(emails, startDate, endDate) {
    const slots = await availabilityRepository.findByEmailsAndRange(emails, startDate, endDate);

    // Group by email
    const result = {};
    for (const email of emails) {
      result[email] = slots
        .filter(s => s.email === email)
        .map(s => ({
          id:    s.id,
          start: s.start_time,
          end:   s.end_time,
          type:  s.availability_type,
          source: s.source,
          timezone: s.timezone_name,
        }));
    }
    return result;
  },

  /**
   * Score and suggest interview slots.
   * Returns top 10 slots with score 1-100.
   *
   * @param {string[]} emails     - participant emails
   * @param {string}   date       - ISO date string
   * @param {number}   duration   - interview duration in minutes
   * @param {string}   priority   - LOW/MEDIUM/HIGH/URGENT
   */
  async suggestSlots(emails, date, duration = 60, priority = 'MEDIUM') {
    const dayStart = new Date(date);
    dayStart.setHours(WORK_START, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(WORK_END, 0, 0, 0);

    const busySlots = await availabilityRepository.findByEmailsAndRange(
      emails,
      dayStart.toISOString(),
      dayEnd.toISOString()
    );

    // Generate candidate slots at 30-min intervals
    const candidates = [];
    let cursor = new Date(dayStart);
    while (cursor.getTime() + duration * 60000 <= dayEnd.getTime()) {
      candidates.push({
        start: new Date(cursor),
        end:   new Date(cursor.getTime() + duration * 60000),
      });
      cursor = new Date(cursor.getTime() + 30 * 60000);
    }

    // Score each slot
    const scored = candidates.map(slot => {
      let score = 100;

      // Deduct for each busy participant during this slot
      for (const busy of busySlots) {
        const bStart = new Date(busy.start_time).getTime();
        const bEnd   = new Date(busy.end_time).getTime();
        const sStart = slot.start.getTime();
        const sEnd   = slot.end.getTime();
        if (bStart < sEnd && bEnd > sStart) {
          if (busy.availability_type === 'BUSY') score -= 40;
          else if (busy.availability_type === 'TENTATIVE') score -= 15;
          else if (busy.availability_type === 'OUT_OF_OFFICE') score -= 80;
        }
      }

      // Timezone comfort: prefer 9am-5pm
      const hour = slot.start.getHours();
      if (hour >= 9 && hour <= 17) score += 10;
      else if (hour < 8 || hour > 18) score -= 20;

      // Earlier in day = better (avoid end-of-day)
      const relativeHour = (hour - WORK_START) / (WORK_END - WORK_START);
      score += Math.round((1 - relativeHour) * 10);

      // Priority urgency bonus for morning slots
      if (priority === 'URGENT' && hour < 12) score += 15;

      return { ...slot, score: Math.max(0, Math.min(100, score)) };
    });

    return scored
      .filter(s => s.score > 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(s => ({
        start_time: s.start.toISOString(),
        end_time:   s.end.toISOString(),
        score:      s.score,
        label:      `${s.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${s.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      }));
  },
};

module.exports = AvailabilityService;
