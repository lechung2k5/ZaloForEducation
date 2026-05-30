import axios from 'axios';

const params = new URLSearchParams(window.location.search);
const overrideApiUrl = params.get('apiUrl');

export const getApiUrl = () => {
  if (overrideApiUrl) return overrideApiUrl;
  return import.meta.env.VITE_API_URL || 'http://localhost:3000';
};

const api = axios.create({
  baseURL: getApiUrl(),
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
  return config;
});

export default api;
