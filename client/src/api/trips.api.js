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
  }
};

export default tripsApi;
