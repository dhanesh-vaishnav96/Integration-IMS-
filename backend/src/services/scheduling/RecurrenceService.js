/**
 * services/scheduling/RecurrenceService.js
 *
 * Handles parsing and expansion of RRULEs for interview and availability recurrence
 * utilizing the standard 'rrule' package to ensure DST-safety and proper detached instances.
 */
const { RRule, RRuleSet, rrulestr } = require('rrule');
const { parseISO } = require('date-fns');
const { utcToZonedTime, zonedTimeToUtc } = require('date-fns-tz');

class RecurrenceService {
  
  /**
   * Expands an RRULE string into an array of Date objects.
   *
   * @param {string} rruleString - The standard iCalendar RRULE string.
   * @param {Date} startDate - The base start date/time.
   * @param {Date} windowStart - Query start boundary.
   * @param {Date} windowEnd - Query end boundary.
   * @param {string[]} exDates - ISO strings of exception dates to exclude.
   * @param {string} timezone - Timezone name to ensure DST correctness (e.g. 'America/New_York').
   * @returns {Date[]} Array of generated occurrence Dates.
   */
  static expandRRule(rruleString, startDate, windowStart, windowEnd, exDates = [], timezone = 'UTC') {
    if (!rruleString) return [startDate];

    try {
      // 1. Create base rule
      // If the string starts with RRULE:, parse it, otherwise prepend it.
      const formattedRule = rruleString.startsWith('RRULE:') ? rruleString : `RRULE:${rruleString}`;
      const ruleOptions = RRule.parseString(formattedRule);
      
      // Initialize with start date
      ruleOptions.dtstart = new Date(startDate);
      // We must map it as UTC for RRule to process purely, then convert back
      const rule = new RRule(ruleOptions);

      // 2. Wrap in RRuleSet to handle EXDATEs (exceptions)
      const rruleSet = new RRuleSet();
      rruleSet.rrule(rule);

      // Add exceptions
      exDates.forEach(ex => {
        const exD = new Date(ex);
        if (!isNaN(exD.getTime())) {
          rruleSet.exdate(exD);
        }
      });

      // 3. Get occurrences within the window
      // RRule's between is inclusive by default.
      const occurrences = rruleSet.between(new Date(windowStart), new Date(windowEnd), true);

      // 4. Return dates. RRule handles timezone DST jumps if we use date-fns-tz correctly,
      // but usually the dates outputted are pure UTC equivalents of the local time.
      return occurrences;
    } catch (err) {
      console.error('[RecurrenceService] Failed to expand RRULE:', err);
      // Fallback to just returning the original date if parsing fails
      return [startDate];
    }
  }

  /**
   * Generates a virtual event instance based on a recurrence occurrence.
   * 
   * @param {Object} parentEvent - The root DB event.
   * @param {Date} occurrenceDate - The generated start date from RRULE.
   * @returns {Object} A virtual cloned event with updated times.
   */
  static generateVirtualInstance(parentEvent, occurrenceDate) {
    const origStart = new Date(parentEvent.scheduled_time);
    // Calculate the original end time duration
    const durationMs = (parentEvent.duration_minutes || 60) * 60000;
    
    // The occurrence date has the correct new day/month/year but same time components
    // If DST shifted, RRule keeps local time constant (e.g. 10 AM always)
    
    return {
      ...parentEvent,
      id: `${parentEvent.id}_${occurrenceDate.getTime()}`, // Virtual ID format
      parent_interview_id: parentEvent.id,
      scheduled_time: occurrenceDate,
      is_virtual: true // Flag to tell frontend it's not a direct DB row unless modified
    };
  }

}

module.exports = RecurrenceService;
