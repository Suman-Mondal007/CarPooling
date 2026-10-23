import axios from 'axios';

let inMemoryAccessToken = null;
let isRefreshing = false;
let refreshPromise = null;
const authFailureListeners = [];

export const setAccessToken = (token) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = () => inMemoryAccessToken;

export const onAuthFailure = (callback) => {
  authFailureListeners.push(callback);
  return () => {
    const index = authFailureListeners.indexOf(callback);
    if (index > -1) authFailureListeners.splice(index, 1);
  };
};

const notifyAuthFailure = () => {
  authFailureListeners.forEach((fn) => fn());
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Request interceptor to inject access token
api.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with single-flight refresh lock
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!error.response || error.response.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // Do not attempt refresh on auth endpoints themselves
    const url = originalRequest.url || '';
    if (
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/refresh') ||
      url.includes('/api/auth/forgot-password') ||
      url.includes('/api/auth/reset-password')
    ) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = api
        .post('/api/auth/refresh')
        .then((res) => {
          const newToken = res.data?.data?.accessToken;
          setAccessToken(newToken);
          return newToken;
        })
        .catch((refreshError) => {
          setAccessToken(null);
          notifyAuthFailure();
          return Promise.reject(refreshError);
        })
        .finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
    }

    try {
      const newToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshErr) {
      return Promise.reject(refreshErr);
    }
  }
);

export default api;
