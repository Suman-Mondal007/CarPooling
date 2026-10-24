import api from './axios.js';

export const notificationsApi = {
  getNotifications: async (params) => {
    const res = await api.get('/notifications', { params });
    return res.data.data;
  },

  markAsRead: async (id) => {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data.data;
  },

  markAllAsRead: async () => {
    const res = await api.post('/notifications/read-all');
    return res.data.data;
  }
};

export default notificationsApi;
