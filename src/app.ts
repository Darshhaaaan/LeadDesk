import express from 'express';
import type { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import leadRoutes from './routes/lead.routes';
import { errorHandler, notFoundHandler } from './lib/errorHandler';

export const createApp = (): Express => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-XSRF-TOKEN'],
    })
  );
  app.use(express.json({ limit: '16kb' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/leads', leadRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
