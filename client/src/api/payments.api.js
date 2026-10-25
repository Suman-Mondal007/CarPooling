import api from './axios.js';

export const paymentsApi = {
  /**
   * Create an online order for CARD or UPI
   * @param {Object} data - { bookingId, method: 'CARD'|'UPI' }
   * @param {string} idempotencyKey
   */
  async createOrder(data, idempotencyKey) {
    const res = await api.post('/api/payments/create-order', data, {
      headers: {
        'Idempotency-Key': idempotencyKey
      }
    });
    return res.data;
  },

  /**
   * Verify Razorpay or simulated payment signature
   * @param {Object} data - { razorpay_order_id, razorpay_payment_id, razorpay_signature }
   */
  async verifyPayment(data) {
    const res = await api.post('/api/payments/verify', data);
    return res.data;
  },

  /**
   * Pay directly using wallet balance
   * @param {Object} data - { bookingId }
   * @param {string} idempotencyKey
   */
  async walletPay(data, idempotencyKey) {
    const res = await api.post('/api/payments/wallet-pay', data, {
      headers: {
        'Idempotency-Key': idempotencyKey
      }
    });
    return res.data;
  },

  /**
   * Initiate cash payment request
   * @param {Object} data - { bookingId }
   */
  async cashPay(data) {
    const res = await api.post('/api/payments/cash', data);
    return res.data;
  },

  /**
   * Cancel pending cash payment request
   * @param {string} paymentId
   */
  async cancelCash(paymentId) {
    const res = await api.post(`/api/payments/${paymentId}/cancel-cash`);
    return res.data;
  },

  /**
   * Driver confirms physical cash received
   * @param {string} paymentId
   */
  async confirmCashPayment(paymentId) {
    const res = await api.post(`/api/payments/${paymentId}/cash-confirmation`);
    return res.data;
  },

  /**
   * Get user payment history
   * @param {Object} params - { role: 'passenger'|'driver', page, limit }
   */
  async getMyPayments(params = {}) {
    const res = await api.get('/api/payments/my', { params });
    return res.data;
  },

  /**
   * Get payment receipt by ID
   * @param {string} paymentId
   */
  async getPaymentById(paymentId) {
    const res = await api.get(`/api/payments/${paymentId}`);
    return res.data;
  }
};

export default paymentsApi;
