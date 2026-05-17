const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8006';

interface ApiError extends Error {
  status?: number;
}

export async function apiCall<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include', // httpOnly cookie envoyé automatiquement
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    const err: ApiError = new Error(body.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}
