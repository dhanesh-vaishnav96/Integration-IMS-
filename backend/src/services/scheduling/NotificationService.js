/**
 * services/scheduling/NotificationService.js
 *
 * Schedules and dispatches interview notifications via BullMQ.
 */
const { enqueue, scheduleAt, QUEUES } = require('../../jobs/bullmq/schedulingQueue');
const logger = require('../../config/logger');

const NotificationService = {
  /**
   * Schedule all reminders for a new interview.
   */
  async scheduleAllReminders(interview, participants = []) {
    const startTime = new Date(interview.scheduled_time);

    const reminderJobs = [
      { queue: QUEUES.REMINDER_1D,  offset: 24 * 60 * 60 * 1000, label: '1 day' },
      { queue: QUEUES.REMINDER_1H,  offset: 60 * 60 * 1000,      label: '1 hour' },
      { queue: QUEUES.REMINDER_30M, offset: 30 * 60 * 1000,      label: '30 min' },
      { queue: QUEUES.REMINDER_15M, offset: 15 * 60 * 1000,      label: '15 min' },
    ];

    const allRecipients = [
      { email: interview.organizer_email, role: 'ORGANIZER' },
      ...(interview.interviewer_email ? [{ email: interview.interviewer_email, role: 'INTERVIEWER' }] : []),
      ...participants.map(p => ({ email: p.email, role: p.role })),
    ];

    for (const reminder of reminderJobs) {
      const runAt = new Date(startTime.getTime() - reminder.offset);
      if (runAt <= new Date()) continue; // Skip past reminders

      for (const recipient of allRecipients) {
        await scheduleAt(reminder.queue, {
          interviewId:     interview.id,
          recipientEmail:  recipient.email,
          recipientRole:   recipient.role,
          reminderType:    reminder.label,
          interviewData: {
            title:          interview.title,
            scheduled_time: interview.scheduled_time,
            duration_minutes: interview.duration_minutes,
            meeting_join_url: interview.meeting_join_url,
          },
        }, runAt);
      }
      logger.info(`[NotificationService] Scheduled ${reminder.label} reminder for interview ${interview.id}`);
    }

    // Immediate invite
    await enqueue(QUEUES.SEND_INVITE, {
      interviewId: interview.id,
      participants: allRecipients,
      interviewData: {
        title:          interview.title,
        scheduled_time: interview.scheduled_time,
        duration_minutes: interview.duration_minutes,
        meeting_join_url: interview.meeting_join_url,
        type:           interview.type,
      },
    });
  },
};

module.exports = NotificationService;
