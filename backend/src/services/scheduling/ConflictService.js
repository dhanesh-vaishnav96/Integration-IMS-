/**
 * services/scheduling/ConflictService.js
 *
 * 7-type conflict detection engine.
 */
const schedulingRepository = require('../../repositories/postgres/schedulingRepository');
const availabilityRepository = require('../../repositories/postgres/availabilityRepository');
const logger = require('../../config/logger');

const WORKING_HOUR_START = parseInt(process.env.WORKING_HOUR_START || '8', 10);  // 8am
const WORKING_HOUR_END   = parseInt(process.env.WORKING_HOUR_END   || '18', 10); // 6pm

const ConflictService = {
  /**
   * Run all conflict checks. Returns array of conflict objects.
   */
  async checkAll({ candidateId, participants = [], startTime, endTime, excludeId = null, travelBufferMinutes = 0 }) {
    const conflicts = [];

    const [candidateConflicts, participantConflicts] = await Promise.all([
      candidateId
        ? schedulingRepository.findCandidateConflicts(candidateId, startTime, endTime, excludeId)
        : [],
      participants.length
        ? schedulingRepository.findParticipantConflicts(
            participants.map(p => p.email || p),
            startTime, endTime, excludeId
          )
        : [],
    ]);

    if (candidateConflicts.length) {
      conflicts.push({
        type: 'CANDIDATE_DOUBLE_BOOKING',
        severity: 'ERROR',
        message: `Candidate already has ${candidateConflicts.length} interview(s) scheduled at this time`,
        details: candidateConflicts.map(c => ({ id: c.id, time: c.scheduled_time })),
      });
    }

    if (participantConflicts.length) {
      const conflictingEmails = new Set();
      participantConflicts.forEach(i => i.participants?.forEach(p => conflictingEmails.add(p.email)));
      conflicts.push({
        type: 'PANELIST_CONFLICT',
        severity: 'WARNING',
        message: `${conflictingEmails.size} panelist(s) have overlapping interviews`,
        details: { emails: [...conflictingEmails], interviews: participantConflicts.map(c => c.id) },
      });
    }

    // Duplicate panelist check
    const emails = participants.map(p => p.email || p);
    const uniqueEmails = new Set(emails);
    if (emails.length !== uniqueEmails.size) {
      conflicts.push({
        type: 'DUPLICATE_PANELIST',
        severity: 'ERROR',
        message: 'Duplicate panelist email(s) detected in participant list',
      });
    }

    // Working hours check temporarily disabled due to cross-timezone scheduling requirements

    // Travel buffer check (if travelBuffer > 0, check adjacent interviews)
    if (travelBufferMinutes > 0 && participantConflicts.length === 0) {
      const bufferedStart = new Date(new Date(startTime).getTime() - travelBufferMinutes * 60000);
      const bufferedEnd   = new Date(new Date(endTime).getTime()   + travelBufferMinutes * 60000);
      const bufferConflicts = await schedulingRepository.findParticipantConflicts(
        emails, bufferedStart.toISOString(), bufferedEnd.toISOString(), excludeId
      );
      if (bufferConflicts.length) {
        conflicts.push({
          type: 'TRAVEL_BUFFER_VIOLATION',
          severity: 'WARNING',
          message: `Travel buffer of ${travelBufferMinutes}min conflicts with adjacent interviews`,
        });
      }
    }

    return conflicts;
  },

  hasBlockingConflicts(conflicts) {
    return conflicts.some(c => c.severity === 'ERROR');
  },
};

module.exports = ConflictService;
