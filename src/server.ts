import { createApp } from './app.ts';
import { env } from './config/env.ts';
import { prisma } from './lib/prisma.ts';
import { validateEmailConfiguration } from './services/email.service.ts';

validateEmailConfiguration();

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on port ${env.PORT}`);
});

const shutdown = async (): Promise<void> => {
  await prisma.$disconnect();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
