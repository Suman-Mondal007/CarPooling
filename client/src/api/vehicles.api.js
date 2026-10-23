import api from './axios.js';

export const vehiclesApi = {
  getVehicles: async () => {
    const res = await api.get('/vehicles');
    return res.data.data;
  },

  getVehicleById: async (id) => {
    const res = await api.get(`/vehicles/${id}`);
    return res.data.data;
  },

  createVehicle: async (payload) => {
    const res = await api.post('/vehicles', payload);
    return res.data.data;
  },

  updateVehicle: async (id, payload) => {
    const res = await api.patch(`/vehicles/${id}`, payload);
    return res.data.data;
  },

  deleteVehicle: async (id) => {
    const res = await api.delete(`/vehicles/${id}`);
    return res.data.data;
  }
};

export default vehiclesApi;
