import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./tests/racine-temporaire.js'],
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
