import api from './axios.js';

export const walletApi = {
  /**
   * Get current user's wallet balance
   */
  async getWallet() {
    const res = await api.get('/api/wallet');
    return res.data;
  },

  /**
   * Get paginated wallet transactions with optional type filter
   * @param {Object} params - { type: 'RECHARGE'|'PAYMENT'|'EARNING', page, limit }
   */
  async getTransactions(params = {}) {
    const res = await api.get('/api/wallet/transactions', { params });
    return res.data;
  },

  /**
   * Create Razorpay / simulated order to recharge wallet
   * @param {number} amountMinor - Amount in paise (integer)
   */
  async createRechargeOrder(amountMinor) {
    const res = await api.post('/api/wallet/recharge', { amountMinor });
    return res.data;
  },

  /**
   * Verify signature and credit wallet
   * @param {Object} data - { razorpay_order_id, razorpay_payment_id, razorpay_signature, amountMinor }
   */
  async verifyRecharge(data) {
    const res = await api.post('/api/wallet/recharge/verify', data);
    return res.data;
  },

  /**
   * Fast development / sandbox recharge without gateway
   * @param {number} amountMinor - Amount in paise (integer)
   */
  async simulateRecharge(amountMinor) {
    const res = await api.post('/api/wallet/simulate-recharge', { amountMinor });
    return res.data;
  }
};

export default walletApi;
