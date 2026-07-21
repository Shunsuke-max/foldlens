import type { IncomingMessage, ServerResponse } from 'node:http';

type ServerlessRequest = IncomingMessage & {
  body?: unknown;
};

const maximumBodyBytes = 64 * 1024;
const forwardedResponseHeaders = [
  'content-type',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'retry-after',
];

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

export function resolveRenderEndpoint(pathname: string, configuredOrigin = process.env.RENDER_API_URL) {
  if (!configuredOrigin?.trim()) {
    throw new Error('RENDER_API_URL is not configured');
  }

  const origin = new URL(configuredOrigin);
  if (origin.protocol !== 'https:' && origin.hostname !== 'localhost' && origin.hostname !== '127.0.0.1') {
    throw new Error('RENDER_API_URL must use HTTPS');
  }
  return new URL(pathname, `${origin.toString().replace(/\/$/, '')}/`);
}

async function readBody(request: ServerlessRequest) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  if (request.body !== undefined) {
    if (Buffer.isBuffer(request.body)) return request.body.toString('utf8');
    if (typeof request.body === 'string') return request.body;
    return JSON.stringify(request.body);
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maximumBodyBytes) throw new Error('Request body exceeds 64 KB');
    chunks.push(buffer);
  }
  return chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : undefined;
}

export async function proxyToRender(
  request: ServerlessRequest,
  response: ServerResponse,
  pathname: '/api/analyze' | '/api/health',
  allowedMethod: 'GET' | 'POST',
) {
  if (request.method !== allowedMethod) {
    response.setHeader('Allow', allowedMethod);
    sendJson(response, 405, { error: 'method_not_allowed', message: `${allowedMethod} required` });
    return;
  }

  try {
    const endpoint = resolveRenderEndpoint(pathname);
    const headers = new Headers({ Accept: 'application/json' });
    const contentType = request.headers['content-type'];
    if (typeof contentType === 'string') headers.set('Content-Type', contentType);
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') headers.set('X-Forwarded-For', forwardedFor);

    const upstream = await fetch(endpoint, {
      method: allowedMethod,
      headers,
      body: await readBody(request),
      signal: AbortSignal.timeout(55_000),
    });

    response.statusCode = upstream.status;
    for (const header of forwardedResponseHeaders) {
      const value = upstream.headers.get(header);
      if (value) response.setHeader(header, value);
    }
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
