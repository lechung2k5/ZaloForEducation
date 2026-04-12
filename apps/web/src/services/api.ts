import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
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
