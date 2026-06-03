import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    /** Pełne drzewo: plik → describe → każdy it() z nazwą */
    reporters: [['verbose', { summary: true }]],
    slowTestThreshold: 1000,
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    globalSetup: ['src/test/globalSetup.ts'],
    globalTeardown: ['src/test/globalTeardown.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
