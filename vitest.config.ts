import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Integration tests share one PostgreSQL database and each suite resets
    // user-owned rows. Running files sequentially keeps fixtures isolated.
    fileParallelism: false,
  },
});
