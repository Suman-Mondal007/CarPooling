import api from './axios.js';

export const ridesApi = {
  publishRide: async (payload) => {
    const res = await api.post('/rides', payload);
    return res.data.data;
  },

  getMyOfferedRides: async () => {
    const res = await api.get('/rides/my-offered');
    return res.data.data;
  },

  cancelOfferedRide: async (id) => {
    const res = await api.post(`/rides/${id}/cancel`);
    return res.data.data;
  },

  searchRides: async (params) => {
    const res = await api.get('/rides/search', { params });
    return res.data.data;
  },

  getRideById: async (id) => {
    const res = await api.get(`/rides/${id}`);
    return res.data.data;
  }
};

export default ridesApi;
