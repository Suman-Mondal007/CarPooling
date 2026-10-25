import api from './axios.js';

export const geoApi = {
  search: async (query) => {
    if (!query || query.trim().length < 2) return [];
    try {
      const res = await api.get('/api/geo/search', { params: { q: query.trim() } });
      return Array.isArray(res.data?.data) ? res.data.data : [];
    } catch {
      return [];
    }
  },

  reverse: async (lat, lng) => {
    const res = await api.get('/api/geo/reverse', { params: { lat, lng } });
    return res.data?.data || null;
  },

  route: async (origin, destination) => {
    const res = await api.post('/api/geo/route', { origin, destination });
    return res.data?.data || null;
  }
};

export default geoApi;
