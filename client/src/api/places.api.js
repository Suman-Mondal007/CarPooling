import api from './axios.js';

export const placesApi = {
  getSavedPlaces: async () => {
    const res = await api.get('/saved-places');
    return res.data.data;
  },

  getSavedPlaceById: async (id) => {
    const res = await api.get(`/saved-places/${id}`);
    return res.data.data;
  },

  createSavedPlace: async (payload) => {
    const res = await api.post('/saved-places', payload);
    return res.data.data;
  },

  updateSavedPlace: async (id, payload) => {
    const res = await api.patch(`/saved-places/${id}`, payload);
    return res.data.data;
  },

  deleteSavedPlace: async (id) => {
    const res = await api.delete(`/saved-places/${id}`);
    return res.data.data;
  }
};

export default placesApi;
