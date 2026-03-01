// api.ts - Smart API helper for Attendify
// In browser (web): uses relative /api/ paths (served by Express)
// In APK (Capacitor): uses VITE_API_BASE_URL to reach deployed backend

const BASE_URL = process.env.VITE_API_BASE_URL || '';

export function apiUrl(path: string): string {
  if (!path.startsWith('/')) path = '/' + path;
  return `${BASE_URL}${path}`;
}

// Drop-in replacement for fetch that auto-prefixes the base URL
export function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), options);
}
