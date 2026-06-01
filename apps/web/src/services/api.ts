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

const decodeJwtPayload = (token: string): { exp?: number } | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
};

let refreshPromise: Promise<string | null> | null = null;

export const refreshAccessToken = async () => {
  const token = localStorage.getItem('token');
  if (!token) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${getApiUrl()}/auth/refresh`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const nextToken = res.data?.accessToken;
        if (nextToken) {
          localStorage.setItem('token', nextToken);
          return nextToken;
        }
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

export const ensureFreshAccessToken = async () => {
  const token = localStorage.getItem('token');
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  const expiresAtMs = (payload?.exp || 0) * 1000;
  if (expiresAtMs && expiresAtMs - Date.now() > 60_000) {
    return token;
  }

  return refreshAccessToken();
};

api.interceptors.request.use(async (config) => {
  const token = await ensureFreshAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !String(originalRequest.url || '').includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
