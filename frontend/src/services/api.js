import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add auth tokens if we have them (Phase 4 integration later if needed)
api.interceptors.request.use((config) => {
  // In a real app, you'd get the token from localStorage or a context provider
  const userCacheKey = localStorage.getItem('userCacheKey');
  if (userCacheKey) {
    config.headers['X-User-Cache-Key'] = userCacheKey;
  }
  return config;
});

export const candidateApi = {
  getAll: () => api.get('/candidates'),
  getById: (id) => api.get(`/candidates/${id}`),
  create: (candidateData) => api.post('/candidates', candidateData),
};

export const interviewApi = {
  create: (interviewData) => api.post('/interviews', interviewData),
};

export const dashboardApi = {
  getDashboard: (candidateId) => api.get(`/dashboard/candidate/${candidateId}`),
  getAssetLinks: (candidateId, interviewId) => api.get(`/dashboard/candidate/${candidateId}/asset-links?interviewId=${interviewId}`),
};

export const teamsApi = {
  schedule: (interviewId) => api.post('/teams/schedule', { interview_id: interviewId }),
  cancel: (interviewId) => api.delete(`/teams/${interviewId}`),
};

export default api;
