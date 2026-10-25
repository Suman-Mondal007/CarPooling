import api from './axios.js';

export const bookingsApi = {
  createBooking: async (payload) => {
    const res = await api.post('/api/bookings', payload);
    return res.data.data;
  },

  createSeriesBooking: async (payload) => {
    const res = await api.post('/api/bookings/series', payload);
    return res.data.data;
  },

  getMyBookings: async (params) => {
    const res = await api.get('/api/bookings/my', { params });
    return res.data.data;
  },

  getBookingById: async (id) => {
    const res = await api.get(`/api/bookings/${id}`);
    return res.data.data;
  },

  cancelBooking: async (id) => {
    const res = await api.post(`/api/bookings/${id}/cancel`);
    return res.data.data;
  }
};

export default bookingsApi;
