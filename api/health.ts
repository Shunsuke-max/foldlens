import type { IncomingMessage, ServerResponse } from 'node:http';
import { proxyToRender } from '../server/renderProxy.ts';

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await proxyToRender(request, response, '/api/health', 'GET');
}
