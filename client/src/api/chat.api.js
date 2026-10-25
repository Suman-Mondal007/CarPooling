import api from './axios.js';

export const chatApi = {
  getConversations: async () => {
    const res = await api.get('/chat/conversations');
    return res.data.data;
  },

  getTripMessages: async (tripId, params = {}) => {
    const res = await api.get(`/trips/${tripId}/messages`, { params });
    return res.data.data;
  }
};

export default chatApi;
