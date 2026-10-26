import express from 'express';
import type { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.ts';
import authRoutes from './routes/auth.routes.ts';
import leadRoutes from './routes/lead.routes.ts';
import { errorHandler, notFoundHandler } from './lib/errorHandler.ts';

export const createApp = (): Express => {
  const app = express();
  app.set('trust proxy', 1);


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
