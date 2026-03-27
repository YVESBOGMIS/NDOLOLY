import { API_BASE_URL } from './config';
import { clearToken, getToken } from './auth';

type RequestOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
};

let authFailureHandler: null | (() => void | Promise<void>) = null;

export function setAuthFailureHandler(handler: null | (() => void | Promise<void>)) {
  authFailureHandler = handler;
}

async function buildHeaders(extra?: Record<string, string>) {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(extra || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function request(path: string, options: RequestOptions = {}) {
  const url = `${API_BASE_URL}${path}`;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = await buildHeaders(options.headers);
  if (!isFormData && options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body
      ? isFormData
        ? options.body
        : JSON.stringify(options.body)
      : undefined,
  });

  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const data = await res.json();
        const message = data?.error || data?.message || JSON.stringify(data);
        if (message === 'Invalid token' || message === 'Missing token') {
          await clearToken();
          if (authFailureHandler) {
            await authFailureHandler();
          }
        }
        throw new Error(message || 'Request failed');
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err || '');
        throw new Error(raw || 'Request failed');
      }
    }
    const errorText = await res.text();
    throw new Error(errorText || 'Request failed');
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: any) => request(path, { method: 'POST', body }),
  put: (path: string, body?: any) => request(path, { method: 'PUT', body }),
  delete: (path: string, body?: any) => request(path, { method: 'DELETE', body }),
  upload: (path: string, formData: FormData) =>
    request(path, { method: 'POST', body: formData }),
};
