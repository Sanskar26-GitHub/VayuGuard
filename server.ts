import cors from 'cors';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './server/routes/api';
import { sanitizeGeminiError } from './server/config/gemini';
import { ValidationError } from './server/services/sanitizationService';
import { logger } from './server/utils/logger';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Constructs and configures the VayuGuard Express application with CORS, 32 KB JSON limit,
 * API routing, and sanitized centralized error handling.
 *
 * @returns Configured Express application instance.
 */
export function createExpressApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '32kb' }));

  app.use('/api', apiRouter);

  // Centralized error handling middleware (never leaks stack traces or secrets)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }

    const anyErr = err as { type?: string; status?: number };
    if (anyErr?.type === 'entity.too.large' || anyErr?.status === 413) {
      res.status(413).json({ error: 'Request payload exceeds the 32 KB limit.' });
      return;
    }

    if (err instanceof SyntaxError && anyErr?.status === 400) {
      res.status(400).json({ error: 'Malformed JSON request body.' });
      return;
    }

    logger.error('Unhandled API server error', err);
    res.status(500).json({ error: 'Unable to process air-quality request right now.' });
  });

  return app;
}

async function startServer() {
  const app = createExpressApp();
  const httpServer = http.createServer(app);
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
        ws: hmrDisabled ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    logger.info('VayuGuard server listening', { port, mode: isProd ? 'production' : 'development' });
  });
}

// Start server when invoked directly
const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectExecution) {
  startServer().catch((err) => {
    logger.error('Failed to start VayuGuard server', sanitizeGeminiError(err));
    process.exit(1);
  });
}
