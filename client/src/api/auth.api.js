import api, { setAccessToken } from './axios.js';

export const authApi = {
  async register(data) {
    const res = await api.post('/api/auth/register', data);
    return res.data;
  },

  async login(credentials) {
    const res = await api.post('/api/auth/login', credentials);
    if (res.data?.data?.accessToken) {
      setAccessToken(res.data.data.accessToken);
    }
    return res.data;
  },

  async refresh() {
    const res = await api.post('/api/auth/refresh');
    if (res.data?.data?.accessToken) {
      setAccessToken(res.data.data.accessToken);
    }
    return res.data;
  },

  async logout() {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setAccessToken(null);
    }
  },

  async forgotPassword(email) {
    const res = await api.post('/api/auth/forgot-password', { email });
    return res.data;
  },

  async resetPassword(data) {
    const res = await api.post('/api/auth/reset-password', data);
    return res.data;
  },

  async getMe() {
    const res = await api.get('/api/auth/me');
    return res.data;
  },

  async getProfile() {
    const res = await api.get('/api/users/me');
    return res.data;
  },

  async updateProfile(updates) {
    const res = await api.patch('/api/users/me', updates);
    return res.data;
  },

  async getMyOrganization() {
    const res = await api.get('/api/organizations/me');
    return res.data;
  }
};

export default authApi;
