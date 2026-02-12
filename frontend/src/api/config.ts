import { NativeModules, Platform } from 'react-native';

const DEFAULT_API_BASE_URL = 'http://localhost:8000/api/v1';

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const normalizeHost = (host: string) => (host.includes(':') ? `[${host}]` : host);

const detectHostFromBundleUrl = () => {
  const scriptURL = NativeModules.SourceCode?.scriptURL;
  if (!scriptURL) {
    return null;
  }

  try {
    return new URL(scriptURL).hostname;
  } catch {
    return null;
  }
};

const inferApiBaseUrl = () => {
  const host = detectHostFromBundleUrl();
  if (host) {
    const resolvedHost = Platform.OS === 'android' && host === 'localhost' ? '10.0.2.2' : host;
    return `http://${normalizeHost(resolvedHost)}:8000/api/v1`;
  }

  if (Platform.OS === 'web') {
    const webHost = (globalThis as { location?: { hostname?: string } }).location?.hostname;
    if (webHost) {
      return `http://${normalizeHost(webHost)}:8000/api/v1`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }
  return DEFAULT_API_BASE_URL;
};

const envApiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_BASE_URL = stripTrailingSlash(envApiBaseUrl || inferApiBaseUrl());
