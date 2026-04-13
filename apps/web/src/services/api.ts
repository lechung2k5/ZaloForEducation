import axios from 'axios';

const DEFAULT_PORT = '3000';

const normalizeBaseUrl = (value: unknown) => {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\/$/, '');
};

const getBrowserHost = () => {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return '';
  }

  return window.location.hostname;
};

export const getApiBaseUrl = () => {
  const envUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL);
  if (envUrl) {
    return envUrl;
  }

  const browserHost = getBrowserHost();
  if (browserHost) {
    return `http://${browserHost}:${DEFAULT_PORT}`;
  }

  return `http://localhost:${DEFAULT_PORT}`;
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tự động đính kèm Token vào header nếu có
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    // Let the browser set multipart/form-data boundary automatically.
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  }

  return config;
});

export default api;
