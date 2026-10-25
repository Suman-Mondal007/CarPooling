import api from './axios.js';

export const getHistory = (params) => api.get('/api/history', { params });

export const getMyReports = (params) => api.get('/api/users/reports', { params });

export const changePassword = (data) => api.post('/api/users/me/password', data);

export const createSupportRequest = (data) => api.post('/api/users/support', data);

export const getMySupportRequests = () => api.get('/api/users/support/my');

export const updateSettings = (data) => api.patch('/api/users/me', data);

// Admin API
export const getAdminSummary = () => api.get('/api/admin/summary');

export const getAdminEmployees = (params) => api.get('/api/admin/employees', { params });

export const updateEmployeeStatus = (id, data) =>
  api.patch(`/api/admin/employees/${id}/status`, data);

export const getAdminVehicles = (params) => api.get('/api/admin/vehicles', { params });

export const verifyVehicle = (id, data) => api.post(`/api/admin/vehicles/${id}/verify`, data);

export const getAdminSettings = () => api.get('/api/admin/settings');

export const updateAdminSettings = (data) => api.patch('/api/admin/settings', data);

export const regenerateCode = () => api.post('/api/admin/settings/regenerate-code');

export const getAdminRides = (params) => api.get('/api/admin/rides', { params });

export const getAdminReports = (params) => api.get('/api/admin/reports', { params });

export const getAdminReportsCsv = (params) =>
  api.get('/api/admin/reports', { params: { ...params, format: 'csv' }, responseType: 'blob' });
