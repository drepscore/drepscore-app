import { NextRequest } from 'next/server';

export function createRequest(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): NextRequest {
  const url = `http://localhost:3000${path}`;
  const headers = new Headers(options.headers);
  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }
  return new NextRequest(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

export async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}
