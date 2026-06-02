const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

const defaultInit: RequestInit = { credentials: 'include' };

export const api = {
  get: (path: string, init?: RequestInit) =>
    fetch(`${BASE_URL}${path}`, { ...defaultInit, ...init }),

  post: (path: string, body?: unknown, init?: RequestInit) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...defaultInit,
      ...init,
    }),

  patch: (path: string, body?: unknown, init?: RequestInit) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...defaultInit,
      ...init,
    }),

  delete: (path: string, init?: RequestInit) =>
    fetch(`${BASE_URL}${path}`, { method: 'DELETE', ...defaultInit, ...init }),
};
