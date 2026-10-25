import api from './axios.js';

export const notificationsApi = {
  getNotifications: async (params) => {
    const res = await api.get('/api/notifications', { params });
    return res.data.data;
  },

  markAsRead: async (id) => {
    const res = await api.patch(`/api/notifications/${id}/read`);
    return res.data.data;
  },

  markAllAsRead: async () => {
    const res = await api.post('/api/notifications/read-all');
    return res.data.data;
  }
};

export default notificationsApi;
