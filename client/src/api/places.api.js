import api from './axios.js';

export const placesApi = {
  getSavedPlaces: async () => {
    const res = await api.get('/api/saved-places');
    return res.data.data;
  },

  getSavedPlaceById: async (id) => {
    const res = await api.get(`/api/saved-places/${id}`);
    return res.data.data;
  },

  createSavedPlace: async (payload) => {
    const res = await api.post('/api/saved-places', payload);
    return res.data.data;
  },

  updateSavedPlace: async (id, payload) => {
    const res = await api.patch(`/api/saved-places/${id}`, payload);
    return res.data.data;
  },

  deleteSavedPlace: async (id) => {
    const res = await api.delete(`/api/saved-places/${id}`);
    return res.data.data;
  }
};

export default placesApi;
