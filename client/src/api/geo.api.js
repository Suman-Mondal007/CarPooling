import api from './axios.js';

export const geoApi = {
  search: async (query) => {
    if (!query || query.trim().length < 3) return [];
    const res = await api.get('/geo/search', { params: { q: query.trim() } });
    return res.data.data;
  },

  reverse: async (lat, lng) => {
    const res = await api.get('/geo/reverse', { params: { lat, lng } });
    return res.data.data;
  },

  route: async (origin, destination) => {
    const res = await api.post('/geo/route', { origin, destination });
    return res.data.data;
  }
};

export default geoApi;
