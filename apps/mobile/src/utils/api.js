import AsyncStorage from '@react-native-async-storage/async-storage';
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Robust API request wrapper with 401 SESSION_INVALIDATED interception.
 */
export async function apiRequest(endpoint, options = {}) {
  const token = await AsyncStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Check for 401 Unauthorized
    if (response.status === 401) {
      let data = {};
      try {
        data = await response.json();
      } catch (e) {
        console.warn('[API] Non-JSON 401 response');
      }

      if (data.message === 'SESSION_INVALIDATED') {
        console.error('[API] Session invalidated detected. Triggering force logout.');
        if (typeof global !== 'undefined' && global.handleForceLogout) {
          global.handleForceLogout();
        }
        throw new Error('SESSION_INVALIDATED');
      }

      return { ok: false, status: 401, ...data };
    }

    let data = {};
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.warn('[API] Response is not JSON:', text.substring(0, 100));
      data = { message: text };
    }

    return { ok: response.ok, status: response.status, ...data };

  } catch (error) {
    console.error(`[API] Error on ${endpoint}:`, error);
    throw error;
  }
}
