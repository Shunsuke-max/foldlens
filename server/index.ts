import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { analyzePrediction, getAnalysisMode } from './predictionAnalysis';
import { createRateLimiter } from './rateLimit';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4178);
const isProduction = process.env.NODE_ENV === 'production';
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..');
const analysisRateLimiter = createRateLimiter();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, analysisMode: getAnalysisMode(), model: process.env.OPENAI_MODEL || 'gpt-5.6-sol' });
});

app.post('/api/analyze', analysisRateLimiter.middleware, async (request, response) => {
  try {
    response.json(await analyzePrediction(request.body));
  } catch (error) {
    response.status(400).json({
      error: 'invalid_request',
      message: error instanceof Error ? error.message : 'Invalid analysis request',
    });
  }
});

if (isProduction) {
  const distDir = path.join(rootDir, 'dist');
  app.use(express.static(distDir));
  app.get('/{*splat}', (_request, response) => response.sendFile(path.join(distDir, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root: rootDir, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(port, () => {
  console.log(`FoldLens ready at http://127.0.0.1:${port} (${getAnalysisMode()} analysis)`);
});
