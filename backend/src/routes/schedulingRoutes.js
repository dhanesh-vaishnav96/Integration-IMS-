/**
 * routes/schedulingRoutes.js
 *
 * All Interview Scheduling Module routes.
 */
const express = require('express');
const {
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
} = require('../controllers/schedulingController');

const router = express.Router();

// Calendar & Analytics
router.get('/calendar',         getCalendarView);       // GET /api/v1/scheduling/calendar
router.get('/analytics',        getAnalytics);           // GET /api/v1/scheduling/analytics

// Availability
router.get('/availability',     getAvailability);        // GET /api/v1/scheduling/availability
router.post('/availability',    createAvailability);     // POST /api/v1/scheduling/availability

// Slot suggestions
router.get('/slots/suggest',    suggestSlots);           // GET /api/v1/scheduling/slots/suggest

// Interview CRUD (scheduling-aware)
router.post('/interviews',                              createScheduledInterview);
router.put('/interviews/:id',                           updateScheduledInterview);
router.delete('/interviews/:id',                        deleteScheduledInterview);
router.get('/interviews/:id/conflicts',                 checkConflicts);
router.put('/interviews/:id/response',                  updateMeetingResponse);
router.post('/interviews/:id/duplicate',                duplicateInterview);

module.exports = router;
