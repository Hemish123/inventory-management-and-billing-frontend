import axios from 'axios';
import { store } from '../store';
import { logout, setTokens } from '../store/authSlice';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach access token
api.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.auth.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 + auto-refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const state = store.getState();
      const refreshToken = state.auth.refreshToken;

      if (!refreshToken) {
        store.dispatch(logout());
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access, refresh } = response.data;
        store.dispatch(setTokens({ access, refresh: refresh || refreshToken }));

        processQueue(null, access);
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        store.dispatch(logout());
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Helper: wrap API calls to return { data, error } pattern
export const apiCall = async (fn) => {
  try {
    const response = await fn();
    return { data: response.data, error: null };
  } catch (error) {
    const data = error.response?.data;
    let message = error.message || 'An error occurred';
    
    if (data) {
      if (typeof data === 'string') {
        message = data;
      } else if (data.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
        const errors = [];
        for (const [key, val] of Object.entries(data.errors)) {
          const niceKey = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          if (Array.isArray(val)) {
            // Handle nested serializer errors like items: [{product: ['...']}]
            const first = val[0];
            if (typeof first === 'string') {
              errors.push(`${niceKey}: ${first}`);
            } else if (typeof first === 'object' && first !== null) {
              // Nested object error — extract first readable message
              const nested = Object.entries(first);
              if (nested.length > 0) {
                const [nestedKey, nestedVal] = nested[0];
                const nestedNice = nestedKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                const msg = Array.isArray(nestedVal) ? nestedVal[0] : String(nestedVal);
                errors.push(`${niceKey} → ${nestedNice}: ${msg}`);
              }
            }
          } else if (typeof val === 'string') {
            errors.push(`${niceKey}: ${val}`);
          }
        }
        if (errors.length > 0) {
          message = errors.join(' • ');
        } else {
          message = data.message || JSON.stringify(data.errors);
        }
      } else if (data.message) {
        message = data.message;
      } else if (data.detail) {
        message = data.detail;
      } else if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        const errors = [];
        for (const [key, val] of Object.entries(data)) {
          const niceKey = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          if (Array.isArray(val)) {
            errors.push(`${niceKey}: ${val[0]}`);
          } else if (typeof val === 'string') {
            errors.push(`${niceKey}: ${val}`);
          }
        }
        if (errors.length > 0) {
          message = errors.join(' • ');
        } else {
          message = JSON.stringify(data);
        }
      } else {
        message = JSON.stringify(data);
      }
    }
    
    return { data: null, error: message };
  }
};

export default api;
