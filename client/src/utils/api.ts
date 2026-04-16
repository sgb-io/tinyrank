let csrfToken = '';

export async function initCsrf(): Promise<void> {
  const res = await fetch('/api/csrf-token');
  const data = await res.json();
  csrfToken = data.csrfToken as string;
}

export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('X-CSRF-Token', csrfToken);
  }
  return fetch(url, { ...options, headers });
}
