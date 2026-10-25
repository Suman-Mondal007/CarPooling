import api from './axios.js';

export const tripsApi = {
  getMyTrips: async (params) => {
    const res = await api.get('/trips/my', { params });
    return res.data.data;
  },

  getTripById: async (id) => {
    const res = await api.get(`/trips/${id}`);
    return res.data.data;
  },

  startTrip: async (id) => {
    const res = await api.post(`/trips/${id}/start`);
    return res.data.data;
  },

  completeTrip: async (id) => {
    const res = await api.post(`/trips/${id}/complete`);
    return res.data.data;
  },

  getTripTracking: async (id) => {
    const res = await api.get(`/trips/${id}/tracking`);
    return res.data.data;
  },

  simulateLocation: async (id, data = {}) => {
    const res = await api.post(`/dev/trips/${id}/simulate-location`, data);
    return res.data.data;
  }
};

export default tripsApi;

