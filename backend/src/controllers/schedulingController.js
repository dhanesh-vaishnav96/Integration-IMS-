/**
 * controllers/schedulingController.js
 *
 * Thin controller for the Interview Scheduling module.
 * All business logic lives in the services layer.
 */
const asyncHandler        = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendNoContent } = require('../helpers/responseHelper');
const CalendarService     = require('../services/scheduling/CalendarService');
const AvailabilityService = require('../services/scheduling/AvailabilityService');
const ConflictService     = require('../services/scheduling/ConflictService');
const AnalyticsService    = require('../services/scheduling/AnalyticsService');
const NotificationService = require('../services/scheduling/NotificationService');
const WebSocketService    = require('../services/scheduling/WebSocketService');
const schedulingRepository  = require('../repositories/postgres/schedulingRepository');
const availabilityRepository = require('../repositories/postgres/availabilityRepository');
const AppError            = require('../utils/AppError');
const { HTTP_STATUS }     = require('../constants');

// ─── Calendar View ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/scheduling/calendar
 * ?view=week&date=2026-06-06&timezone=Asia/Kolkata
 * &candidateId=&status=&type=&department=
 */
const getCalendarView = asyncHandler(async (req, res) => {
  const { view, date, timezone, candidateId, status, type, department } = req.query;
  const result = await CalendarService.getCalendarView({
    view, date, timezone,
    filters: { candidateId, status, type, department },
  });
  return sendSuccess(res, 'Calendar events fetched.', result);
});

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/scheduling/analytics
 */
const getAnalytics = asyncHandler(async (req, res) => {
  const analytics = await AnalyticsService.getAnalytics();
  return sendSuccess(res, 'Analytics fetched.', analytics);
});

// ─── Availability ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/scheduling/availability
 * ?emails=a@b.com,c@d.com&startDate=&endDate=
 */
const getAvailability = asyncHandler(async (req, res) => {
  const { emails, startDate, endDate } = req.query;
  if (!emails || !startDate || !endDate) {
    throw new AppError('emails, startDate, and endDate are required.', HTTP_STATUS.BAD_REQUEST);
  }
  const emailList = emails.split(',').map(e => e.trim()).filter(Boolean);
  const result = await AvailabilityService.getAvailability(emailList, startDate, endDate);
  return sendSuccess(res, 'Availability fetched.', result);
});

/**
 * POST /api/v1/scheduling/availability
 */
const createAvailability = asyncHandler(async (req, res) => {
  const { email, ...data } = req.body;
  if (!email) throw new AppError('email is required.', HTTP_STATUS.BAD_REQUEST);
  const slot = await availabilityRepository.upsert(email, {
    ...data,
    created_by: req.user?.email || 'system',
  });
  return sendCreated(res, 'Availability slot created.', slot);
});

// ─── Slot Suggestions ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/scheduling/slots/suggest
 * ?emails=a,b&date=2026-06-06&duration=60&priority=HIGH
 */
const suggestSlots = asyncHandler(async (req, res) => {
  const { emails, date, duration, priority } = req.query;
  if (!emails || !date) throw new AppError('emails and date are required.', HTTP_STATUS.BAD_REQUEST);
  const emailList = emails.split(',').map(e => e.trim()).filter(Boolean);
  const slots = await AvailabilityService.suggestSlots(
    emailList, date, parseInt(duration || '60', 10), priority || 'MEDIUM'
  );
  return sendSuccess(res, 'Suggested slots computed.', { slots });
});

// ─── Interview CRUD (scheduling-aware) ────────────────────────────────────────

/**
 * POST /api/v1/scheduling/interviews
 */
const createScheduledInterview = asyncHandler(async (req, res) => {
  const { participants = [], ...interviewData } = req.body;

  // Conflict detection
  const startTime = new Date(interviewData.scheduled_time);
  const endTime   = new Date(startTime.getTime() + (interviewData.duration_minutes || 60) * 60000);
  const conflicts = await ConflictService.checkAll({
    candidateId:         interviewData.candidate_id,
    participants,
    startTime:           startTime.toISOString(),
    endTime:             endTime.toISOString(),
    travelBufferMinutes: interviewData.travel_buffer_minutes || 0,
  });

  if (ConflictService.hasBlockingConflicts(conflicts)) {
    throw new AppError(
      `Cannot create interview: ${conflicts.filter(c => c.severity === 'ERROR').map(c => c.message).join('; ')}`,
      HTTP_STATUS.CONFLICT
    );
  }

  interviewData.created_by = req.user?.email || 'system';
  if (!interviewData.organizer_email) {
    interviewData.organizer_email = process.env.TEAMS_ORGANIZER_EMAIL || 'nadeem.aehmad@kadellabs.com';
  }
  const interview = await schedulingRepository.createWithParticipants(interviewData, participants);

  // Fire-and-forget: send invites + schedule reminders
  NotificationService.scheduleAllReminders(interview, participants).catch(err =>
    console.error('[Scheduling] Notification error:', err.message)
  );

  // Broadcast via WebSocket
  WebSocketService.broadcastEventCreated(interview);

  return sendCreated(res, 'Interview scheduled successfully.', {
    interview,
    conflicts: conflicts.filter(c => c.severity === 'WARNING'),
  });
});

/**
 * PUT /api/v1/scheduling/interviews/:id
 */
const updateScheduledInterview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { participants, ...interviewData } = req.body;
  interviewData.updated_by = req.user?.email || 'system';

  // If rescheduling, re-run conflict checks
  if (interviewData.scheduled_time) {
    const startTime = new Date(interviewData.scheduled_time);
    const endTime   = new Date(startTime.getTime() + (interviewData.duration_minutes || 60) * 60000);
    const conflicts = await ConflictService.checkAll({
      candidateId:         interviewData.candidate_id,
      participants:        participants || [],
      startTime:           startTime.toISOString(),
      endTime:             endTime.toISOString(),
      excludeId:           id,
      travelBufferMinutes: interviewData.travel_buffer_minutes || 0,
    });
    if (ConflictService.hasBlockingConflicts(conflicts)) {
      throw new AppError(
        `Cannot reschedule: ${conflicts.filter(c => c.severity === 'ERROR').map(c => c.message).join('; ')}`,
        HTTP_STATUS.CONFLICT
      );
    }
  }

  const interview = await schedulingRepository.updateWithParticipants(id, interviewData, participants || null);
  if (!interview) throw new AppError('Interview not found.', HTTP_STATUS.NOT_FOUND);

  WebSocketService.broadcastEventUpdated(interview);
  return sendSuccess(res, 'Interview updated.', interview);
});

/**
 * DELETE /api/v1/scheduling/interviews/:id
 */
const deleteScheduledInterview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await schedulingRepository.updateWithParticipants(id, {
    status: 'CANCELLED',
    deleted_at: new Date(),
    updated_by: req.user?.email || 'system',
  }, null);
  WebSocketService.broadcastEventDeleted(id);
  return sendNoContent(res);
});

/**
 * GET /api/v1/scheduling/interviews/:id/conflicts
 */
const checkConflicts = asyncHandler(async (req, res) => {
  const { candidateId, participants, startTime, endTime, travelBufferMinutes } = req.query;
  const emailList = participants ? participants.split(',').map(e => ({ email: e.trim() })) : [];
  const conflicts = await ConflictService.checkAll({
    candidateId,
    participants: emailList,
    startTime,
    endTime,
    excludeId: req.params.id,
    travelBufferMinutes: parseInt(travelBufferMinutes || '0', 10),
  });
  return sendSuccess(res, 'Conflict check complete.', { conflicts, hasBlockers: ConflictService.hasBlockingConflicts(conflicts) });
});

/**
 * PUT /api/v1/scheduling/interviews/:id/response
 */
const updateMeetingResponse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { email, response } = req.body;
  if (!email || !response) throw new AppError('email and response are required.', HTTP_STATUS.BAD_REQUEST);
  await schedulingRepository.updateParticipantResponse(id, email, response);
  return sendSuccess(res, 'Meeting response updated.');
});

/**
 * POST /api/v1/scheduling/interviews/:id/duplicate
 */
const duplicateInterview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { scheduled_time } = req.body;

  // Fetch original
  const [original] = await schedulingRepository.findInDateRange({ startDate: '2020-01-01', endDate: '2030-01-01', limit: 1 });
  throw new AppError('Duplicate not implemented — fetch original first.', 501);
});

module.exports = {
  getCalendarView,
  getAnalytics,
  getAvailability,
  createAvailability,
  suggestSlots,
  createScheduledInterview,
  updateScheduledInterview,
  deleteScheduledInterview,
  checkConflicts,
  updateMeetingResponse,
  duplicateInterview,
};
