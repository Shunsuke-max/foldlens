import type { IncomingMessage, ServerResponse } from 'node:http';

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function renderHealthEndpoint() {
  const configuredOrigin = process.env.RENDER_API_URL?.trim();
  if (!configuredOrigin) throw new Error('RENDER_API_URL is not configured');

  const origin = new URL(configuredOrigin);
  if (origin.protocol !== 'https:' && origin.hostname !== 'localhost' && origin.hostname !== '127.0.0.1') {
    throw new Error('RENDER_API_URL must use HTTPS');
  }
  return new URL('/api/health', origin);
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendJson(response, 405, { error: 'method_not_allowed', message: 'GET required' });
    return;
  }

  try {
    const upstream = await fetch(renderHealthEndpoint(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(70_000),
    });
    response.statusCode = upstream.status;
    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Render API request failed';
    const configurationError = message.startsWith('RENDER_API_URL');
    sendJson(response, configurationError ? 503 : 502, {
      error: configurationError ? 'service_not_configured' : 'upstream_unavailable',
      message,
    });
  }
}
