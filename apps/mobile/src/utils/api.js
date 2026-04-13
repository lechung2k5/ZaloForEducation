import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

const DEFAULT_PORT = '3000';

const normalizeBaseUrl = (value) => {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\/$/, '');
};

const isUsableEnvUrl = (value) => {
  if (!value) {
    return false;
  }

  // Ignore common placeholders copied from setup docs.
  if (/YOUR_LAN_IP|<IP|YOUR_IP|CHANGE_ME/i.test(value)) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol && parsed.hostname);
  } catch {
    return false;
  }
};

const getHostFromRuntime = () => {
  const scriptUrl = NativeModules?.SourceCode?.scriptURL;
  if (!scriptUrl || typeof scriptUrl !== 'string') {
    return '';
  }

  try {
    const url = new URL(scriptUrl);
    return url.hostname || '';
  } catch {
    const match = scriptUrl.match(/^[a-zA-Z]+:\/\/([^/:]+)(?::\d+)?/);
    return match?.[1] || '';
  }
};

const extractHost = (value) => {
  if (!value || typeof value !== 'string') {
    return '';
  }

  const cleaned = value.replace(/^[a-zA-Z]+:\/\//, '');
  return cleaned.split(':')[0] || '';
};

const getHostFromExpoConstants = () => {
  const hostFromExpoConfig = extractHost(Constants?.expoConfig?.hostUri);
  if (hostFromExpoConfig) {
    return hostFromExpoConfig;
  }

  const hostFromManifest = extractHost(Constants?.manifest2?.extra?.expoGo?.debuggerHost);
  if (hostFromManifest) {
    return hostFromManifest;
  }

  const hostFromLegacyManifest = extractHost(Constants?.manifest?.debuggerHost);
  if (hostFromLegacyManifest) {
    return hostFromLegacyManifest;
  }

  return '';
};

const getBrowserHost = () => {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return '';
  }

  return window.location.hostname;
};

export const getApiBaseUrl = () => {
  const envUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);
  if (isUsableEnvUrl(envUrl)) {
    return envUrl;
  }

  if (Platform.OS === 'web') {
    const browserHost = getBrowserHost();
    if (browserHost) {
      return `http://${browserHost}:${DEFAULT_PORT}`;
    }

    return `http://localhost:${DEFAULT_PORT}`;
  }

  const runtimeHost = getHostFromRuntime() || getHostFromExpoConstants();
  if (runtimeHost && !['localhost', '127.0.0.1', '::1'].includes(runtimeHost)) {
    return `http://${runtimeHost}:${DEFAULT_PORT}`;
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_PORT}`;
  }

  return `http://localhost:${DEFAULT_PORT}`;
};
