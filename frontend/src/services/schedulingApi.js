/**
 * services/schedulingApi.js
 *
 * All API calls for the Interview Scheduling Module.
 */
import api from './api';

export const schedulingApi = {
  // Calendar
  getCalendarView: (params) =>
    api.get('/scheduling/calendar', { params }),

  getAnalytics: () =>
    api.get('/scheduling/analytics'),

  // Availability
  getAvailability: (emails, startDate, endDate) =>
    api.get('/scheduling/availability', { params: { emails: emails.join(','), startDate, endDate } }),

  createAvailability: (data) =>
    api.post('/scheduling/availability', data),

  // Slot suggestions
  suggestSlots: (emails, date, duration = 60, priority = 'MEDIUM') =>
    api.get('/scheduling/slots/suggest', {
      params: { emails: emails.join(','), date, duration, priority },
    }),

  // Interview CRUD (scheduling-aware)
  createInterview: (data) =>
    api.post('/scheduling/interviews', data),

  updateInterview: (id, data) =>
    api.put(`/scheduling/interviews/${id}`, data),

  deleteInterview: (id) =>
    api.delete(`/scheduling/interviews/${id}`),

  checkConflicts: (id, params) =>
    api.get(`/scheduling/interviews/${id}/conflicts`, { params }),

  updateResponse: (id, email, response) =>
    api.put(`/scheduling/interviews/${id}/response`, { email, response }),

  duplicateInterview: (id, scheduled_time) =>
    api.post(`/scheduling/interviews/${id}/duplicate`, { scheduled_time }),

  // Candidates (for dropdown)
  getCandidates: () =>
    api.get('/candidates'),
};

export default schedulingApi;
