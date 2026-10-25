import api from './axios.js';

export const tripsApi = {
  getMyTrips: async (params) => {
    const res = await api.get('/api/trips/my', { params });
    return res.data.data;
  },

  getTripById: async (id) => {
    const res = await api.get(`/api/trips/${id}`);
    return res.data.data;
  },

  startTrip: async (id) => {
    const res = await api.post(`/api/trips/${id}/start`);
    return res.data.data;
  },

  completeTrip: async (id) => {
    const res = await api.post(`/api/trips/${id}/complete`);
    return res.data.data;
  },

  getTripTracking: async (id) => {
    const res = await api.get(`/api/trips/${id}/tracking`);
    return res.data.data;
  },

  simulateLocation: async (id, data = {}) => {
    const res = await api.post(`/api/dev/trips/${id}/simulate-location`, data);
    return res.data.data;
  }
};

export default tripsApi;

