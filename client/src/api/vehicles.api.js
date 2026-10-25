import api from './axios.js';

export const vehiclesApi = {
  getVehicles: async () => {
    const res = await api.get('/api/vehicles');
    return res.data.data;
  },

  getVehicleById: async (id) => {
    const res = await api.get(`/api/vehicles/${id}`);
    return res.data.data;
  },

  createVehicle: async (payload) => {
    const res = await api.post('/api/vehicles', payload);
    return res.data.data;
  },

  updateVehicle: async (id, payload) => {
    const res = await api.patch(`/api/vehicles/${id}`, payload);
    return res.data.data;
  },

  deleteVehicle: async (id) => {
    const res = await api.delete(`/api/vehicles/${id}`);
    return res.data.data;
  }
};

export default vehiclesApi;
